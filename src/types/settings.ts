export type TempUnit = 'C' | 'F';
export type SpeedUnit = 'kmh' | 'mph' | 'ms' | 'knots';
export type PressureUnit = 'hPa' | 'inHg' | 'mmHg';
export type DistanceUnit = 'km' | 'mi';
export type ThemeMode = 'dark' | 'light' | 'high-contrast';
export type Language = 'en' | 'es' | 'fr' | 'hi';

export interface UserPreferences {
  tempUnit: TempUnit;
  speedUnit: SpeedUnit;
  pressureUnit: PressureUnit;
  distanceUnit: DistanceUnit;
  theme: ThemeMode;
  language: Language;
  defaultCityId: string;
  autoRefreshIntervalMinutes: number;
  enableNotifications: boolean;
}

export interface FavoriteLocation {
  id: string;
  name: string;
  state: string;
  country: string;
  lat: number;
  lng: number;
  addedAt: string;
}

export interface RecentLocation {
  id: string;
  name: string;
  lat: number;
  lng: number;
  viewedAt: string;
}
