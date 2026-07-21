/**
 * pastService.ts
 * ==============
 * Independent backend service for PAST (historical) weather predictions.
 * Fetches data from CSV cache (NASA/POWER) or Open-Meteo Archive API,
 * then runs the AI storm model on the historical data.
 *
 * All logic for past dates is encapsulated here — SidePanel simply calls
 * `fetchPastPrediction()` and renders the result.
 */

import type { Coordinate } from '../mockData';
import { getHistoricalRecord } from './historicalData';
import { stormModel } from './aiModel';

// ─── Result Types ─────────────────────────────────────────────────────────────

export interface PastPredictionResult {
  success: boolean;
  data?: PastData;
  error?: string;
  dataSource: 'CSV_NASA_POWER' | 'OPEN_METEO_ARCHIVE';
  requestedDate: string;
  actualDate?: string;
}

export interface PastData {
  date: string;
  temp: number;
  humidity: number;
  pressure: number;
  windSpeed: number;
  windGust: number;
  windDirection: number;
  rainfall: number;
  cloudCover: number;
  visibility: number;
  sunrise?: string;
  sunset?: string;
  hourly?: any;
  daily?: any;
  aiPrediction: {
    probability: number;
    riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'EXTREME';
    confidence: number;
    stormOccurred: boolean;
    stormStatus: string;
    explainableAI: string[];
  };
}

// ─── Logger ───────────────────────────────────────────────────────────────────

const LOG_PREFIX = '[PastService]';

function logInfo(msg: string, data?: any) {
  console.log(`${LOG_PREFIX} ${msg}`, data !== undefined ? data : '');
}

function logError(msg: string, err?: any) {
  console.error(`${LOG_PREFIX} ❌ ${msg}`, err !== undefined ? err : '');
}

function logWarn(msg: string, data?: any) {
  console.warn(`${LOG_PREFIX} ⚠️ ${msg}`, data !== undefined ? data : '');
}

// ─── AI Prediction Helper ─────────────────────────────────────────────────────

function runPastPrediction(data: {
  temp: number;
  humidity: number;
  pressure: number;
  windSpeed: number;
  windGust: number;
  rainfall: number;
  cloudCover: number;
}): PastData['aiPrediction'] {
  const prediction = stormModel.predict([
    data.temp, data.humidity, data.pressure, data.windSpeed, data.rainfall
  ]);

  const explainableAI: string[] = [];

  if (prediction.stormOccurred) {
    explainableAI.push(
      `Storm passage confirmed: ${prediction.probability}% probability classified by the trained Logistic Regression model.`
    );
  } else {
    explainableAI.push(
      `No storm detected: Stable conditions (${prediction.probability}% probability) classified by the trained Logistic Regression model.`
    );
  }

  if (data.windGust > 45) {
    explainableAI.push(`Severe gust speeds registered (${data.windGust} km/h), indicating active outer cyclonic wind bands.`);
  } else if (data.windSpeed > 25) {
    explainableAI.push(`Brisk wind speeds recorded (${data.windSpeed} km/h), indicating regional pressure gradients.`);
  }

  const baseline = data.pressure < 930 ? 887 : 1013;
  const drop = Math.max(0, baseline - data.pressure);
  if (drop > 5) {
    explainableAI.push(`Significant barometric depression (${data.pressure} hPa, -${drop} hPa deviation from baseline).`);
  }

  if (data.rainfall > 5) {
    explainableAI.push(`Convective atmospheric moisture flow: heavy precipitation detected (${data.rainfall} mm/hr).`);
  }

  explainableAI.push(`AI Engine: Trained on NASA/POWER MERRA-2 historical daily records.`);

  return {
    probability: prediction.probability,
    riskLevel: prediction.riskLevel,
    confidence: prediction.confidence,
    stormOccurred: prediction.stormOccurred,
    stormStatus: prediction.stormOccurred ? 'STORM OCCURRED' : 'NO STORM OCCURRED',
    explainableAI,
  };
}

// ─── Main Service Function ───────────────────────────────────────────────────

