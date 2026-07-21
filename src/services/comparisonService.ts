import { cities, type CityInfo } from '../mockData';

export interface ComparisonMetric {
  locationId: string;
  locationName: string;
  temp: number;
  feelsLike: number;
  humidity: number;
  pressure: number;
  windSpeed: number;
  rainfall: number;
  aqi: number;
}

export class ComparisonService {
  /**
   * Compare multiple cities across core weather and AQI metrics
   */
  static compareLocations(locationIds: string[]): ComparisonMetric[] {
    return locationIds
      .map(id => cities.find(c => c.id === id))
      .filter((c): c is CityInfo => c !== undefined)
      .map(city => ({
        locationId: city.id,
        locationName: `${city.name}, ${city.country}`,
        temp: city.baseTemp,
        feelsLike: city.baseTemp + 1.5,
        humidity: city.baseHumidity,
        pressure: city.basePressure,
        windSpeed: city.baseWindSpeed,
        rainfall: 1.2,
        aqi: 45,
      }));
  }
}
