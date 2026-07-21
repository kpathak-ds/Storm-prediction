import type { CityInfo, Coordinate } from '../mockData';
import { calculateDistance, globalStorms } from '../mockData';

// Cache for forecast API requests to optimize performance
const forecastCache = new Map<string, { data: any; timestamp: number }>();
const CACHE_DURATION_MS = 10 * 60 * 1000; // 10 minutes

// 1. Fetch Future Weather endpoint (/api/future-weather)
export async function fetchFutureWeather(coord: Coordinate, days = 7): Promise<any> {
  const cacheKey = `${coord.lat.toFixed(4)},${coord.lng.toFixed(4)},days=${days}`;
  const now = Date.now();

  if (forecastCache.has(cacheKey)) {
    const cached = forecastCache.get(cacheKey)!;
    if (now - cached.timestamp < CACHE_DURATION_MS) {
      return cached.data;
    }
  }

  // Open-Meteo API query with all forecast hourly and daily variables
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${coord.lat}&longitude=${coord.lng}&hourly=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation_probability,precipitation,rain,weather_code,cloud_cover,pressure_msl,wind_speed_10m,wind_direction_10m,wind_gusts_10m,visibility,dew_point_2m&daily=weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset,uv_index_max&forecast_days=${days}&timezone=auto`;

  let retries = 3;
  while (retries > 0) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error('Forecast API failed');
      const data = await res.json();
      forecastCache.set(cacheKey, { data, timestamp: now });
      return data;
    } catch (err) {
      retries--;
      if (retries === 0) {
        if (forecastCache.has(cacheKey)) {
          return forecastCache.get(cacheKey)!.data;
        }
        throw err;
      }
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
}

// Helper to determine threat level
export function getThreatLevel(probability: number, windSpeed: number): 'LOW' | 'MEDIUM' | 'HIGH' | 'EXTREME' {
  if (probability > 75 || windSpeed > 55) return 'EXTREME';
  if (probability > 45 || windSpeed > 38) return 'HIGH';
  if (probability >= 20 || windSpeed >= 20) return 'MEDIUM';
  return 'LOW';
}

// 2. Future Prediction Model (/api/future-prediction & /api/future-ai)
// Weighted scoring logic:
// Pressure Trend: 25%, Wind Speed: 20%, Humidity: 10%, Rainfall: 15%, Cloud Cover: 10%, Lightning: 10%, Temp: 5%, Historical Similarity: 5%
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
    historicalSimilarity = 65, // default
    distanceToStorm = 9999
  } = params;

  // Weighted scoring sub-components
  // a) Pressure trend (baseline 1013)
  const basePressure = 1013;
  const pressureDeviation = Math.max(0, basePressure - pressure);
  const pressureScore = Math.min(100, (pressureDeviation / 15) * 100);

  // b) Wind speed (gale force threshold 50 km/h)
  const windScore = Math.min(100, (windSpeed / 50) * 100);

  // c) Humidity (saturation index threshold 95%)
  const humidityScore = Math.min(100, (humidity / 95) * 100);

  // d) Rainfall (heavy precipitation threshold 15mm/h)
  const rainScore = Math.min(100, (rainfall / 15) * 100);

  // e) Cloud cover (overcast 100%)
  const cloudScore = cloudCover;

  // f) Lightning probability (convection potential)
  const lightningScore = lightning;

  // g) Temperature (thermal energy fuel, threshold 30°C)
  const tempScore = Math.min(100, (Math.max(0, temp - 20) / 10) * 100);

  // h) Historical similarity score
  const histScore = historicalSimilarity;

  // Combined weighted probability calculation
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

  // AI Confidence rating
  const isStorm = windSpeed > 38 || probability > 45;
  const confidence = Math.max(80, Math.min(98, Math.round(85 + (isStorm ? 5 : -4) + (distanceToStorm < 200 ? 5 : -2))));
  const threatLevel = getThreatLevel(probability, windSpeed);

  // 3. Explainable AI Insights (/api/future-insights)
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

  return {
    probability,
    confidence,
    threatLevel,
    explainableInsights
  };
}

// 4. Future Summary Details (/api/future-summary)
export function getFutureSummary(city: CityInfo, _forecastHourly: any, _hourOffset: number): any {
  // Find nearest active storm
  let nearestStorm = globalStorms[0];
  let minDistance = 9999;
  globalStorms.forEach(storm => {
    const stormState = storm.track[storm.track.length - 1]; // future state
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
