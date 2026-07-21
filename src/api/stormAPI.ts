import type { GlobalStorm } from '../mockData';

export async function fetchActiveStorms(): Promise<GlobalStorm[]> {
  try {
    // Try direct fetch, and if it fails (CORS), fall back to public CORS proxy
    let response;
    try {
      response = await fetch('https://www.gdacs.org/xml/gdacs.geojson');
      if (!response.ok) throw new Error("Direct fetch failed");
    } catch (e) {
      console.warn("Direct GDACS fetch failed/blocked (CORS). Retrying with proxy...");
      response = await fetch('https://api.allorigins.win/raw?url=' + encodeURIComponent('https://www.gdacs.org/xml/gdacs.geojson'));
      if (!response.ok) throw new Error("CORS proxy fetch failed");
    }
    const data = await response.json();
    
    const storms: GlobalStorm[] = [];
    
    if (data && data.features) {
      // Filter for eventtype = "TC" (Tropical Cyclone)
      const tcFeatures = data.features.filter((f: any) => f.properties?.eventtype === 'TC');
      
      tcFeatures.forEach((f: any) => {
        const props = f.properties;
        if (!props) return;
        
        // Extract coordinate position from Geometry
        const lng = f.geometry?.coordinates?.[0] ?? 90.0;
        const lat = f.geometry?.coordinates?.[1] ?? 15.0;
        
        // Dynamic name mapping (e.g. Cyclone Kong-rey)
        const rawName = props.eventname || 'Unnamed Cyclone';
        const name = rawName.toUpperCase().includes('CYCLONE') || rawName.toUpperCase().includes('TYPHOON') || rawName.toUpperCase().includes('HURRICANE')
          ? rawName 
          : `Cyclone ${rawName}`;
          
        const id = props.eventid || rawName.toLowerCase().replace(/\s+/g, '-');
        const severity = props.severitydata?.severity ?? 1; // Category intensity
        const windSpeed = Math.round(props.severitydata?.value ?? 120); // sustained winds in km/h
        const pressure = Math.round(props.severitydata?.pressure ?? 970); // hPa
        
        // Map storm type based on category severity
        let type: 'Typhoon' | 'Hurricane' | 'Cyclone' | 'Tropical Storm' | 'Tropical Depression' = 'Cyclone';
        if (severity >= 4) {
          type = lng > 100 && lng < 180 ? 'Typhoon' : (lng < -20 && lng > -100 ? 'Hurricane' : 'Cyclone');
        } else if (severity >= 1) {
          type = 'Cyclone';
        } else {
          type = 'Tropical Storm';
        }

        // Generate dynamic forecast track offsets relative to present coordinates
        const track = [
          { timeOffset: -24, label: '24h Ago',   position: { lat: lat - 1.0, lng: lng - 1.2 }, pressure: pressure + 15, maxWindSpeed: Math.round(windSpeed * 0.8), gusts: Math.round(windSpeed * 1.0), direction: 'Northwest', speed: 15, radius: 240 },
          { timeOffset: -12, label: '12h Ago',   position: { lat: lat - 0.5, lng: lng - 0.6 }, pressure: pressure + 8,  maxWindSpeed: Math.round(windSpeed * 0.9), gusts: Math.round(windSpeed * 1.15), direction: 'Northwest', speed: 16, radius: 270 },
          { timeOffset:   0, label: 'Now',       position: { lat, lng },                       pressure,                 maxWindSpeed: windSpeed,                  gusts: Math.round(windSpeed * 1.3),  direction: 'Northwest', speed: 18, radius: 300 },
          { timeOffset:   6, label: '+6 Hours',  position: { lat: lat + 0.3, lng: lng + 0.4 }, pressure: pressure - 5,  maxWindSpeed: Math.round(windSpeed * 1.05), gusts: Math.round(windSpeed * 1.35), direction: 'Northwest', speed: 19, radius: 310 },
          { timeOffset:  12, label: '+12 Hours', position: { lat: lat + 0.6, lng: lng + 0.8 }, pressure: pressure + 5,  maxWindSpeed: Math.round(windSpeed * 0.95), gusts: Math.round(windSpeed * 1.25), direction: 'Northwest', speed: 20, radius: 290 },
          { timeOffset:  24, label: '+24 Hours', position: { lat: lat + 1.2, lng: lng + 1.6 }, pressure: pressure + 15, maxWindSpeed: Math.round(windSpeed * 0.8), gusts: Math.round(windSpeed * 1.0), direction: 'Northwest', speed: 22, radius: 220 },
        ];

        storms.push({
          id,
          name,
          category: Math.min(5, Math.max(0, Math.round(severity))),
          type,
          probability: Math.round(props.severitydata?.probability ?? 95),
          forecastMovement: `${props.severitydata?.direction || 'NW'} at ${Math.round(props.severitydata?.speed || 18)} km/h`,
          track
        });
      });
    }
    
    return storms;
  } catch (error) {
    console.error("GDACS API active storms fetch error:", error);
    return [];
  }
}
