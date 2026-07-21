import type { OpenMeteoData } from '../api/openMeteo';

export interface SevereAlert {
  id: string;
  type: 'STORM' | 'HEATWAVE' | 'COLDWAVE' | 'HEAVY_RAIN' | 'HIGH_WIND' | 'POOR_AQI';
  severity: 'CRITICAL' | 'WARNING' | 'ADVISORY';
  title: string;
  description: string;
  timestamp: string;
}

export class AlertService {
  /**
   * Evaluate environmental metrics against threshold rules to generate real-time warnings
   */
  static evaluateAlerts(weatherData?: OpenMeteoData | null, stormProbability = 0): SevereAlert[] {
    const alerts: SevereAlert[] = [];
    if (!weatherData) return alerts;

    const cur = weatherData.current;
    const aqi = weatherData.extended?.airQuality?.aqi ?? 45;
    const nowISO = new Date().toISOString();

    // 1. Storm / Cyclone Warning
    if (stormProbability > 75 || cur.windSpeed10m > 55) {
      alerts.push({
        id: 'alert_storm_' + Date.now(),
        type: 'STORM',
        severity: 'CRITICAL',
        title: 'Severe Cyclone Warning',
        description: `Extreme cyclonic pressure gradient detected. Sustained wind speeds exceeding ${Math.round(cur.windSpeed10m)} km/h.`,
        timestamp: nowISO,
      });
    }

    // 2. High Wind Warning
    if (cur.windSpeed10m > 35 && cur.windSpeed10m <= 55) {
      alerts.push({
        id: 'alert_wind_' + Date.now(),
        type: 'HIGH_WIND',
        severity: 'WARNING',
        title: 'Gale Force Wind Advisory',
        description: `Brisk wind speeds recorded at ${Math.round(cur.windSpeed10m)} km/h with gusts up to ${Math.round(cur.windGusts10m)} km/h.`,
        timestamp: nowISO,
      });
    }

    // 3. Heavy Rain / Flood Risk
    if (cur.precipitation > 10) {
      alerts.push({
        id: 'alert_rain_' + Date.now(),
        type: 'HEAVY_RAIN',
        severity: 'WARNING',
        title: 'Torrential Precipitation Risk',
        description: `Intense precipitation detected (${cur.precipitation.toFixed(1)} mm/hr). Flash flooding potential in low-lying zones.`,
        timestamp: nowISO,
      });
    }

    // 4. Heatwave Alert
    if (cur.temperature2m > 40) {
      alerts.push({
        id: 'alert_heat_' + Date.now(),
        type: 'HEATWAVE',
        severity: 'WARNING',
        title: 'Extreme Heatwave Warning',
        description: `Ambient temperature reached ${Math.round(cur.temperature2m)}°C (Feels like ${Math.round(cur.apparentTemperature)}°C).`,
        timestamp: nowISO,
      });
    }

    // 5. Coldwave Alert
    if (cur.temperature2m < 2) {
      alerts.push({
        id: 'alert_cold_' + Date.now(),
        type: 'COLDWAVE',
        severity: 'ADVISORY',
        title: 'Freezing Temperature Advisory',
        description: `Near-freezing temperatures recorded (${Math.round(cur.temperature2m)}°C). Frost formation possible.`,
        timestamp: nowISO,
      });
    }

    // 6. Poor Air Quality Alert
    if (aqi > 150) {
      alerts.push({
        id: 'alert_aqi_' + Date.now(),
        type: 'POOR_AQI',
        severity: aqi > 200 ? 'CRITICAL' : 'WARNING',
        title: 'Hazardous Air Quality Warning',
        description: `AQI index elevated at ${aqi}. Unhealthy atmospheric particulate levels ($PM2.5 / PM10$).`,
        timestamp: nowISO,
      });
    }

    return alerts;
  }
}
