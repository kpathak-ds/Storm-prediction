import type { Coordinate } from '../mockData';

export interface AirQualityData {
  aqi: number;
  pm25: number;
  pm10: number;
  o3: number;
  no2: number;
  so2: number;
  co: number;
}

export interface ExtendedWeatherMetrics {
  dewPoint: number;
  snowfall: number;
  moonPhase: string;
  airQuality: AirQualityData;
}

export interface OpenMeteoData {
  current: {
    time: string;
    temperature2m: number;
    relativeHumidity2m: number;
    apparentTemperature: number;
    isDay: number;
    precipitation: number;
    rain: number;
    weatherCode: number;
    cloudCover: number;
    pressureMsl: number;
    surfacePressure: number;
    windSpeed10m: number;
    windDirection10m: number;
    windGusts10m: number;
    dewPoint2m?: number;
    snowfall?: number;
  };
  hourly: {
    time: string[];
    temperature2m: number[];
    relativeHumidity2m: number[];
    apparentTemperature: number[];
    precipitation: number[];
    cloudCover: number[];
    visibility: number[];
    weatherCode: number[];
    pressureMsl: number[];
    windSpeed10m: number[];
    windDirection10m: number[];
    windGusts10m: number[];
    dewPoint2m?: number[];
    snowfall?: number[];
  };
  daily: {
    time: string[];
    weatherCode: number[];
    temperature2mMax: number[];
    temperature2mMin: number[];
    sunrise: string[];
    sunset: string[];
    uvIndexMax: number[];
  };
  extended?: ExtendedWeatherMetrics;
}

const cache = new Map<string, { data: OpenMeteoData; timestamp: number }>();
const CACHE_DURATION_MS = 10 * 60 * 1000;

export async function fetchAirQuality(coord: Coordinate): Promise<AirQualityData> {
  try {
    const url = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${coord.lat}&longitude=${coord.lng}&current=us_aqi,pm10,pm2_5,carbon_monoxide,nitrogen_dioxide,sulfur_dioxide,ozone`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('AQI API failed');
    const json = await res.json();
    const cur = json.current || {};
    return {
      aqi: Math.round(cur.us_aqi ?? 45),
      pm25: parseFloat((cur.pm2_5 ?? 12.5).toFixed(1)),
      pm10: parseFloat((cur.pm10 ?? 28.4).toFixed(1)),
      o3: parseFloat((cur.ozone ?? 42.1).toFixed(1)),
      no2: parseFloat((cur.nitrogen_dioxide ?? 18.2).toFixed(1)),
      so2: parseFloat((cur.sulfur_dioxide ?? 5.4).toFixed(1)),
      co: parseFloat((cur.carbon_monoxide ?? 320).toFixed(1)),
    };
  } catch {
    return {
      aqi: 42,
      pm25: 11.2,
      pm10: 24.5,
      o3: 38.0,
      no2: 15.4,
      so2: 4.2,
      co: 290.0,
    };
  }
}

export function getMoonPhase(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const c = Math.floor(3.6525 * year) + Math.floor(year / 100) + Math.floor(year / 400) + day + (month > 2 ? 0 : -1);
  const jd = c + 1721060;
  const cycle = (jd - 2451550.1) / 29.53058867;
  const phase = cycle - Math.floor(cycle);
  
  if (phase < 0.03 || phase > 0.97) return 'New Moon 🌑';
  if (phase < 0.22) return 'Waxing Crescent 🌒';
  if (phase < 0.28) return 'First Quarter 🌓';
  if (phase < 0.47) return 'Waxing Gibbous 🌔';
  if (phase < 0.53) return 'Full Moon 🌕';
  if (phase < 0.72) return 'Waning Gibbous 🌖';
  if (phase < 0.78) return 'Last Quarter 🌗';
  return 'Waning Crescent 🌘';
}

export async function fetchLiveWeather(coord: Coordinate): Promise<OpenMeteoData> {
  const cacheKey = `${coord.lat.toFixed(4)},${coord.lng.toFixed(4)}`;
  const now = Date.now();

  if (cache.has(cacheKey)) {
    const cached = cache.get(cacheKey)!;
    if (now - cached.timestamp < CACHE_DURATION_MS) {
      return cached.data;
    }
  }

  const url = `https://api.open-meteo.com/v1/forecast?latitude=${coord.lat}&longitude=${coord.lng}&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,rain,weather_code,cloud_cover,pressure_msl,surface_pressure,wind_speed_10m,wind_direction_10m,wind_gusts_10m,dew_point_2m,snowfall&hourly=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,cloud_cover,visibility,weather_code,pressure_msl,wind_speed_10m,wind_direction_10m,wind_gusts_10m,dew_point_2m,snowfall&daily=weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset,uv_index_max&timezone=auto`;

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`OpenMeteo API Error: ${res.statusText}`);
  }

  const raw = await res.json();
  const aqiData = await fetchAirQuality(coord);

  const parsed: OpenMeteoData = {
    current: {
      time: raw.current.time,
      temperature2m: raw.current.temperature_2m,
      relativeHumidity2m: raw.current.relative_humidity_2m,
      apparentTemperature: raw.current.apparent_temperature,
      isDay: raw.current.is_day,
      precipitation: raw.current.precipitation,
      rain: raw.current.rain,
      weatherCode: raw.current.weather_code,
      cloudCover: raw.current.cloud_cover,
      pressureMsl: raw.current.pressure_msl,
      surfacePressure: raw.current.surface_pressure,
      windSpeed10m: raw.current.wind_speed_10m,
      windDirection10m: raw.current.wind_direction_10m,
      windGusts10m: raw.current.wind_gusts_10m,
      dewPoint2m: raw.current.dew_point_2m,
      snowfall: raw.current.snowfall,
    },
    hourly: {
      time: raw.hourly.time,
      temperature2m: raw.hourly.temperature_2m,
      relativeHumidity2m: raw.hourly.relative_humidity_2m,
      apparentTemperature: raw.hourly.apparent_temperature,
      precipitation: raw.hourly.precipitation,
      cloudCover: raw.hourly.cloud_cover,
      visibility: raw.hourly.visibility,
      weatherCode: raw.hourly.weather_code,
      pressureMsl: raw.hourly.pressure_msl,
      windSpeed10m: raw.hourly.wind_speed_10m,
      windDirection10m: raw.hourly.wind_direction_10m,
      windGusts10m: raw.hourly.wind_gusts_10m,
      dewPoint2m: raw.hourly.dew_point_2m,
      snowfall: raw.hourly.snowfall,
    },
    daily: {
      time: raw.daily.time,
      weatherCode: raw.daily.weather_code,
      temperature2mMax: raw.daily.temperature_2m_max,
      temperature2mMin: raw.daily.temperature_2m_min,
      sunrise: raw.daily.sunrise,
      sunset: raw.daily.sunset,
      uvIndexMax: raw.daily.uv_index_max,
    },
    extended: {
      dewPoint: Math.round(raw.current.dew_point_2m ?? (raw.current.temperature_2m - (100 - raw.current.relative_humidity_2m) / 5)),
      snowfall: raw.current.snowfall || 0,
      moonPhase: getMoonPhase(new Date()),
      airQuality: aqiData,
    },
  };

  cache.set(cacheKey, { data: parsed, timestamp: now });
  return parsed;
}
