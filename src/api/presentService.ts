/**
 * presentService.ts
 * =================
 * Independent backend service for PRESENT (today) weather predictions.
 * Fetches live weather from Open-Meteo, AQI data, and runs the AI storm model.
 * 
 * All logic for "today's date" is encapsulated here — SidePanel simply calls
 * `fetchPresentPrediction()` and renders the result.
 */

import type { Coordinate } from '../mockData';
import { fetchLiveWeather, type OpenMeteoData } from './openMeteo';
import { stormModel } from './aiModel';

// ─── Result Types ─────────────────────────────────────────────────────────────

export interface PresentPredictionResult {
  success: boolean;
  data?: PresentData;
  error?: string;
  dataSource: 'LIVE_API';
  requestedDate: string;
}

export interface PresentData {
  liveWeather: OpenMeteoData;
  aqi: number | null;
  aiPrediction: {
    probability: number;
    riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'EXTREME';
    confidence: number;
    stormOccurred: boolean;
  };
}

// ─── Logger ───────────────────────────────────────────────────────────────────

const LOG_PREFIX = '[PresentService]';

function logInfo(msg: string, data?: any) {
  console.log(`${LOG_PREFIX} ${msg}`, data !== undefined ? data : '');
}

function logError(msg: string, err?: any) {
  console.error(`${LOG_PREFIX} ❌ ${msg}`, err !== undefined ? err : '');
}

// ─── Main Service Function ───────────────────────────────────────────────────

export async function fetchPresentPrediction(
  coord: Coordinate
): Promise<PresentPredictionResult> {
  const todayStr = new Date().toISOString().split('T')[0];
  logInfo(`Fetching present weather for (${coord.lat}, ${coord.lng}) on ${todayStr}`);

  try {
    // 1. Fetch live weather from Open-Meteo
    const liveWeather = await fetchLiveWeather(coord);
    logInfo('Live weather fetched successfully', {
      temp: liveWeather.current.temperature2m,
      wind: liveWeather.current.windSpeed10m,
      pressure: liveWeather.current.pressureMsl,
    });

    // 2. Fetch AQI data (non-blocking — don't fail the whole request)
    let aqi: number | null = null;
    try {
      const aqiRes = await fetch(
        `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${coord.lat}&longitude=${coord.lng}&current=us_aqi`
      );
      if (aqiRes.ok) {
        const aqiJson = await aqiRes.json();
        aqi = aqiJson.current?.us_aqi ?? null;
        logInfo('AQI fetched', { aqi });
      }
    } catch (aqiErr) {
      logError('AQI fetch failed (non-critical)', aqiErr);
    }

    // 3. Run AI storm prediction on current readings
    const currentTemp = liveWeather.current.temperature2m;
    const currentHumidity = liveWeather.current.relativeHumidity2m;
    const currentPressure = liveWeather.current.pressureMsl;
    const currentWindSpeed = liveWeather.current.windSpeed10m;
    const currentRainfall = liveWeather.current.precipitation;

    const prediction = stormModel.predict([
      currentTemp,
      currentHumidity,
      currentPressure,
      currentWindSpeed,
      currentRainfall,
    ]);

    logInfo('AI prediction completed', {
      probability: prediction.probability,
      riskLevel: prediction.riskLevel,
      confidence: prediction.confidence,
    });

    return {
      success: true,
      data: {
        liveWeather,
        aqi,
        aiPrediction: prediction,
      },
      dataSource: 'LIVE_API',
      requestedDate: todayStr,
    };
  } catch (err: any) {
    logError('Present prediction failed', err);
    return {
      success: false,
      error: `Failed to fetch current weather: ${err?.message || 'Unknown error'}`,
      dataSource: 'LIVE_API',
      requestedDate: todayStr,
    };
  }
}
