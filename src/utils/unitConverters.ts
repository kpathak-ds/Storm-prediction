import type { TempUnit, SpeedUnit, PressureUnit, DistanceUnit } from '../types/settings';

/**
 * Temperature conversion helper
 */
export function formatTemp(tempC: number, unit: TempUnit): string {
  if (unit === 'F') {
    const tempF = Math.round((tempC * 9) / 5 + 32);
    return `${tempF}°F`;
  }
  return `${Math.round(tempC)}°C`;
}

/**
 * Wind speed conversion helper
 */
export function formatSpeed(speedKmh: number, unit: SpeedUnit): string {
  if (unit === 'mph') {
    return `${Math.round(speedKmh * 0.621371)} mph`;
  }
  if (unit === 'ms') {
    return `${(speedKmh / 3.6).toFixed(1)} m/s`;
  }
  if (unit === 'knots') {
    return `${Math.round(speedKmh * 0.539957)} kts`;
  }
  return `${Math.round(speedKmh)} km/h`;
}

/**
 * Pressure conversion helper
 */
export function formatPressure(pressureHpa: number, unit: PressureUnit): string {
  if (unit === 'inHg') {
    return `${(pressureHpa * 0.02953).toFixed(2)} inHg`;
  }
  if (unit === 'mmHg') {
    return `${Math.round(pressureHpa * 0.750062)} mmHg`;
  }
  return `${Math.round(pressureHpa)} hPa`;
}

/**
 * Distance conversion helper
 */
export function formatDistance(distanceKm: number, unit: DistanceUnit): string {
  if (unit === 'mi') {
    return `${Math.round(distanceKm * 0.621371)} mi`;
  }
  return `${Math.round(distanceKm)} km`;
}
