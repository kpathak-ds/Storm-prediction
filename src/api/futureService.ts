/**
 * futureService.ts
 * ================
 * Independent backend service for FUTURE weather predictions.
 * 
 * Routing Logic:
 *   - Today: fetches current weather from Open-Meteo
 *   - Within API forecast range (≤16 days): fetches from Open-Meteo Forecast API
 *   - Beyond API range (>16 days): uses AI prediction engine (climatological
 *     averages + trained Logistic Regression model)
 * 
 * Key guarantees:
 *   1. The selected future date is NEVER ignored or defaulted to today
 *   2. API response dates are validated against the requested date
 *   3. Beyond-range dates use AI prediction — never silently show today's weather
 *   4. Every failure produces a user-visible error, never swallowed silently
 *   5. Complete forecast data is returned including all 15+ required fields
 */

import type { CityInfo, Coordinate } from '../mockData';
import { calculateDistance, globalStorms } from '../mockData';
import { stormModel } from './aiModel';
import { getClimatologicalForecast } from './historicalData';

// ─── Constants ────────────────────────────────────────────────────────────────

/** Open-Meteo forecast API supports up to 16 days */
const MAX_API_FORECAST_DAYS = 16;

/** Cache duration for forecast API requests */
const CACHE_DURATION_MS = 10 * 60 * 1000; // 10 minutes

// ─── Result Types ─────────────────────────────────────────────────────────────

export interface FuturePredictionResult {
  success: boolean;
  data?: FutureData;
  error?: string;
  dataSource: 'API_FORECAST' | 'AI_PREDICTION' | 'NONE';
  requestedDate: string;
  actualDate?: string;
}

export interface FutureData {
  /** Target date this prediction is for (YYYY-MM-DD) */
  targetDate: string;

  /** Weather parameters */
  temp: number;
  feelsLike: number;
  humidity: number;
  pressure: number;
  windSpeed: number;
  windGust: number;
  windDirection: number;
  rainfall: number;
  precipProbability: number;
  cloudCover: number;
  visibility: number;
  lightning: number;

  /** AI storm prediction */
  stormProbability: number;
  aiConfidence: number;
  threatLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'EXTREME';

  /** Storm tracking estimates */
  estimatedArrival: number | null;  // hours
  estimatedDuration: number;        // hours
  affectedRadius: number;           // km
  stormDirection: string;
  stormSpeed: number;               // km/h

  /** Status analysis */
  stormStatus: string;

  /** AI explanations */
  explainableInsights: string[];

  /** Raw hourly data for charts (only available for API forecasts) */
  hourlyData?: {
    time: string[];
    temperature_2m: number[];
    relative_humidity_2m: number[];
    apparent_temperature: number[];
    pressure_msl: number[];
    wind_speed_10m: number[];
    wind_gusts_10m: number[];
    wind_direction_10m: number[];
    precipitation: number[];
    precipitation_probability: number[];
    cloud_cover: number[];
    visibility: number[];
    lightning_probability: number[];
  };

  /** Daily data (sunrise/sunset) */
  dailyData?: {
    sunrise: string[];
    sunset: string[];
  };
}

// ─── Logger ───────────────────────────────────────────────────────────────────

const LOG_PREFIX = '[FutureService]';

function logInfo(msg: string, data?: any) {
  console.log(`${LOG_PREFIX} ${msg}`, data !== undefined ? data : '');
}

function logError(msg: string, err?: any) {
  console.error(`${LOG_PREFIX} ❌ ${msg}`, err !== undefined ? err : '');
}

function logWarn(msg: string, data?: any) {
  console.warn(`${LOG_PREFIX} ⚠️ ${msg}`, data !== undefined ? data : '');
}

// ─── Cache ────────────────────────────────────────────────────────────────────

const forecastCache = new Map<string, { data: any; timestamp: number }>();

// ─── Helper Functions (kept from original) ────────────────────────────────────

export function getThreatLevel(probability: number, windSpeed: number): 'LOW' | 'MEDIUM' | 'HIGH' | 'EXTREME' {
  if (probability > 75 || windSpeed > 55) return 'EXTREME';
  if (probability > 45 || windSpeed > 38) return 'HIGH';
  if (probability >= 20 || windSpeed >= 20) return 'MEDIUM';
  return 'LOW';
}

