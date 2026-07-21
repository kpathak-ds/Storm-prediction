export interface HistoricalRecord {
  date: string;
  temp: number;
  humidity: number;
  pressure: number;
  windSpeed: number;
  windGust: number;
  windDirection: number;
  rainfall: number;
  cloudCover: number;
}

let historicalCache: Map<string, HistoricalRecord> | null = null;

import { trainModelFromCSVText } from './aiModel';

export async function fetchHistoricalData(): Promise<Map<string, HistoricalRecord>> {
  if (historicalCache) return historicalCache;

  const res = await fetch('/data/historical_weather.csv');
  if (!res.ok) throw new Error("Failed to load historical data");
  const text = await res.text();

  // Train the client-side AI Logistic Regression classifier on CSV boot
  try {
    await trainModelFromCSVText(text);
  } catch (e) {
    console.error("Failed to train storm classification model:", e);
  }

  const lines = text.split('\n');
  const cache = new Map<string, HistoricalRecord>();

  let dataStarted = false;
  for (const line of lines) {
    if (line.startsWith('YEAR,MO,DY')) {
      dataStarted = true;
      continue;
    }
    if (!dataStarted || !line.trim()) continue;

    const parts = line.split(',');
    if (parts.length < 13) continue;

    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10);
    const day = parseInt(parts[2], 10);
    
    // Format date as YYYY-MM-DD
    const dateStr = `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;

    const t2m = parseFloat(parts[3]);
    const rh2m = parseFloat(parts[7]);
    const ps = parseFloat(parts[8]); // kPa
    const ws10m = parseFloat(parts[9]); // m/s
    const ws10m_max = parseFloat(parts[10]); // m/s
    const wd10m = parseFloat(parts[11]); // degrees
    const precip = parseFloat(parts[12]); // mm/day

    cache.set(dateStr, {
      date: dateStr,
      temp: Math.round(t2m),
      humidity: Math.round(rh2m),
      pressure: Math.round(ps * 10), // convert kPa to hPa
      windSpeed: Math.round(ws10m * 3.6), // convert m/s to km/h
      windGust: Math.round(ws10m_max * 3.6), // convert m/s to km/h
      windDirection: Math.round(wd10m),
      rainfall: Number((precip / 24).toFixed(1)), // roughly mm/hr
      cloudCover: rh2m > 70 ? 90 : rh2m > 40 ? 45 : 15
    });
  }

  historicalCache = cache;
  return cache;
}

export async function getHistoricalRecord(dateStr: string): Promise<HistoricalRecord | null> {
  const data = await fetchHistoricalData();
  return data.get(dateStr) || null;
}

export async function getClimatologicalForecast(month: number, day: number): Promise<HistoricalRecord | null> {
  const cache = await fetchHistoricalData();
  const suffix = `-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
  
  let count = 0;
  let tempSum = 0;
  let humiditySum = 0;
  let pressureSum = 0;
  let windSpeedSum = 0;
  let windGustSum = 0;
  let rainfallSum = 0;
  let cloudCoverSum = 0;
  let windDirectionSum = 0;

  for (const [dateStr, record] of cache.entries()) {
    if (dateStr.endsWith(suffix)) {
      count++;
      tempSum += record.temp;
      humiditySum += record.humidity;
      pressureSum += record.pressure;
      windSpeedSum += record.windSpeed;
      windGustSum += record.windGust;
      rainfallSum += record.rainfall;
      cloudCoverSum += record.cloudCover;
      windDirectionSum += record.windDirection;
    }
  }

  if (count === 0) return null;

  return {
    date: `2026-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`,
    temp: Math.round(tempSum / count),
    humidity: Math.round(humiditySum / count),
    pressure: Math.round(pressureSum / count),
    windSpeed: Math.round(windSpeedSum / count),
    windGust: Math.round(windGustSum / count),
    windDirection: Math.round(windDirectionSum / count),
    rainfall: Number((rainfallSum / count).toFixed(2)),
    cloudCover: Math.round(cloudCoverSum / count)
  };
}

export function getClimatologicalForecastSync(month: number, day: number): HistoricalRecord | null {
  if (!historicalCache) return null;
  const suffix = `-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
  
  let count = 0;
  let tempSum = 0;
  let humiditySum = 0;
  let pressureSum = 0;
  let windSpeedSum = 0;
  let windGustSum = 0;
  let rainfallSum = 0;
  let cloudCoverSum = 0;
  let windDirectionSum = 0;

  for (const [dateStr, record] of historicalCache.entries()) {
    if (dateStr.endsWith(suffix)) {
      count++;
      tempSum += record.temp;
      humiditySum += record.humidity;
      pressureSum += record.pressure;
      windSpeedSum += record.windSpeed;
      windGustSum += record.windGust;
      rainfallSum += record.rainfall;
      cloudCoverSum += record.cloudCover;
      windDirectionSum += record.windDirection;
    }
  }

  if (count === 0) return null;

  return {
    date: `2026-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`,
    temp: Math.round(tempSum / count),
    humidity: Math.round(humiditySum / count),
    pressure: Math.round(pressureSum / count),
    windSpeed: Math.round(windSpeedSum / count),
    windGust: Math.round(windGustSum / count),
    windDirection: Math.round(windDirectionSum / count),
    rainfall: Number((rainfallSum / count).toFixed(2)),
    cloudCover: Math.round(cloudCoverSum / count)
  };
}
