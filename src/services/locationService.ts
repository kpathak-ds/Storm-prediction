import { cities } from '../mockData';

export interface LocationSearchResult {
  id: string;
  name: string;
  state: string;
  country: string;
  lat: number;
  lng: number;
  type: 'city' | 'storm' | 'coords';
}

export class LocationService {
  /**
   * Search local catalog cities or coordinates
   */
  static searchLocal(query: string): LocationSearchResult[] {
    const q = query.toLowerCase().trim();
    if (!q) return [];

    // Parse lat, lng search e.g. "19.07, 72.87"
    const coordMatch = q.match(/^(-?\d+(\.\d+)?),\s*(-?\d+(\.\d+)?)$/);
    if (coordMatch) {
      const lat = parseFloat(coordMatch[1]);
      const lng = parseFloat(coordMatch[3]);
      return [
        {
          id: `custom_${lat}_${lng}`,
          name: `Pinned (${lat.toFixed(2)}, ${lng.toFixed(2)})`,
          state: `${Math.abs(lat).toFixed(2)}° ${lat >= 0 ? 'N' : 'S'}`,
          country: `${Math.abs(lng).toFixed(2)}° ${lng >= 0 ? 'E' : 'W'}`,
          lat,
          lng,
          type: 'coords',
        },
      ];
    }

    return cities
      .filter(
        c =>
          c.name.toLowerCase().includes(q) ||
          c.state.toLowerCase().includes(q) ||
          c.country.toLowerCase().includes(q)
      )
      .map(c => ({
        id: c.id,
        name: c.name,
        state: c.state,
        country: c.country,
        lat: c.coord.lat,
        lng: c.coord.lng,
        type: 'city',
      }));
  }

  /**
   * Get device current geolocation
   */
  static getCurrentPosition(): Promise<{ lat: number; lng: number }> {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation is not supported by this browser.'));
        return;
      }
      navigator.geolocation.getCurrentPosition(
        pos => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        err => reject(err),
        { timeout: 10000 }
      );
    });
  }
}
