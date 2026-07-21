import type { Coordinate, CityInfo } from '../mockData';
import { fetchPresentPrediction, type PresentPredictionResult } from '../api/presentService';
import { fetchPastPrediction, type PastPredictionResult } from '../api/pastService';
import { fetchFuturePrediction, type FuturePredictionResult } from '../api/futureService';

export class WeatherService {
  /**
   * Fetch present (live) weather & AI prediction
   */
  static async getPresent(coord: Coordinate): Promise<PresentPredictionResult> {
    return fetchPresentPrediction(coord);
  }

  /**
   * Fetch historical weather & AI prediction
   */
  static async getPast(coord: Coordinate, targetDate: string): Promise<PastPredictionResult> {
    return fetchPastPrediction(coord, targetDate);
  }

  /**
   * Fetch future prediction (API forecast or AI engine fallback)
   */
  static async getFuture(
    coord: Coordinate,
    targetDate: string,
    city: CityInfo
  ): Promise<FuturePredictionResult> {
    return fetchFuturePrediction(coord, targetDate, city);
  }
}