export async function fetchPastPrediction(
  coord: Coordinate,
  targetDate: string
): Promise<PastPredictionResult> {
  logInfo(`Fetching past weather for (${coord.lat}, ${coord.lng}) on ${targetDate}`);

  // Validate date is actually in the past
  const todayStr = new Date().toISOString().split('T')[0];
  if (targetDate >= todayStr) {
    logWarn('Requested date is not in the past', { targetDate, todayStr });
    return {
      success: false,
      error: `Date ${targetDate} is not in the past. Use the Present or Future service.`,
      dataSource: 'CSV_NASA_POWER',
      requestedDate: targetDate,
    };
  }

  try {
    // Strategy 1: Try CSV cache first (NASA/POWER data — covers specific lat/lng)
    const csvLat = 26.7578;
    const csvLng = 40.9869;
    const dist = Math.sqrt(Math.pow(coord.lat - csvLat, 2) + Math.pow(coord.lng - csvLng, 2));

    if (dist < 2.0) {
      const csvRecord = await getHistoricalRecord(targetDate);
      if (csvRecord) {
        logInfo('CSV record found', { date: csvRecord.date, source: 'NASA/POWER' });

        const aiPrediction = runPastPrediction({
          temp: csvRecord.temp,
          humidity: csvRecord.humidity,
          pressure: csvRecord.pressure,
          windSpeed: csvRecord.windSpeed,
          windGust: csvRecord.windGust,
          rainfall: csvRecord.rainfall,
          cloudCover: csvRecord.cloudCover,
        });

        return {
          success: true,
          data: {
            ...csvRecord,
            visibility: 10,
            aiPrediction,
          },
          dataSource: 'CSV_NASA_POWER',
          requestedDate: targetDate,
          actualDate: csvRecord.date,
        };
      }
    }

    // Strategy 2: Fetch from Open-Meteo Archive API
    logInfo('Fetching from Open-Meteo Archive API');
    const url = `https://archive-api.open-meteo.com/v1/archive?latitude=${coord.lat}&longitude=${coord.lng}&start_date=${targetDate}&end_date=${targetDate}&hourly=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,cloud_cover,visibility,pressure_msl,wind_speed_10m,wind_gusts_10m,wind_direction_10m,dew_point_2m&daily=sunrise,sunset,uv_index_max,precipitation_sum&timezone=auto`;

    const response = await fetch(url);
    if (!response.ok) {
      logError(`Archive API returned ${response.status}`);
      return {
        success: false,
        error: `Historical weather data not available for ${targetDate} (API returned ${response.status}).`,
        dataSource: 'OPEN_METEO_ARCHIVE',
        requestedDate: targetDate,
      };
    }

    const d = await response.json();

    if (!d.hourly?.time?.length) {
      logWarn('Archive API returned empty hourly data');
      return {
        success: false,
        error: `No historical weather records found for ${targetDate}.`,
        dataSource: 'OPEN_METEO_ARCHIVE',
        requestedDate: targetDate,
      };
    }

    // Validate the response date matches
    const responseDate = d.hourly.time[0]?.split('T')[0];
    if (responseDate && responseDate !== targetDate) {
      logWarn('Date mismatch in API response', { requested: targetDate, got: responseDate });
    }

    const noonIdx = 12;
    const idx = Math.min(noonIdx, d.hourly.time.length - 1);

    const weatherData = {
      date: targetDate,
      temp: Math.round(d.hourly.temperature_2m[idx] ?? 25),
      humidity: Math.round(d.hourly.relative_humidity_2m[idx] ?? 60),
      pressure: Math.round(d.hourly.pressure_msl[idx] ?? 1013),
      windSpeed: Math.round(d.hourly.wind_speed_10m[idx] ?? 10),
      windGust: Math.round(d.hourly.wind_gusts_10m[idx] ?? 15),
      windDirection: Math.round(d.hourly.wind_direction_10m[idx] ?? 180),
      rainfall: d.daily?.precipitation_sum?.[0] ?? 0,
      cloudCover: Math.round(d.hourly.cloud_cover[idx] ?? 30),
      visibility: d.hourly.visibility?.[idx] ? Number((d.hourly.visibility[idx] / 1000).toFixed(1)) : 10,
      sunrise: d.daily?.sunrise?.[0] ?? '',
      sunset: d.daily?.sunset?.[0] ?? '',
      hourly: d.hourly,
      daily: d.daily,
    };

    const aiPrediction = runPastPrediction({
      temp: weatherData.temp,
      humidity: weatherData.humidity,
      pressure: weatherData.pressure,
      windSpeed: weatherData.windSpeed,
      windGust: weatherData.windGust,
      rainfall: weatherData.rainfall,
      cloudCover: weatherData.cloudCover,
    });

    logInfo('Past prediction complete', {
      temp: weatherData.temp,
      probability: aiPrediction.probability,
      riskLevel: aiPrediction.riskLevel,
    });

    return {
      success: true,
      data: { ...weatherData, aiPrediction },
      dataSource: 'OPEN_METEO_ARCHIVE',
      requestedDate: targetDate,
      actualDate: responseDate || targetDate,
    };
  } catch (err: any) {
    logError('Past prediction failed', err);
    return {
      success: false,
      error: `Failed to fetch historical data: ${err?.message || 'Network error'}`,
      dataSource: 'OPEN_METEO_ARCHIVE',
      requestedDate: targetDate,
    };
  }
}