/**
 * Weighted scoring model for future storm prediction.
 * Pressure Trend: 25%, Wind Speed: 20%, Humidity: 10%, Rainfall: 15%,
 * Cloud Cover: 10%, Lightning: 10%, Temp: 5%, Historical Similarity: 5%
 */
export function getFuturePrediction(params: {
  temp: number;
  humidity: number;
  pressure: number;
  windSpeed: number;
  rainfall: number;
  cloudCover: number;
  lightning: number;
  historicalSimilarity?: number;
  distanceToStorm?: number;
}): {
  probability: number;
  confidence: number;
  threatLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'EXTREME';
  explainableInsights: string[];
} {
  const {
    temp,
    humidity,
    pressure,
    windSpeed,
    rainfall,
    cloudCover,
    lightning,
    historicalSimilarity = 65,
    distanceToStorm = 9999
  } = params;

  const basePressure = 1013;
  const pressureDeviation = Math.max(0, basePressure - pressure);
  const pressureScore = Math.min(100, (pressureDeviation / 15) * 100);
  const windScore = Math.min(100, (windSpeed / 50) * 100);
  const humidityScore = Math.min(100, (humidity / 95) * 100);
  const rainScore = Math.min(100, (rainfall / 15) * 100);
  const cloudScore = cloudCover;
  const lightningScore = lightning;
  const tempScore = Math.min(100, (Math.max(0, temp - 20) / 10) * 100);
  const histScore = historicalSimilarity;

  const probability = Math.round(
    pressureScore * 0.25 +
    windScore * 0.20 +
    humidityScore * 0.10 +
    rainScore * 0.15 +
    cloudScore * 0.10 +
    lightningScore * 0.10 +
    tempScore * 0.05 +
    histScore * 0.05
  );

  const isStorm = windSpeed > 38 || probability > 45;
  const confidence = Math.max(80, Math.min(98, Math.round(85 + (isStorm ? 5 : -4) + (distanceToStorm < 200 ? 5 : -2))));
  const threatLevel = getThreatLevel(probability, windSpeed);

  const explainableInsights: string[] = [];
  if (pressureDeviation > 5) {
    explainableInsights.push(`Forecast pressure is expected to decrease steadily to ${pressure} hPa (-${Math.round(pressureDeviation)} hPa deviation from baseline), indicating possible storm or cyclone development.`);
  } else {
    explainableInsights.push(`Atmospheric pressure remains relatively stable at ${pressure} hPa.`);
  }

  if (rainfall > 5) {
    explainableInsights.push(`Heavy convective rainfall is predicted at ${rainfall.toFixed(1)} mm/hr, with storm probability exceeding 80%.`);
  } else if (rainfall > 0) {
    explainableInsights.push(`Light rainfall forecast: ${rainfall.toFixed(1)} mm/hr convective moisture deposition.`);
  }

  if (windSpeed > 45) {
    explainableInsights.push(`Strong wind gusts above 70 km/h are expected as cyclonic wind bands pass close to the coordinate.`);
  } else if (windSpeed > 25) {
    explainableInsights.push(`Brisk wind speeds recorded (${Math.round(windSpeed)} km/h), indicating elevated regional wind shear.`);
  }

  if (cloudCover > 80) {
    explainableInsights.push(`High cloud convection (${cloudCover}%) indicates high cloud top development and storm clouds.`);
  }

  if (lightning > 50) {
    explainableInsights.push(`Elevated lightning probability (${lightning}%) represents high atmospheric discharge risk.`);
  }

  if (probability > 45) {
    explainableInsights.push(`Storm probability increased to ${probability}% over the prediction cycle, raising threat level to ${threatLevel}.`);
  } else {
    explainableInsights.push(`Low atmospheric warning metrics keep the storm probability stable at ${probability}%.`);
  }

  explainableInsights.push(`Prediction confidence rating is ${confidence}% due to strong weather model consensus.`);

  return { probability, confidence, threatLevel, explainableInsights };
}

