import type { Coordinate } from '../mockData';

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
}

const cache = new Map<string, { data: OpenMeteoData; timestamp: number }>();
const CACHE_DURATION_MS = 10 * 60 * 1000;

export async function fetchLiveWeather(coord: Coordinate): Promise<OpenMeteoData> {
  const cacheKey = `${coord.lat.toFixed(4)},${coord.lng.toFixed(4)}`;
  const now = Date.now();

  if (cache.has(cacheKey)) {
    const cached = cache.get(cacheKey)!;
    if (now - cached.timestamp < CACHE_DURATION_MS) {
      return cached.data;
    }
  }

  const url = `https://api.open-meteo.com/v1/forecast?latitude=${coord.lat}&longitude=${coord.lng}&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,rain,weather_code,cloud_cover,pressure_msl,surface_pressure,wind_speed_10m,wind_direction_10m,wind_gusts_10m&hourly=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,cloud_cover,visibility,weather_code,pressure_msl,wind_speed_10m,wind_direction_10m,wind_gusts_10m&daily=weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset,uv_index_max&timezone=auto`;

  let retries = 3;
  while (retries > 0) {
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error('API Request failed');
      const json = await response.json();

      const formattedData: OpenMeteoData = {
        current: {
          time: json.current.time,
          temperature2m: json.current.temperature_2m,
          relativeHumidity2m: json.current.relative_humidity_2m,
          apparentTemperature: json.current.apparent_temperature,
          isDay: json.current.is_day,
          precipitation: json.current.precipitation,
          rain: json.current.rain,
          weatherCode: json.current.weather_code,
          cloudCover: json.current.cloud_cover,
          pressureMsl: json.current.pressure_msl,
          surfacePressure: json.current.surface_pressure,
          windSpeed10m: json.current.wind_speed_10m,
          windDirection10m: json.current.wind_direction_10m,
          windGusts10m: json.current.wind_gusts_10m,
        },
        hourly: {
          time: json.hourly.time,
          temperature2m: json.hourly.temperature_2m,
          relativeHumidity2m: json.hourly.relative_humidity_2m,
          apparentTemperature: json.hourly.apparent_temperature,
          precipitation: json.hourly.precipitation,
          cloudCover: json.hourly.cloud_cover,
          visibility: json.hourly.visibility,
          weatherCode: json.hourly.weather_code,
          pressureMsl: json.hourly.pressure_msl,
          windSpeed10m: json.hourly.wind_speed_10m,
          windDirection10m: json.hourly.wind_direction_10m,
          windGusts10m: json.hourly.wind_gusts_10m,
        },
        daily: {
          time: json.daily.time,
          weatherCode: json.daily.weather_code,
          temperature2mMax: json.daily.temperature_2m_max,
          temperature2mMin: json.daily.temperature_2m_min,
          sunrise: json.daily.sunrise,
          sunset: json.daily.sunset,
          uvIndexMax: json.daily.uv_index_max,
        }
      };

      cache.set(cacheKey, { data: formattedData, timestamp: now });
      return formattedData;
    } catch (err) {
      retries--;
      if (retries === 0) {
        if (cache.has(cacheKey)) {
          return cache.get(cacheKey)!.data;
        }
        throw err;
      }
      await new Promise(res => setTimeout(res, 1000));
    }
  }

  throw new Error("Unable to fetch live weather data.");
}

export async function reverseGeocode(lat: number, lng: number): Promise<string> {
  try {
    const response = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`, {
      headers: {
        'Accept-Language': 'en',
        'User-Agent': 'AeroTempest-AI-Weather-Platform-Upgrade-Agent'
      }
    });
    if (response.ok) {
      const data = await response.json();
      const parts = [];
      const addr = data.address;
      if (addr) {
        const cityOrTownOrVillage = addr.city || addr.town || addr.village || addr.suburb || addr.neighbourhood;
        if (cityOrTownOrVillage) parts.push(cityOrTownOrVillage);
        if (addr.county) parts.push(addr.county);
        if (addr.state) parts.push(addr.state);
        if (addr.country) parts.push(addr.country);
      }
      return parts.join(', ') || `${lat.toFixed(4)}°N, ${lng.toFixed(4)}°E`;
    }
  } catch (err) {
    console.error("Reverse geocoding error: ", err);
  }
  return `${lat.toFixed(4)}°N, ${lng.toFixed(4)}°E`;
}

export async function fetchHistoricalRange(lat: number, lng: number, startDate: string, endDate: string): Promise<any> {
  const url = `https://archive-api.open-meteo.com/v1/archive?latitude=${lat}&longitude=${lng}&start_date=${startDate}&end_date=${endDate}&daily=temperature_2m_mean,relative_humidity_2m_mean,pressure_msl_mean,wind_speed_10m_max,wind_gusts_10m_max,precipitation_sum,cloud_cover_mean&timezone=auto`;
  const response = await fetch(url);
  if (!response.ok) throw new Error("Failed to fetch archive weather data");
  return response.json();
}

export async function fetchHourlyForecast(lat: number, lng: number, days: number): Promise<any> {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&hourly=temperature_2m,relative_humidity_2m,pressure_msl,wind_speed_10m,wind_gusts_10m,precipitation,cloud_cover,visibility,weather_code,wind_direction_10m,dew_point_2m&forecast_days=${days}&timezone=auto`;
  const response = await fetch(url);
  if (!response.ok) throw new Error("Failed to fetch hourly forecast data");
  return response.json();
}