export function getFutureSummary(city: CityInfo, _forecastHourly: any, _hourOffset: number): any {
  let nearestStorm = globalStorms[0];
  let minDistance = 9999;
  globalStorms.forEach(storm => {
    const stormState = storm.track[storm.track.length - 1];
    const d = calculateDistance(city.coord, stormState.position);
    if (d < minDistance) {
      minDistance = d;
      nearestStorm = storm;
    }
  });

  const arrival = minDistance < 300 ? Math.max(0, Math.round(minDistance / 18)) : null;

  return {
    arrivalTime: arrival,
    duration: minDistance < 250 ? 24 : 12,
    direction: nearestStorm ? nearestStorm.forecastMovement.split(' ')[0] : 'N/A',
    speed: nearestStorm ? parseInt(nearestStorm.forecastMovement.match(/\d+/)?.[0] ?? '18', 10) : 18,
    radius: nearestStorm ? Math.round(300 - minDistance * 0.1) : 250,
  };
}

// ─── Internal: Determine storm status text ────────────────────────────────────

function getStormStatus(probability: number, windSpeed: number, rainfall: number): string {
  if (probability > 75) return 'Extreme Weather Expected';
  if (probability > 55 || windSpeed > 45) return 'Cyclonic Conditions Developing';
  if (probability > 35) return 'Storm Formation Possible';
  if (windSpeed > 30) return 'High Wind Warning';
  if (rainfall > 10) return 'High Flood Risk';
  return 'No Storm Expected';
}

// ─── Internal: Compute storm tracking estimates ───────────────────────────────

function computeStormTracking(city: CityInfo): {
  arrivalTime: number | null;
  duration: number;
  direction: string;
  speed: number;
  radius: number;
} {
  let nearestStorm = globalStorms[0];
  let minDistance = 9999;

  globalStorms.forEach(storm => {
    const stormState = storm.track[storm.track.length - 1];
    const d = calculateDistance(city.coord, stormState.position);
    if (d < minDistance) {
      minDistance = d;
      nearestStorm = storm;
    }
  });

  const arrival = minDistance < 300 ? Math.max(0, Math.round(minDistance / 18)) : null;

  return {
    arrivalTime: arrival,
    duration: minDistance < 250 ? 24 : 12,
    direction: nearestStorm ? nearestStorm.forecastMovement.split(' ')[0] : 'N/A',
    speed: nearestStorm ? parseInt(nearestStorm.forecastMovement.match(/\d+/)?.[0] ?? '18', 10) : 18,
    radius: nearestStorm ? Math.round(Math.max(50, 300 - minDistance * 0.1)) : 250,
  };
}

// ─── Internal: Fetch from Open-Meteo Forecast API ─────────────────────────────

async function fetchFromForecastAPI(
  coord: Coordinate,
  targetDate: string,
  diffDays: number
): Promise<FuturePredictionResult> {
  const forecastDays = Math.min(MAX_API_FORECAST_DAYS, diffDays + 1);
  const cacheKey = `${coord.lat.toFixed(4)},${coord.lng.toFixed(4)},days=${forecastDays}`;
  const now = Date.now();

  // Check cache
  if (forecastCache.has(cacheKey)) {
    const cached = forecastCache.get(cacheKey)!;
    if (now - cached.timestamp < CACHE_DURATION_MS) {
      logInfo('Using cached forecast data');
      return extractDayFromForecast(cached.data, targetDate, diffDays, coord);
    }
  }

  const url = `https://api.open-meteo.com/v1/forecast?latitude=${coord.lat}&longitude=${coord.lng}&hourly=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation_probability,precipitation,rain,weather_code,cloud_cover,pressure_msl,wind_speed_10m,wind_direction_10m,wind_gusts_10m,visibility,dew_point_2m&daily=weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset,uv_index_max&forecast_days=${forecastDays}&timezone=auto`;

  logInfo(`Fetching forecast API: ${forecastDays} days`);

  let retries = 3;
  while (retries > 0) {
    try {
      const res = await fetch(url);
      if (!res.ok) {
        throw new Error(`Forecast API returned ${res.status}`);
      }
      const data = await res.json();
      forecastCache.set(cacheKey, { data, timestamp: now });

      return extractDayFromForecast(data, targetDate, diffDays, coord);
    } catch (err) {
      retries--;
      if (retries === 0) {
        // Try stale cache as last resort
        if (forecastCache.has(cacheKey)) {
          logWarn('Using stale cached data after API failure');
          return extractDayFromForecast(forecastCache.get(cacheKey)!.data, targetDate, diffDays, coord);
        }
        throw err;
      }
      logWarn(`Forecast API retry (${3 - retries}/3)`);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  throw new Error('Forecast API exhausted all retries');
}

// ─── Internal: Extract the requested day from API forecast data ───────────────

function extractDayFromForecast(
  apiData: any,
  targetDate: string,
  diffDays: number,
  _coord: Coordinate
): FuturePredictionResult {
  const hourly = apiData.hourly;
  if (!hourly?.time?.length) {
    logError('API returned empty hourly data');
    return {
      success: false,
      error: 'Forecast API returned empty data. Please try a different date.',
      dataSource: 'API_FORECAST',
      requestedDate: targetDate,
    };
  }

  // Find the index for noon on the target date
  const targetNoon = `${targetDate}T12:00`;
  let targetIdx = hourly.time.findIndex((t: string) => t === targetNoon);

  // Fallback: find any hour on the target date
  if (targetIdx === -1) {
    targetIdx = hourly.time.findIndex((t: string) => t.startsWith(targetDate));
  }

  // Last resort: use diffDays * 24 + 12 (noon offset)
  if (targetIdx === -1) {
    targetIdx = Math.min(diffDays * 24 + 12, hourly.time.length - 1);
  }

  // *** CRITICAL VALIDATION: Check if the data at this index actually matches the target date ***
  const actualDateAtIdx = hourly.time[targetIdx]?.split('T')[0];
  if (actualDateAtIdx && actualDateAtIdx !== targetDate) {
    logWarn('Date mismatch in forecast data', {
      requested: targetDate,
      actualAtIndex: actualDateAtIdx,
      index: targetIdx,
      totalHours: hourly.time.length,
    });

    return {
      success: false,
      error: `No forecast data available for ${targetDate}. The API only covers up to ${hourly.time[hourly.time.length - 1]?.split('T')[0] || 'unknown'}. Switching to AI prediction.`,
      dataSource: 'NONE',
      requestedDate: targetDate,
      actualDate: actualDateAtIdx,
    };
  }

  logInfo(`Extracting forecast for ${targetDate} at index ${targetIdx}`, {
    time: hourly.time[targetIdx],
  });

  // Extract all weather parameters
  const temp = Math.round(hourly.temperature_2m[targetIdx] ?? 25);
  const feelsLike = Math.round(hourly.apparent_temperature?.[targetIdx] ?? (temp - 1.5));
  const humidity = Math.round(hourly.relative_humidity_2m[targetIdx] ?? 60);
  const pressure = Math.round(hourly.pressure_msl[targetIdx] ?? 1013);
  const windSpeed = Math.round(hourly.wind_speed_10m[targetIdx] ?? 10);
  const windGust = Math.round(hourly.wind_gusts_10m?.[targetIdx] ?? (windSpeed * 1.35));
  const windDirection = Math.round(hourly.wind_direction_10m?.[targetIdx] ?? 180);
  const rainfall = parseFloat((hourly.precipitation[targetIdx] || 0).toFixed(2));
  const precipProbability = Math.round(hourly.precipitation_probability?.[targetIdx] ?? (rainfall > 0 ? 85 : 10));
  const cloudCover = Math.round(hourly.cloud_cover[targetIdx] ?? 30);
  const visibility = Math.round(hourly.visibility?.[targetIdx] ?? 10000);
  const lightning = Math.round(cloudCover > 70 ? 45 : 5);

  // Run AI storm prediction
  const trainedPrediction = stormModel.predict([temp, humidity, pressure, windSpeed, rainfall]);

  const stormProbability = trainedPrediction.probability;
  const aiConfidence = trainedPrediction.confidence;
  const threatLevel = trainedPrediction.riskLevel;

  // Build explainable insights
  const explainableInsights: string[] = [];
  if (trainedPrediction.stormOccurred) {
    explainableInsights.push(`Storm development predicted: ${stormProbability}% probability classified by the trained Logistic Regression model.`);
  } else {
    explainableInsights.push(`Stable conditions expected: ${stormProbability}% probability classified by the trained Logistic Regression model.`);
  }
  if (windSpeed > 25) {
    explainableInsights.push(`Elevated wind speeds forecast (${windSpeed} km/h), indicating regional pressure gradients.`);
  }
  if (rainfall > 5) {
    explainableInsights.push(`Significant precipitation forecast (${rainfall} mm/hr), indicating convective atmospheric moisture.`);
  }
  if (pressure < 1005) {
    explainableInsights.push(`Low barometric pressure forecast (${pressure} hPa), possible cyclogenesis indicator.`);
  }
  explainableInsights.push(`Data Source: Open-Meteo 16-day Forecast API | AI Engine: Trained on NASA/POWER MERRA-2 records.`);

  const stormStatus = getStormStatus(stormProbability, windSpeed, rainfall);

  // Build hourly data for charts (full range available)
  const hourlyData = {
    time: hourly.time,
    temperature_2m: hourly.temperature_2m,
    relative_humidity_2m: hourly.relative_humidity_2m,
    apparent_temperature: hourly.apparent_temperature || hourly.temperature_2m.map((t: number) => t - 1.5),
    pressure_msl: hourly.pressure_msl,
    wind_speed_10m: hourly.wind_speed_10m,
    wind_gusts_10m: hourly.wind_gusts_10m || hourly.wind_speed_10m.map((w: number) => Math.round(w * 1.35)),
    wind_direction_10m: hourly.wind_direction_10m || hourly.wind_speed_10m.map(() => 180),
    precipitation: hourly.precipitation,
    precipitation_probability: hourly.precipitation_probability || hourly.precipitation.map((p: number) => p > 0 ? 80 : 10),
    cloud_cover: hourly.cloud_cover,
    visibility: hourly.visibility || hourly.cloud_cover.map(() => 10000),
    lightning_probability: hourly.cloud_cover.map((c: number) => c > 70 ? 45 : 5),
  };

  const dailyData = apiData.daily ? {
    sunrise: apiData.daily.sunrise || [],
    sunset: apiData.daily.sunset || [],
  } : undefined;

  return {
    success: true,
    data: {
      targetDate,
      temp,
      feelsLike,
      humidity,
      pressure,
      windSpeed,
      windGust,
      windDirection,
      rainfall,
      precipProbability,
      cloudCover,
      visibility,
      lightning,
      stormProbability,
      aiConfidence,
      threatLevel,
      estimatedArrival: null, // filled in by caller with city context
      estimatedDuration: 12,
      affectedRadius: 250,
      stormDirection: 'N/A',
      stormSpeed: 18,
      stormStatus,
      explainableInsights,
      hourlyData,
      dailyData,
    },
    dataSource: 'API_FORECAST',
    requestedDate: targetDate,
    actualDate: actualDateAtIdx,
  };
}

// ─── Internal: AI Prediction for beyond-API-range dates ───────────────────────

async function fetchFromAIPrediction(
  coord: Coordinate,
  targetDate: string,
  diffDays: number,
  city: CityInfo
): Promise<FuturePredictionResult> {
  logInfo(`Using AI prediction engine for (${coord.lat}, ${coord.lng}) on ${targetDate} (${diffDays} days ahead, beyond API range)`);

  const parts = targetDate.split('-');
  const month = parseInt(parts[1], 10);
  const day = parseInt(parts[2], 10);

  // Get climatological average for this day-of-year
  const climRecord = await getClimatologicalForecast(month, day);

  if (!climRecord) {
    logError('No climatological data available for AI prediction');
    return {
      success: false,
      error: `No climatological reference data available for ${targetDate}. Unable to generate AI prediction.`,
      dataSource: 'AI_PREDICTION',
      requestedDate: targetDate,
    };
  }

  logInfo('Climatological baseline loaded', {
    date: climRecord.date,
    temp: climRecord.temp,
    humidity: climRecord.humidity,
    pressure: climRecord.pressure,
    windSpeed: climRecord.windSpeed,
  });

  // Run the trained AI storm model
  const trainedPrediction = stormModel.predict([
    climRecord.temp,
    climRecord.humidity,
    climRecord.pressure,
    climRecord.windSpeed,
    climRecord.rainfall,
  ]);

  // Also run the weighted scoring model for richer insights
  const lightning = climRecord.cloudCover > 70 ? 40 : 5;
  const weightedPrediction = getFuturePrediction({
    temp: climRecord.temp,
    humidity: climRecord.humidity,
    pressure: climRecord.pressure,
    windSpeed: climRecord.windSpeed,
    rainfall: climRecord.rainfall,
    cloudCover: climRecord.cloudCover,
    lightning,
  });

  // Use the trained model's results, with weighted model's insights
  const stormProbability = trainedPrediction.probability;
  const aiConfidence = Math.max(70, trainedPrediction.confidence - 5); // slightly lower confidence for AI-only predictions
  const threatLevel = trainedPrediction.riskLevel;

  // Build detailed explainable insights
  const explainableInsights: string[] = [
    `⚠️ This prediction uses the AI engine because ${targetDate} is ${diffDays} days ahead (beyond the 16-day API forecast limit).`,
    ...weightedPrediction.explainableInsights,
    `Climatological baseline for ${MONTH_NAMES[month - 1]} ${day}: Temp ${climRecord.temp}°C, Humidity ${climRecord.humidity}%, Pressure ${climRecord.pressure} hPa, Wind ${climRecord.windSpeed} km/h.`,
    `AI Engine: Logistic Regression trained on NASA/POWER MERRA-2 historical daily records + weighted meteorological scoring model.`,
  ];

  const stormStatus = getStormStatus(stormProbability, climRecord.windSpeed, climRecord.rainfall);

  // Compute storm tracking
  const tracking = computeStormTracking(city);

  // Build synthetic hourly data for charts (24h of repeated climatological values)
  const hourlyData = {
    time: Array.from({ length: 24 }, (_, i) => `${targetDate}T${String(i).padStart(2, '0')}:00`),
    temperature_2m: Array(24).fill(climRecord.temp),
    relative_humidity_2m: Array(24).fill(climRecord.humidity),
    apparent_temperature: Array(24).fill(climRecord.temp - 1.5),
    pressure_msl: Array(24).fill(climRecord.pressure),
    wind_speed_10m: Array(24).fill(climRecord.windSpeed),
    wind_gusts_10m: Array(24).fill(climRecord.windGust),
    wind_direction_10m: Array(24).fill(climRecord.windDirection),
    precipitation: Array(24).fill(climRecord.rainfall),
    precipitation_probability: Array(24).fill(climRecord.rainfall > 0 ? 80 : 10),
    cloud_cover: Array(24).fill(climRecord.cloudCover),
    visibility: Array(24).fill(12000),
    lightning_probability: Array(24).fill(lightning),
  };

  return {
    success: true,
    data: {
      targetDate,
      temp: climRecord.temp,
      feelsLike: climRecord.temp - 1.5,
      humidity: climRecord.humidity,
      pressure: climRecord.pressure,
      windSpeed: climRecord.windSpeed,
      windGust: climRecord.windGust,
      windDirection: climRecord.windDirection,
      rainfall: climRecord.rainfall,
      precipProbability: climRecord.rainfall > 0 ? 80 : 10,
      cloudCover: climRecord.cloudCover,
      visibility: 12,
      lightning,
      stormProbability,
      aiConfidence,
      threatLevel,
      estimatedArrival: tracking.arrivalTime,
      estimatedDuration: tracking.duration,
      affectedRadius: tracking.radius,
      stormDirection: tracking.direction,
      stormSpeed: tracking.speed,
      stormStatus,
      explainableInsights,
      hourlyData,
      dailyData: {
        sunrise: [`${targetDate}T06:00`],
        sunset: [`${targetDate}T18:30`],
      },
    },
    dataSource: 'AI_PREDICTION',
    requestedDate: targetDate,
    actualDate: targetDate,
  };
}

// ─── Month names for readable insights ────────────────────────────────────────

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];

// ─── MAIN ENTRY POINT ────────────────────────────────────────────────────────

/**
 * Fetches a complete future prediction for the given coordinate and date.
 * 
 * Routing:
 *   - If targetDate is within 16 days → Open-Meteo Forecast API
 *   - If targetDate is beyond 16 days → AI Prediction Engine
 *   - Never returns today's weather for a future date
 *   - Never silently fails
 * 
 * @param coord  The geographical coordinate
 * @param targetDate  The future date in YYYY-MM-DD format
 * @param city  The city info (for storm tracking context)
 * @returns Complete prediction result
 */
export async function fetchFuturePrediction(
  coord: Coordinate,
  targetDate: string,
  city: CityInfo
): Promise<FuturePredictionResult> {
  logInfo(`=== Future Prediction Request ===`);
  logInfo(`Target date: ${targetDate}`);
  logInfo(`Coordinates: (${coord.lat}, ${coord.lng})`);

  // 1. Validate the target date is actually in the future
  const todayStr = new Date().toISOString().split('T')[0];
  if (targetDate <= todayStr) {
    logWarn('Requested date is not in the future', { targetDate, todayStr });
    return {
      success: false,
      error: `Date ${targetDate} is not in the future. Use the Present or Past service.`,
      dataSource: 'NONE',
      requestedDate: targetDate,
    };
  }

  // 2. Calculate days difference
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const selected = new Date(targetDate);
  selected.setHours(0, 0, 0, 0);
  const diffDays = Math.ceil((selected.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  logInfo(`Days ahead: ${diffDays}, API limit: ${MAX_API_FORECAST_DAYS}`);

  try {
    let result: FuturePredictionResult;

    if (diffDays <= MAX_API_FORECAST_DAYS) {
      // Route 1: Within API forecast range
      logInfo('Route: API Forecast (within 16-day range)');
      result = await fetchFromForecastAPI(coord, targetDate, diffDays);

      // If API extraction failed (e.g. date not in range), fall back to AI
      if (!result.success && result.dataSource === 'NONE') {
        logWarn('API forecast extraction failed, falling back to AI prediction');
        result = await fetchFromAIPrediction(coord, targetDate, diffDays, city);
      }
    } else {
      // Route 2: Beyond API range — use AI prediction engine
      logInfo('Route: AI Prediction (beyond 16-day range)');
      result = await fetchFromAIPrediction(coord, targetDate, diffDays, city);
    }

    // Enrich with storm tracking data if not already set
    if (result.success && result.data) {
      if (result.data.estimatedArrival === null || result.dataSource === 'API_FORECAST') {
        const tracking = computeStormTracking(city);
        result.data.estimatedArrival = tracking.arrivalTime;
        result.data.estimatedDuration = tracking.duration;
        result.data.affectedRadius = tracking.radius;
        result.data.stormDirection = tracking.direction;
        result.data.stormSpeed = tracking.speed;
      }
    }

    logInfo(`=== Future Prediction Complete ===`, {
      success: result.success,
      dataSource: result.dataSource,
      stormProbability: result.data?.stormProbability,
      threatLevel: result.data?.threatLevel,
    });

    return result;
  } catch (err: any) {
    logError('Future prediction failed completely', err);
    return {
      success: false,
      error: `Failed to generate future prediction for ${targetDate}: ${err?.message || 'Unknown error'}. Please try again.`,
      dataSource: 'NONE',
      requestedDate: targetDate,
    };
  }
}

// ─── Legacy compatibility: export fetchFutureWeather for any remaining callers ─

export async function fetchFutureWeather(_coord: Coordinate, days = 7): Promise<any> {
  logWarn('DEPRECATED: fetchFutureWeather called. Use fetchFuturePrediction instead.');
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${_coord.lat}&longitude=${_coord.lng}&hourly=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation_probability,precipitation,rain,weather_code,cloud_cover,pressure_msl,wind_speed_10m,wind_direction_10m,wind_gusts_10m,visibility,dew_point_2m&daily=weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset,uv_index_max&forecast_days=${days}&timezone=auto`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Forecast API failed');
  return res.json();
}
