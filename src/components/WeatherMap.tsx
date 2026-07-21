import { useEffect, useRef, useState, useCallback } from 'react';
import maplibregl from 'maplibre-gl';
import {
  cities,
  globalStorms,
  getAllStormsAtTime,
  getInterpolatedStormState,
  getCategoryLabel,
  calculateCityWeather,
  presentStorms,
  historicalStorms,
  futureStorms,
} from '../mockData';
import type { CityWeatherSnapshot } from '../mockData';
import { fetchRadarFrames, type RadarFrame } from '../api/rainViewer';
import type { BasemapType } from './BasemapSelector';
import type { UploadedKml } from './GeoPortalPanel';
import type { GisLayerDef } from '../api/gisCatalog';

interface WeatherMapProps {
  timeOffset: number;
  layers: {
    wind: boolean; rain: boolean; storm: boolean; clouds: boolean;
    pressure: boolean; humidity: boolean; temperature: boolean;
    lightning: boolean; terrain: boolean; satellite: boolean;
    borders: boolean; roads: boolean;
  };
  selectedLocationId: string | null;
  onSelectLocation: (id: string, type: 'city' | 'storm') => void;
  onMapClick?: (lat: number, lng: number) => void;
  searchTrigger: { lat: number; lng: number; zoom: number; timestamp: number } | null;
  selectedDate: string;
  activeTab: 'present' | 'past' | 'future';
  activeBasemap: BasemapType;
  activeGisLayers: Record<string, GisLayerDef & { visible: boolean; opacity: number }>;
  gibsDate: string;
  waybackRel: string;
  uploadedKmls: UploadedKml[];
  measuring: boolean;
}

function createCirclePolygon(lat: number, lng: number, radiusKm: number, numPoints = 64) {
  const kmPerDegLat = 111.32;
  const kmPerDegLng = 111.32 * Math.cos((lat * Math.PI) / 180);
  const points = [];
  for (let i = 0; i <= numPoints; i++) {
    const angle = (i * 2 * Math.PI) / numPoints;
    points.push([lng + (radiusKm * Math.cos(angle)) / kmPerDegLng, lat + (radiusKm * Math.sin(angle)) / kmPerDegLat]);
  }
  return [points];
}

function buildAllStormTracksGeoJSON(mode: 'present' | 'past' | 'future' = 'present', currentTimeOffset = 0) {
  const features: any[] = [];
  const list = mode === 'past' ? historicalStorms : (mode === 'future' ? futureStorms : presentStorms);
  list.forEach(gs => {
    const coords = gs.track.map(s => [s.position.lng, s.position.lat]);
    features.push({
      type: 'Feature',
      properties: { stormId: gs.id, category: gs.category, probability: gs.probability },
      geometry: { type: 'LineString', coordinates: coords },
    });
    gs.track.forEach(s => {
      features.push({
        type: 'Feature',
        properties: { 
          stormId: gs.id, 
          category: gs.category, 
          label: s.label, 
          timeOffset: s.timeOffset,
          expired: mode === 'past' && s.timeOffset < currentTimeOffset
        },
        geometry: { type: 'Point', coordinates: [s.position.lng, s.position.lat] },
      });
    });
  });
  return { type: 'FeatureCollection', features };
}

function buildAllHazardRingsGeoJSON(t: number, mode: 'present' | 'past' | 'future' = 'present') {
  const features: any[] = [];
  const stormStates = getAllStormsAtTime(t, mode);
  stormStates.forEach(({ storm, state }) => {
    const { lat, lng } = state.position;
    features.push({ type: 'Feature', properties: { type: 'clouds',   stormId: storm.id, category: storm.category }, geometry: { type: 'Polygon', coordinates: createCirclePolygon(lat, lng, state.radius * 1.25) } });
    features.push({ type: 'Feature', properties: { type: 'gale',     stormId: storm.id, category: storm.category }, geometry: { type: 'Polygon', coordinates: createCirclePolygon(lat, lng, state.radius * 0.8) } });
    features.push({ type: 'Feature', properties: { type: 'storm',    stormId: storm.id, category: storm.category }, geometry: { type: 'Polygon', coordinates: createCirclePolygon(lat, lng, state.radius * 0.45) } });
    features.push({ type: 'Feature', properties: { type: 'core',     stormId: storm.id, category: storm.category }, geometry: { type: 'Polygon', coordinates: createCirclePolygon(lat, lng, state.radius * 0.15) } });
  });
  return { type: 'FeatureCollection', features };
}

const cardinalToDegrees = (dir: string): number => {
  const mapping: Record<string, number> = {
    'N': 0, 'NNE': 22.5, 'NE': 45, 'ENE': 67.5,
    'E': 90, 'ESE': 112.5, 'SE': 135, 'SSE': 157.5,
    'S': 180, 'SSW': 202.5, 'SW': 225, 'WSW': 247.5,
    'W': 270, 'WNW': 292.5, 'NW': 315, 'NNW': 337.5
  };
  return mapping[dir.toUpperCase()] ?? 0;
};

interface GridPoint {
  lat: number;
  lng: number;
  temp: number;
  precip: number;
  humidity: number;
  pressure: number;
  clouds: number;
}

export default function WeatherMap({
  timeOffset, layers, selectedLocationId, onSelectLocation, onMapClick, searchTrigger, selectedDate, activeTab, activeBasemap,
  activeGisLayers, gibsDate, waybackRel, uploadedKmls, measuring,
}: WeatherMapProps) {
  void activeTab;
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef          = useRef<maplibregl.Map | null>(null);
  const canvasRef       = useRef<HTMLCanvasElement>(null);
  const heatmapCanvasRef = useRef<HTMLCanvasElement>(null);

  const [mapReady, setMapReady] = useState(false);
  const [webglSupported, setWebglSupported] = useState(true);
  const [mapMoveVersion, setMapMoveVersion] = useState(0);
  const [radarFrames, setRadarFrames] = useState<RadarFrame[]>([]);
  const [radarFrameIndex, setRadarFrameIndex] = useState(0);
  const [gridData, setGridData] = useState<GridPoint[]>([]);
  const [measurePoints, setMeasurePoints] = useState<maplibregl.LngLat[]>([]);

  const [hoveredInfo, setHoveredInfo] = useState<{
    x: number; y: number; name: string; temp: number;
    windSpeed: number; humidity: number; pressure: number; stormProb: number;
  } | null>(null);

  const lightningStrikesRef = useRef<{ id: number; lat: number; lng: number; opacity: number }[]>([]);

  const mode = activeTab;

  const allStormStates = getAllStormsAtTime(timeOffset, mode);

  // Load RainViewer Radar frames
  useEffect(() => {
    fetchRadarFrames().then(frames => {
      setRadarFrames(frames);
      setRadarFrameIndex(frames.length - 1);
    });
  }, []);

  // Local radar animation timeline playback loop
  useEffect(() => {
    if (radarFrames.length === 0) return;
    const interval = setInterval(() => {
      setRadarFrameIndex(idx => (idx + 1) % radarFrames.length);
    }, 600);
    return () => clearInterval(interval);
  }, [radarFrames]);

  const layersRef = useRef(layers);
  layersRef.current = layers;

  const selectedLocationIdRef = useRef(selectedLocationId);
  selectedLocationIdRef.current = selectedLocationId;

  const timeOffsetRef = useRef(timeOffset);
  timeOffsetRef.current = timeOffset;

  const allStormStatesRef = useRef(allStormStates);
  allStormStatesRef.current = allStormStates;

  // Generate dynamic weather parameters grid in viewport boundary
  const updateGridPoints = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    const bounds = map.getBounds();
    const minLat = bounds.getSouth();
    const maxLat = bounds.getNorth();
    const minLng = bounds.getWest();
    const maxLng = bounds.getEast();

    // Compute weather conditions for all cities at current time offset
    const cityWeatherSnapshots = cities.map(city => {
      const snap = calculateCityWeather(city, timeOffset, undefined, undefined, mode);
      return {
        lat: city.coord.lat,
        lng: city.coord.lng,
        temp: snap.weather.temp,
        precip: snap.weather.rainfall,
        humidity: snap.weather.humidity,
        pressure: snap.weather.pressure,
        clouds: snap.weather.cloudCover,
      };
    });

    const points: GridPoint[] = [];
    const steps = 12; // High-fidelity interpolation grid size
    const latStep = (maxLat - minLat) / steps;
    const lngStep = (maxLng - minLng) / steps;

    for (let i = 0; i <= steps; i++) {
      const lat = minLat + i * latStep;
      for (let j = 0; j <= steps; j++) {
        const lng = minLng + j * lngStep;

        // Perform Inverse Distance Weighting (IDW) interpolation from nearest cities
        let sumWeight = 0;
        let tempSum = 0;
        let precipSum = 0;
        let humiditySum = 0;
        let pressureSum = 0;
        let cloudsSum = 0;

        cityWeatherSnapshots.forEach(c => {
          const dLat = c.lat - lat;
          const dLng = c.lng - lng;
          const distSq = dLat*dLat + dLng*dLng;
          const w = 1 / (Math.sqrt(distSq) + 0.5); // IDW Weighting
          sumWeight += w;
          tempSum += c.temp * w;
          precipSum += c.precip * w;
          humiditySum += c.humidity * w;
          pressureSum += c.pressure * w;
          cloudsSum += c.clouds * w;
        });

        const temp = tempSum / sumWeight;
        const precip = precipSum / sumWeight;
        const humidity = Math.min(100, Math.round(humiditySum / sumWeight));
        const pressure = Math.round(pressureSum / sumWeight);
        const clouds = Math.min(100, Math.round(cloudsSum / sumWeight));

        points.push({ lat, lng, temp, precip, humidity, pressure, clouds });
      }
    }
    setGridData(points);
  }, [timeOffset]);

  // Update grid points when controls change
  useEffect(() => {
    if (mapReady) {
      updateGridPoints();
    }
  }, [timeOffset, activeTab, selectedDate, mode, mapReady, updateGridPoints]);

  // ── 1. Initialize Map ─────────────────────────────────────
  useEffect(() => {
    if (!mapContainerRef.current) return;

    const isSupported = (maplibregl as any).supported 
      ? (maplibregl as any).supported() 
      : (() => {
          try {
            const canvas = document.createElement('canvas');
            return !!(window.WebGLRenderingContext && (canvas.getContext('webgl') || canvas.getContext('experimental-webgl')));
          } catch {
            return false;
          }
        })();

    if (!isSupported) {
      setWebglSupported(false);
      return;
    }

    let map: maplibregl.Map;
    try {
      map = new maplibregl.Map({
        container: mapContainerRef.current,
        style: {
          version: 8,
          sources: {
            'carto-dark': {
              type: 'raster',
              tiles: [
                'https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
                'https://b.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
                'https://c.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
                'https://d.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
              ],
              tileSize: 256,
              attribution: '&copy; <a href="https://carto.com/">CARTO</a> &copy; <a href="https://openstreetmap.org">OSM</a>',
              maxzoom: 15,
            },
          },
          layers: [{ id: 'carto-dark-layer', type: 'raster', source: 'carto-dark', minzoom: 0, maxzoom: 20 }],
        },
        center: [78.9629, 20.5937],
        zoom: 4.6,
        maxZoom: 18,
        minZoom: 1.5,
        maxPitch: 85,
      });
    } catch (e) {
      console.error("Failed to initialize MapLibre GL:", e);
      setWebglSupported(false);
      return;
    }

    mapRef.current = map;
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'bottom-right');

    map.on('load', () => {
      // Add RGB Terrain source for 3D elevation
      map.addSource('terrain-rgb', {
        type: 'raster-dem',
        tiles: ['https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'],
        encoding: 'terrarium',
        tileSize: 256,
        maxzoom: 15,
      });
      // Register all basemap sources & layers
      map.addSource('osm-basemap', {
        type: 'raster',
        tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
        tileSize: 256,
        maxzoom: 19
      });
      map.addLayer({ id: 'osm-layer', type: 'raster', source: 'osm-basemap', layout: { visibility: activeBasemap === 'osm' ? 'visible' : 'none' } });

      map.addSource('esri-sat-basemap', {
        type: 'raster',
        tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
        tileSize: 256,
        maxzoom: 19
      });
      const showEsriSat = activeBasemap === 'esri' || (layers.satellite && activeBasemap === 'dark');
      map.addLayer({ id: 'esri-sat-layer', type: 'raster', source: 'esri-sat-basemap', layout: { visibility: showEsriSat ? 'visible' : 'none' } });

      map.addSource('google-sat-basemap', {
        type: 'raster',
        tiles: ['https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}'],
        tileSize: 256,
        maxzoom: 20
      });
      map.addLayer({ id: 'google-sat-layer', type: 'raster', source: 'google-sat-basemap', layout: { visibility: activeBasemap === 'google-sat' ? 'visible' : 'none' } });

      map.addSource('google-hyb-basemap', {
        type: 'raster',
        tiles: ['https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}'],
        tileSize: 256,
        maxzoom: 20
      });
      map.addLayer({ id: 'google-hyb-layer', type: 'raster', source: 'google-hyb-basemap', layout: { visibility: activeBasemap === 'google-hyb' ? 'visible' : 'none' } });

      map.addSource('esri-topo-basemap', {
        type: 'raster',
        tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}'],
        tileSize: 256,
        maxzoom: 19
      });
      map.addLayer({ id: 'esri-topo-layer', type: 'raster', source: 'esri-topo-basemap', layout: { visibility: activeBasemap === 'topo' ? 'visible' : 'none' } });

      map.addSource('esri-ocean-basemap', {
        type: 'raster',
        tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/Ocean/World_Ocean_Base/MapServer/tile/{z}/{y}/{x}'],
        tileSize: 256,
        maxzoom: 19
      });
      map.addLayer({ id: 'esri-ocean-layer', type: 'raster', source: 'esri-ocean-basemap', layout: { visibility: activeBasemap === 'ocean' ? 'visible' : 'none' } });

      map.addSource('carto-labels', { 
        type: 'raster', 
        tiles: ['https://a.basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}.png'], 
        tileSize: 256,
        maxzoom: 15,
      });
      map.addLayer({ id: 'labels-layer', type: 'raster', source: 'carto-labels', paint: { 'raster-opacity': 0.9 } });

      map.addSource('storm-track-source', { type: 'geojson', data: buildAllStormTracksGeoJSON() });
      map.addLayer({
        id: 'storm-track-line',
        type: 'line',
        source: 'storm-track-source',
        filter: ['==', '$type', 'LineString'],
        paint: { 'line-color': '#a855f7', 'line-width': 2.5, 'line-dasharray': [2, 2] },
      });
      map.addLayer({
        id: 'storm-track-nodes',
        type: 'circle',
        source: 'storm-track-source',
        filter: ['==', '$type', 'Point'],
        paint: { 'circle-radius': 4, 'circle-color': '#d8b4fe', 'circle-stroke-width': 1.5, 'circle-stroke-color': '#a855f7' },
      });

      map.addSource('storm-hazard-source', { type: 'geojson', data: buildAllHazardRingsGeoJSON(0) });
      map.addLayer({ id: 'storm-hazard-clouds',   type: 'fill', source: 'storm-hazard-source', filter: ['==', 'type', 'clouds'],  paint: { 'fill-color': '#ffffff', 'fill-opacity': 0.06 } });
      map.addLayer({ id: 'storm-hazard-gale',     type: 'fill', source: 'storm-hazard-source', filter: ['==', 'type', 'gale'],    paint: { 'fill-color': '#eab308', 'fill-opacity': 0.12 } });
      map.addLayer({ id: 'storm-hazard-storm',    type: 'fill', source: 'storm-hazard-source', filter: ['==', 'type', 'storm'],   paint: { 'fill-color': '#f97316', 'fill-opacity': 0.20 } });
      map.addLayer({ id: 'storm-hazard-eye-wall', type: 'fill', source: 'storm-hazard-source', filter: ['==', 'type', 'core'],    paint: { 'fill-color': '#ef4444', 'fill-opacity': 0.35 } });

      map.addSource('measure-source', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] }
      });
      map.addLayer({
        id: 'measure-line',
        type: 'line',
        source: 'measure-source',
        paint: {
          'line-color': '#f59e0b',
          'line-width': 2.5,
          'line-dasharray': [2, 2]
        }
      });
      map.addLayer({
        id: 'measure-nodes',
        type: 'circle',
        source: 'measure-source',
        paint: {
          'circle-radius': 5,
          'circle-color': '#f59e0b',
          'circle-stroke-width': 2,
          'circle-stroke-color': '#ffffff'
        }
      });

      map.addSource('radar-tiles', {
        type: 'raster',
        tiles: ['about:blank'],
        tileSize: 256,
        maxzoom: 7,
      });
      map.addLayer({ id: 'radar-tiles-layer', type: 'raster', source: 'radar-tiles', layout: { visibility: 'none' }, paint: { 'raster-opacity': 0.65 } });

      map.addSource('state-highlight-source', {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: []
        }
      });
      map.addLayer({
        id: 'state-highlight-glow',
        type: 'fill',
        source: 'state-highlight-source',
        paint: {
          'fill-color': '#0ea5e9',
          'fill-opacity': 0.12,
        }
      });
      map.addLayer({
        id: 'state-highlight-outline',
        type: 'line',
        source: 'state-highlight-source',
        paint: {
          'line-color': '#38bdf8',
          'line-width': 2.5,
          'line-dasharray': [3, 2]
        }
      });

      // Add India State/District Borders Layer
      map.addSource('india-borders-source', {
        type: 'geojson',
        data: 'https://raw.githubusercontent.com/sab99r/Subdivisions-of-India/master/india_states.geojson'
      });
      map.addLayer({
        id: 'india-borders-layer',
        type: 'line',
        source: 'india-borders-source',
        paint: {
          'line-color': '#ec4899', // text-pink-400 color matches LayerControls.tsx
          'line-width': 1.2,
          'line-opacity': 0.65
        },
        layout: {
          visibility: layers.borders ? 'visible' : 'none'
        }
      });

      updateGridPoints();
      setMapReady(true);
    });

    const updateDomMarkers = () => {
      const elements = document.querySelectorAll('.custom-map-marker');
      elements.forEach(el => {
        const lat = parseFloat(el.getAttribute('data-lat') || '0');
        const lng = parseFloat(el.getAttribute('data-lng') || '0');
        const pt = map.project(new maplibregl.LngLat(lng, lat));
        (el as HTMLElement).style.left = `${pt.x}px`;
        (el as HTMLElement).style.top = `${pt.y}px`;
      });
    };
    map.on('move', updateDomMarkers);

    const onMoveEnd = () => {
      setMapMoveVersion(v => v + 1);
      updateGridPoints();
    };
    map.on('moveend', onMoveEnd);
    map.on('zoomend', onMoveEnd);



    return () => {
      map.off('move', updateDomMarkers);
      map.off('moveend', onMoveEnd);
      map.off('zoomend', onMoveEnd);
      map.remove();
      mapRef.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Manage measuring click handler
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    const handleMapClickEvent = (e: maplibregl.MapMouseEvent) => {
      if (measuring) {
        setMeasurePoints(prev => {
          const next = [...prev, e.lngLat];
          const src = map.getSource('measure-source') as maplibregl.GeoJSONSource;
          if (src) {
            const coordinates = next.map(p => [p.lng, p.lat]);
            const features: any[] = [
              {
                type: 'Feature',
                geometry: { type: 'LineString', coordinates }
              },
              {
                type: 'Feature',
                geometry: {
                  type: 'MultiPoint',
                  coordinates
                }
              }
            ];
            src.setData({ type: 'FeatureCollection', features });
          }
          return next;
        });
      } else {
        if (onMapClick) onMapClick(e.lngLat.lat, e.lngLat.lng);
      }
    };

    map.on('click', handleMapClickEvent);
    return () => {
      map.off('click', handleMapClickEvent);
    };
  }, [measuring, onMapClick, mapReady]);

  // Clear measuring path when disabled
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    if (!measuring) {
      setMeasurePoints([]);
      const src = map.getSource('measure-source') as maplibregl.GeoJSONSource;
      if (src) {
        src.setData({ type: 'FeatureCollection', features: [] });
      }
    }
  }, [measuring, mapReady]);

  // ── 2. Fly to search result ───────────────────────────────
  useEffect(() => {
    if (searchTrigger && mapRef.current) {
      mapRef.current.flyTo({ center: [searchTrigger.lng, searchTrigger.lat], zoom: searchTrigger.zoom, essential: true, speed: 1.2 });
    }
  }, [searchTrigger]);

  // ── 3. Sync layer visibility toggles & update GeoJSON ──────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;

    // Sync active basemap visibility
    const showEsriSat = activeBasemap === 'esri' || (layers.satellite && activeBasemap === 'dark');
    const basemapLayers = {
      'osm-layer': activeBasemap === 'osm',
      'esri-sat-layer': showEsriSat,
      'google-sat-layer': activeBasemap === 'google-sat',
      'google-hyb-layer': activeBasemap === 'google-hyb',
      'esri-topo-layer': activeBasemap === 'topo',
      'esri-ocean-layer': activeBasemap === 'ocean',
    };

    Object.entries(basemapLayers).forEach(([layerId, visible]) => {
      if (map.getLayer(layerId)) {
        map.setLayoutProperty(layerId, 'visibility', visible ? 'visible' : 'none');
      }
    });

    if (map.getLayer('labels-layer')) {
      const showLabels = activeBasemap !== 'google-hyb';
      map.setLayoutProperty('labels-layer', 'visibility', showLabels ? 'visible' : 'none');
    }

    if (map.getLayer('india-borders-layer')) map.setLayoutProperty('india-borders-layer', 'visibility', layers.borders ? 'visible' : 'none');

    // Sync base map roads & labels visibility
    const styleLayers = map.getStyle().layers;
    if (styleLayers) {
      styleLayers.forEach(lyr => {
        const idLower = lyr.id.toLowerCase();
        if (idLower.includes('road') || idLower.includes('highway') || idLower.includes('bridge') || idLower.includes('tunnel') || idLower.includes('rail')) {
          map.setLayoutProperty(lyr.id, 'visibility', layers.roads ? 'visible' : 'none');
        }
        if (idLower.includes('label') || idLower.includes('place') || idLower.includes('poi') || idLower.includes('town') || idLower.includes('city')) {
          if (lyr.id !== 'labels-layer') {
            map.setLayoutProperty(lyr.id, 'visibility', layers.roads ? 'visible' : 'none');
          }
        }
      });
    }

    if (map.getLayer('labels-layer')) {
      map.setLayoutProperty('labels-layer', 'visibility', (layers.roads || layers.borders) ? 'visible' : 'none');
      map.setPaintProperty('labels-layer', 'raster-opacity', layers.roads ? 0.9 : 0.4);
    }

    const trackSrc = map.getSource('storm-track-source') as maplibregl.GeoJSONSource;
    if (trackSrc) trackSrc.setData(buildAllStormTracksGeoJSON(mode, timeOffset));

    const trackColor = mode === 'past' ? '#f97316' : (mode === 'future' ? '#a855f7' : '#22c55e');

    if (map.getLayer('storm-track-line')) {
      map.setLayoutProperty('storm-track-line',  'visibility', layers.storm ? 'visible' : 'none');
      map.setPaintProperty('storm-track-line', 'line-color', trackColor);
    }
    if (map.getLayer('storm-track-nodes')) {
      map.setLayoutProperty('storm-track-nodes', 'visibility', layers.storm ? 'visible' : 'none');
      map.setPaintProperty('storm-track-nodes', 'circle-color', [
        'case',
        ['get', 'expired'],
        '#64748b',
        trackColor
      ]);
      map.setPaintProperty('storm-track-nodes', 'circle-stroke-color', [
        'case',
        ['get', 'expired'],
        '#475569',
        trackColor
      ]);
    }

    const hazardSrc = map.getSource('storm-hazard-source') as maplibregl.GeoJSONSource;
    if (hazardSrc) hazardSrc.setData(buildAllHazardRingsGeoJSON(timeOffset, mode));

    const tog = (id: string, on: boolean) => { if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', on ? 'visible' : 'none'); };
    tog('storm-hazard-gale',     layers.storm || layers.rain);
    tog('storm-hazard-storm',    layers.storm || layers.wind);
    tog('storm-hazard-eye-wall', layers.storm);
    tog('storm-hazard-clouds',   layers.clouds);

    tog('radar-tiles-layer', layers.rain);

    // Sync 3D Terrain
    if (layers.terrain) {
      if (!map.getTerrain()) {
        map.setTerrain({ source: 'terrain-rgb', exaggeration: 1.5 });
        map.easeTo({ pitch: 45, duration: 1000 });
      }
    } else {
      if (map.getTerrain()) {
        map.setTerrain(null);
        map.easeTo({ pitch: 0, duration: 1000 });
      }
    }

    // Sync active WMS/XYZ/GIBS/Wayback layers
    Object.entries(activeGisLayers).forEach(([id, l]) => {
      const gisLyrId = `gis-layer-${id}`;
      const srcId = `gis-src-${id}`;

      if (l.visible) {
        if (!map.getLayer(gisLyrId)) {
          let urlTemplate = '';
          if (l.type === 'xyz' && l.url) {
            urlTemplate = l.url;
          } else if (l.type === 'wms' && l.url && l.wmsLayer) {
            urlTemplate = `${l.url}?service=WMS&version=1.1.1&request=GetMap&layers=${l.wmsLayer}&styles=&format=image/png&transparent=true&width=256&height=256&srs=EPSG:3857&bbox={bbox-epsg-3857}`;
          } else if (l.type === 'gibs' && l.gibsId && l.gibsMatrix && l.gibsExt) {
            urlTemplate = `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/${l.gibsId}/default/${gibsDate}/${l.gibsMatrix}/{z}/{y}/{x}.${l.gibsExt}`;
          } else if (l.type === 'wayback') {
            urlTemplate = `https://wayback.maptiles.arcgis.com/arcgis/rest/services/world_imagery/wmts/1.0.0/default028mm/mapserver/tile/${waybackRel || '0'}/{z}/{y}/{x}`;
          }

          if (urlTemplate) {
            map.addSource(srcId, {
              type: 'raster',
              tiles: [urlTemplate],
              tileSize: 256,
            });
            map.addLayer({
              id: gisLyrId,
              type: 'raster',
              source: srcId,
              layout: { visibility: 'visible' },
              paint: { 'raster-opacity': l.opacity }
            });
          }
        } else {
          map.setLayoutProperty(gisLyrId, 'visibility', 'visible');
          map.setPaintProperty(gisLyrId, 'raster-opacity', l.opacity);

          const src = map.getSource(srcId) as any;
          if (src) {
            let nextTileUrl = '';
            if (l.type === 'gibs' && l.gibsId && l.gibsMatrix && l.gibsExt) {
              nextTileUrl = `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/${l.gibsId}/default/${gibsDate}/${l.gibsMatrix}/{z}/{y}/{x}.${l.gibsExt}`;
            } else if (l.type === 'wayback') {
              nextTileUrl = `https://wayback.maptiles.arcgis.com/arcgis/rest/services/world_imagery/wmts/1.0.0/default028mm/mapserver/tile/${waybackRel || '0'}/{z}/{y}/{x}`;
            }
            if (nextTileUrl) {
              src.setTiles([nextTileUrl]);
            }
          }
        }
      } else {
        if (map.getLayer(gisLyrId)) {
          map.setLayoutProperty(gisLyrId, 'visibility', 'none');
        }
      }
    });

    // Sync uploaded KML tracks
    uploadedKmls.forEach(k => {
      const srcId = `kml-src-${k.id}`;
      const lineLyrId = `kml-line-${k.id}`;
      const fillLyrId = `kml-fill-${k.id}`;

      if (!map.getSource(srcId)) {
        map.addSource(srcId, { type: 'geojson', data: k.geojson });

        map.addLayer({
          id: fillLyrId,
          type: 'fill',
          source: srcId,
          layout: { visibility: k.visible ? 'visible' : 'none' },
          paint: {
            'fill-color': k.color,
            'fill-opacity': k.opacity * 0.28
          }
        });

        map.addLayer({
          id: lineLyrId,
          type: 'line',
          source: srcId,
          layout: { visibility: k.visible ? 'visible' : 'none' },
          paint: {
            'line-color': k.color,
            'line-width': 2.2,
            'line-opacity': k.opacity
          }
        });
      } else {
        if (map.getLayer(fillLyrId)) {
          map.setLayoutProperty(fillLyrId, 'visibility', k.visible ? 'visible' : 'none');
          map.setPaintProperty(fillLyrId, 'fill-opacity', k.opacity * 0.28);
        }
        if (map.getLayer(lineLyrId)) {
          map.setLayoutProperty(lineLyrId, 'visibility', k.visible ? 'visible' : 'none');
          map.setPaintProperty(lineLyrId, 'line-opacity', k.opacity);
        }
      }
    });

    // Remove deleted KML tracks
    const activeKmlIds = new Set(uploadedKmls.map(k => k.id));
    const layersOnMap = map.getStyle().layers;
    if (layersOnMap) {
      layersOnMap.forEach(lyr => {
        if (lyr.id.startsWith('kml-line-') || lyr.id.startsWith('kml-fill-')) {
          const kmlId = lyr.id.replace('kml-line-', '').replace('kml-fill-', '');
          if (!activeKmlIds.has(kmlId)) {
            if (map.getLayer(lyr.id)) map.removeLayer(lyr.id);
            const srcId = `kml-src-${kmlId}`;
            if (map.getSource(srcId)) map.removeSource(srcId);
          }
        }
      });
    }

  }, [timeOffset, layers, mapReady, mode, activeBasemap, activeGisLayers, gibsDate, waybackRel, uploadedKmls]);

  // ── 3.5 Update selected state highlight region ────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    const stateHighlightSrc = map.getSource('state-highlight-source') as maplibregl.GeoJSONSource;
    if (stateHighlightSrc) {
      if (selectedLocationId) {
        const city = cities.find(c => c.id === selectedLocationId);
        if (city) {
          const poly = createCirclePolygon(city.coord.lat, city.coord.lng, 180); // 180 km radius highlight
          stateHighlightSrc.setData({
            type: 'FeatureCollection',
            features: [{
              type: 'Feature',
              properties: {},
              geometry: {
                type: 'Polygon',
                coordinates: poly
              }
            }]
          });
        }
      } else {
        stateHighlightSrc.setData({
          type: 'FeatureCollection',
          features: []
        });
      }
    }
  }, [selectedLocationId, mapReady]);

  // ── 4. Update Radar frame tile path source ────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded() || !layers.rain || radarFrames.length === 0) return;
    
    const frame = radarFrames[radarFrameIndex];
    if (!frame) return;

    const radarSource = map.getSource('radar-tiles') as any;
    if (radarSource) {
      const tileUrl = `https://tilecache.rainviewer.com${frame.path}/256/{z}/{x}/{y}/2/1_1.png`;
      radarSource.tiles = [tileUrl];
      
      const style = map.style as any;
      if (style && style.sourceCaches && style.sourceCaches['radar-tiles']) {
        style.sourceCaches['radar-tiles'].update(map.transform);
      }
      map.triggerRepaint();
    }
  }, [radarFrameIndex, radarFrames, layers.rain]);

  // ── 5. Draw static parameter overlays (Full-bleed Zoom Earth/Windy interpolation style) ──
  useEffect(() => {
    const canvas = heatmapCanvasRef.current;
    const map = mapRef.current;
    if (!canvas || !map) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (mapContainerRef.current) {
      const w = mapContainerRef.current.clientWidth;
      const h = mapContainerRef.current.clientHeight;
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (gridData.length === 0) return;

    const renderTemp = layers.temperature;
    const renderRain = layers.rain;
    const renderHumid = layers.humidity;
    const renderPress = layers.pressure;
    const renderCloud = layers.clouds;

    if (!renderTemp && !renderRain && !renderHumid && !renderPress && !renderCloud) return;

    const width = canvas.width;
    const height = canvas.height;
    const cellSize = 16;

    // Pre-project coordinates to optimize lookup from O(N * cells) to O(N + cells)
    const projectedPoints = gridData.map(pt => {
      const screenPt = map.project(new maplibregl.LngLat(pt.lng, pt.lat));
      return { pt, x: screenPt.x, y: screenPt.y };
    });

    const interpolateValue = (x: number, y: number, key: keyof GridPoint) => {
      let sumWeight = 0;
      let weightedSum = 0;

      for (let i = 0; i < projectedPoints.length; i++) {
        const p = projectedPoints[i];
        const dx = p.x - x;
        const dy = p.y - y;
        const distSq = dx * dx + dy * dy;

        if (distSq < 16) { // Close enough to return exact value
          return p.pt[key];
        }

        const w = 1 / (distSq * distSq); // Inverse distance to the 4th power for sharp local blending
        sumWeight += w;
        weightedSum += p.pt[key] * w;
      }

      if (sumWeight === 0) return 0;
      return weightedSum / sumWeight;
    };

    if (renderTemp || renderRain || renderHumid || renderCloud) {
      // Use CSS blur filter to blend cell boxes into a beautiful high-fidelity smooth gradient exactly like Zoom Earth!
      ctx.filter = 'blur(24px)';
      
      for (let y = -cellSize; y < height + cellSize; y += cellSize) {
        for (let x = -cellSize; x < width + cellSize; x += cellSize) {
          ctx.beginPath();
          
          let color = 'transparent';
          if (renderTemp) {
            const temp = interpolateValue(x, y, 'temp');
            // Premium Zoom Earth temperature scale: Purple (>40) -> Red (>35) -> Orange (>30) -> Yellow (>20) -> Green (>10) -> Blue (<10)
            if (temp > 40)      color = `rgba(147, 51, 234, 0.55)`; // Purple
            else if (temp > 35) color = `rgba(239, 68, 68, 0.50)`; // Red
            else if (temp > 30) color = `rgba(249, 115, 22, 0.45)`; // Orange
            else if (temp > 25) color = `rgba(245, 158, 11, 0.40)`; // Amber
            else if (temp > 20) color = `rgba(234, 179, 8, 0.35)`; // Yellow
            else if (temp > 10) color = `rgba(34, 197, 94, 0.30)`; // Green
            else                color = `rgba(59, 130, 246, 0.35)`; // Blue
          } else if (renderRain) {
            const rain = interpolateValue(x, y, 'precip');
            // Premium precipitation scale: Teal -> Blue -> Magenta
            if (rain > 30)      color = `rgba(217, 70, 239, 0.48)`;
            else if (rain > 15) color = `rgba(29, 78, 216, 0.42)`;
            else if (rain > 5)  color = `rgba(6, 182, 212, 0.35)`;
            else if (rain > 0.5) color = `rgba(186, 230, 253, 0.22)`;
          } else if (renderHumid) {
            const hum = interpolateValue(x, y, 'humidity');
            if (hum > 80)      color = `rgba(14, 116, 144, 0.42)`;
            else if (hum > 60) color = `rgba(6, 182, 212, 0.30)`;
            else if (hum > 40) color = `rgba(165, 243, 252, 0.18)`;
          } else if (renderCloud) {
            const cloud = interpolateValue(x, y, 'clouds');
            if (cloud > 70)      color = `rgba(241, 245, 249, 0.40)`;
            else if (cloud > 45) color = `rgba(203, 213, 225, 0.25)`;
            else if (cloud > 15) color = `rgba(148, 163, 184, 0.15)`;
          }

          ctx.fillStyle = color;
          ctx.fillRect(x, y, cellSize + 2, cellSize + 2); // Overlap slightly to prevent tiny grid lines during blur
        }
      }
      ctx.filter = 'none'; // Reset filter
    }

    if (renderPress) {
      ctx.filter = 'none';
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.22)';
      ctx.lineWidth = 1.3;
      ctx.font = '9px monospace';
      ctx.fillStyle = 'rgba(165, 243, 252, 0.85)';

      const isobars = [980, 990, 1000, 1008, 1012];
      
      allStormStatesRef.current.forEach(({ state }) => {
        const center = map.project(new maplibregl.LngLat(state.position.lng, state.position.lat));
        isobars.forEach((pressVal, index) => {
          const radius = (pressVal - 935) * 4.5;
          ctx.beginPath();
          ctx.arc(center.x, center.y, radius, 0, 2 * Math.PI);
          ctx.stroke();

          const labelAngle = (index * 45 * Math.PI) / 180;
          const lx = center.x + radius * Math.cos(labelAngle);
          const ly = center.y + radius * Math.sin(labelAngle);
          if (lx > 0 && lx < width && ly > 0 && ly < height) {
            ctx.fillText(`${pressVal} hPa`, lx - 15, ly);
          }
        });
      });

      // Draw isobar contours around low pressure cities
      cities.forEach(city => {
        const snap = calculateCityWeather(city, timeOffset, undefined, undefined, mode);
        const p = snap.weather.pressure;
        if (p < 1010) {
          const center = map.project(new maplibregl.LngLat(city.coord.lng, city.coord.lat));
          const radius = (1013 - p) * 10;
          ctx.beginPath();
          ctx.arc(center.x, center.y, radius, 0, 2 * Math.PI);
          ctx.stroke();
          ctx.fillText(`${p} hPa`, center.x - 18, center.y + radius + 10);
        }
      });
    }

  }, [timeOffset, layers.temperature, layers.rain, layers.humidity, layers.pressure, layers.clouds, mapMoveVersion, gridData]);

  // ── 6. Canvas Overlay: Wind Particles & Lightning animation loop ──
  useEffect(() => {
    const map    = mapRef.current;
    const canvas = canvasRef.current;
    if (!map || !canvas || !mapReady) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let particles: Array<{ x: number; y: number; age: number; maxAge: number; vx: number; vy: number }> = [];
    let ro: ResizeObserver | null = null;

    const initParticles = () => {
      particles = [];
      const count = 450;
      const w = canvas.width || window.innerWidth;
      const h = canvas.height || window.innerHeight;
      for (let i = 0; i < count; i++) {
        particles.push({
          x: Math.random() * w,
          y: Math.random() * h,
          age: Math.random() * 120,
          maxAge: 100 + Math.random() * 80,
          vx: 0,
          vy: 0
        });
      }
    };

    const resizeCanvas = () => {
      if (!mapContainerRef.current) return;
      const w = mapContainerRef.current.clientWidth;
      const h = mapContainerRef.current.clientHeight;
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width  = w;
        canvas.height = h;
        initParticles();
      }
    };

    // Initial size setup
    if (mapContainerRef.current) {
      canvas.width = mapContainerRef.current.clientWidth || window.innerWidth;
      canvas.height = mapContainerRef.current.clientHeight || window.innerHeight;
    } else {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    }
    ro = new ResizeObserver(resizeCanvas);
    if (mapContainerRef.current) ro.observe(mapContainerRef.current);
    map.on('move', resizeCanvas);
    map.on('zoom', resizeCanvas);

    initParticles();

    const drawWindParticles = () => {
      if (!layersRef.current.wind) return;

      // Draw premium trailing lines to make particle paths look exactly like Windy/Zoom Earth!
      ctx.lineWidth = 1.1;
      
      particles.forEach(p => {
        let dx = 0;
        let dy = 0;
        let nearestDist = 99999;
        let windSpeedMult = 1.0;

        const isStormSelected = selectedLocationIdRef.current && globalStorms.some(s => s.id === selectedLocationIdRef.current);

        if (isStormSelected) {
          allStormStatesRef.current.forEach(({ storm, state }) => {
            if (storm.id === selectedLocationIdRef.current) {
              const stormCenter = map.project(new maplibregl.LngLat(state.position.lng, state.position.lat));
              const distanceX = p.x - stormCenter.x;
              const distanceY = p.y - stormCenter.y;
              const dist = Math.sqrt(distanceX * distanceX + distanceY * distanceY);

              if (dist < nearestDist) {
                nearestDist = dist;
                dx = distanceX;
                dy = distanceY;
                windSpeedMult = Math.max(0.5, (state.maxWindSpeed / 100));
              }
            }
          });
        }

        if (nearestDist === 99999) {
          // Default ambient wind blowing West to East
          p.vx = 0.85 + Math.sin(p.y / 120) * 0.25;
          p.vy = 0.12 + Math.cos(p.x / 120) * 0.15;
        } else {
          if (nearestDist === 0) nearestDist = 1;
          p.vx = (-dy / nearestDist) * 1.8 * windSpeedMult - (dx / nearestDist) * 0.35 * windSpeedMult;
          p.vy = (dx / nearestDist) * 1.8 * windSpeedMult - (dy / nearestDist) * 0.35 * windSpeedMult;
        }

        // Draw trail line from old coordinates to new coordinates
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x + p.vx, p.y + p.vy);
        
        // Dynamic opacity based on wind speed velocity
        const speed = Math.sqrt(p.vx*p.vx + p.vy*p.vy);
        ctx.strokeStyle = `rgba(240, 249, 255, ${Math.min(0.85, 0.35 + speed * 0.12)})`;
        ctx.stroke();

        p.x += p.vx;
        p.y += p.vy;
        p.age++;

        if (p.age > p.maxAge || p.x < 0 || p.x > canvas.width || p.y < 0 || p.y > canvas.height) {
          p.x = Math.random() * canvas.width;
          p.y = Math.random() * canvas.height;
          p.age = 0;
          p.maxAge = 100 + Math.random() * 80;
        }
      });
    };

    const handleLightning = () => {
      if (!layersRef.current.lightning) return;
      if (Math.random() < 0.04 && lightningStrikesRef.current.length < 3) {
        const angle    = Math.random() * 2 * Math.PI;
        const distance = 40 + Math.random() * 120;
        const kmLat    = 111.32;
        const currentPrimaryStorm = getInterpolatedStormState(timeOffsetRef.current, globalStorms[0].track);
        const kmLng    = 111.32 * Math.cos((currentPrimaryStorm.position.lat * Math.PI) / 180);
        lightningStrikesRef.current.push({
          id:      Math.random(),
          lat:     currentPrimaryStorm.position.lat + (distance * Math.sin(angle)) / kmLat,
          lng:     currentPrimaryStorm.position.lng + (distance * Math.cos(angle)) / kmLng,
          opacity: 1.0,
        });
      }
    };

    const drawLightning = () => {
      if (!layersRef.current.lightning || lightningStrikesRef.current.length === 0) return;
      lightningStrikesRef.current.forEach(strike => {
        const pt  = map.project(new maplibregl.LngLat(strike.lng, strike.lat));
        const grd = ctx.createRadialGradient(pt.x, pt.y, 2, pt.x, pt.y, 45);
        grd.addColorStop(0,   `rgba(253,224,71,${strike.opacity * 0.8})`);
        grd.addColorStop(0.3, `rgba(253,224,71,${strike.opacity * 0.3})`);
        grd.addColorStop(1,   'rgba(253,224,71,0)');
        ctx.fillStyle = grd;
        ctx.beginPath(); ctx.arc(pt.x, pt.y, 45, 0, 2 * Math.PI); ctx.fill();
        ctx.strokeStyle = `rgba(255,255,255,${strike.opacity})`;
        ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.moveTo(pt.x, pt.y - 30);
        let cx = pt.x, cy = pt.y - 30;
        for (let i = 0; i < 4; i++) { cx += (Math.random() - 0.5) * 16; cy += 8; ctx.lineTo(cx, cy); }
        ctx.stroke();
      });
      lightningStrikesRef.current = lightningStrikesRef.current
        .map(s => ({ ...s, opacity: s.opacity - 0.08 }))
        .filter(s => s.opacity > 0);
    };

    const tick = () => {
      // Partially fade out previous frame to create beautiful flowing wind streamlines (trails)
      ctx.globalCompositeOperation = 'destination-out';
      ctx.fillStyle = 'rgba(0, 0, 0, 0.12)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.globalCompositeOperation = 'source-over';
      
      drawWindParticles();
      handleLightning();
      drawLightning();
      animId = requestAnimationFrame(tick);
    };
    tick();

    return () => {
      cancelAnimationFrame(animId);
      if (ro) ro.disconnect();
      map.off('move', resizeCanvas);
      map.off('zoom', resizeCanvas);
    };
  }, [mapReady]);

  // ── 7. City weather data observations ─────────────────────
  const cityDataList: CityWeatherSnapshot[] = cities.map(city => calculateCityWeather(city, timeOffset, undefined, undefined, mode));

  const project = useCallback((lng: number, lat: number) => {
    const map = mapRef.current;
    if (!map) return null;
    const pt = map.project(new maplibregl.LngLat(lng, lat));
    const w = mapContainerRef.current?.clientWidth  ?? window.innerWidth;
    const h = mapContainerRef.current?.clientHeight ?? window.innerHeight;
    if (pt.x < -60 || pt.y < -60 || pt.x > w + 60 || pt.y > h + 60) return null;
    return pt;
  }, [mapMoveVersion]); // eslint-disable-line react-hooks/exhaustive-deps

  const getHaversineDistance = (p1: maplibregl.LngLat, p2: maplibregl.LngLat) => {
    const R = 6371; // km
    const dLat = (p2.lat - p1.lat) * Math.PI / 180;
    const dLng = (p2.lng - p1.lng) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(p1.lat * Math.PI / 180) * Math.cos(p2.lat * Math.PI / 180) *
              Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  const getCumulativeDistance = () => {
    let dist = 0;
    for (let i = 1; i < measurePoints.length; i++) {
      dist += getHaversineDistance(measurePoints[i - 1], measurePoints[i]);
    }
    return dist;
  };

  return (
    <div className="relative w-full h-full">
      {/* Map container */}
      <div ref={mapContainerRef} className="absolute inset-0 w-full h-full z-0" />

      {/* Static parameters heatmap canvas layer */}
      <canvas ref={heatmapCanvasRef} className="absolute inset-0 w-full h-full pointer-events-none z-10" />

      {/* Animated canvas layer */}
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none z-10" />

      {/* HTML marker overlay */}
      {mapReady && (
        <div className="absolute inset-0 pointer-events-none z-20 overflow-hidden">
          {/* Global Storm Markers */}
          {allStormStates.map(({ storm, state }) => {
            const pt = project(state.position.lng, state.position.lat);
            if (!pt) return null;

            const markerColor = mode === 'past' ? '#64748b' : (mode === 'future' ? '#a855f7' : '#22c55e');
            const catLabel   = getCategoryLabel(storm.category);
            const isSelected = selectedLocationId === storm.id;

            return (
              <div
                key={storm.id}
                style={{ left: pt.x, top: pt.y }}
                className="absolute -translate-x-1/2 -translate-y-1/2 pointer-events-auto cursor-pointer group custom-map-marker"
                data-lat={state.position.lat}
                data-lng={state.position.lng}
                onClick={() => onSelectLocation(storm.id, 'storm')}
              >
                <span className="absolute rounded-full animate-ping opacity-60"
                  style={{ inset: storm.category >= 4 ? -32 : storm.category >= 2 ? -20 : -12, backgroundColor: markerColor + '30' }} />
                <span className="absolute rounded-full animate-pulse"
                  style={{ inset: storm.category >= 4 ? -20 : -12, backgroundColor: markerColor + '40' }} />

                <div
                  className="relative flex items-center justify-center rounded-full border-2 shadow-lg transition-all duration-300"
                  style={{
                    width:  storm.category >= 3 ? 36 : 28,
                    height: storm.category >= 3 ? 36 : 28,
                    backgroundColor: markerColor + 'cc',
                    borderColor: isSelected ? '#ffffff' : markerColor,
                    transform: isSelected ? 'scale(1.3)' : undefined,
                  }}
                >
                  <svg
                    className="text-white animate-spin"
                    style={{
                      width: storm.category >= 3 ? 22 : 16,
                      height: storm.category >= 3 ? 22 : 16,
                      animationDuration: storm.category >= 4 ? '2.5s' : storm.category >= 2 ? '3.5s' : '5s',
                    }}
                    fill="none" viewBox="0 0 24 24" stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5}
                      d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707m0-12.728l.707.707m12.728 12.728l.707.707M12 8a4 4 0 100 8 4 4 0 000-8z" />
                  </svg>
                </div>

                <div
                  className="absolute top-10 left-1/2 -translate-x-1/2 text-[10px] font-bold tracking-wide px-2 py-0.5 rounded shadow-xl uppercase whitespace-nowrap border"
                  style={{ backgroundColor: '#020408ee', borderColor: markerColor + '80', color: markerColor }}
                >
                  {storm.name}
                </div>

                <div
                  className="absolute -top-5 left-1/2 -translate-x-1/2 text-[9px] font-extrabold px-1.5 py-0.5 rounded-full whitespace-nowrap"
                  style={{ backgroundColor: markerColor, color: storm.category >= 3 ? '#000' : '#fff' }}
                >
                  {catLabel}
                </div>

                <div
                  className="absolute -top-5 right-[-70px] text-[9px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-200 border"
                  style={{ backgroundColor: '#020408ee', borderColor: markerColor + '60', color: markerColor }}
                >
                  {storm.probability}% prob
                </div>

                <div
                  className="absolute top-10 right-[-65px] text-[9px] font-semibold px-2 py-0.5 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                  style={{ backgroundColor: '#020408ee', color: '#94a3b8' }}
                >
                  {state.maxWindSpeed} km/h
                </div>

                <div
                  className="absolute text-[9px] font-semibold px-1.5 py-0.5 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                  style={{ top: 54, left: '50%', transform: 'translateX(-50%)', backgroundColor: '#020408cc', color: '#64748b' }}
                >
                  ↗ {storm.forecastMovement}
                </div>
              </div>
            );
          })}

          {/* City Markers (Zoom Earth style temperature badges) */}
          {cityDataList.map(({ city, weather, aiPrediction }) => {
            const pt = project(city.coord.lng, city.coord.lat);
            if (!pt) return null;
            const isSelected = selectedLocationId === city.id;

            // Compute Zoom Earth heat pill colors based on temperature
            const tempVal = weather.temp;
            const tempPillColor = tempVal > 40 ? '#9333ea' : tempVal > 35 ? '#ef4444' : tempVal > 30 ? '#f97316' : tempVal > 25 ? '#f59e0b' : tempVal > 20 ? '#eab308' : '#22c55e';

            return (
              <div
                key={city.id}
                style={{ left: pt.x, top: pt.y }}
                className="absolute -translate-x-1/2 -translate-y-1/2 pointer-events-auto cursor-pointer group custom-map-marker flex flex-col items-center gap-0.5"
                data-lat={city.coord.lat}
                data-lng={city.coord.lng}
                onClick={() => onSelectLocation(city.id, 'city')}
                onMouseEnter={() => setHoveredInfo({ x: pt.x, y: pt.y - 12, name: city.name, temp: weather.temp, windSpeed: weather.windSpeed, humidity: weather.humidity, pressure: weather.pressure, stormProb: aiPrediction.probability })}
                onMouseLeave={() => setHoveredInfo(null)}
              >
                {/* City name & temp pill */}
                <div className={`flex items-center gap-1 bg-[#020408ee] hover:bg-slate-900 border rounded-full px-2 py-0.5 shadow-lg transition-all duration-200 ${
                  isSelected ? 'border-sky-400 ring-2 ring-sky-500/30' : 'border-slate-700/50'
                }`}>
                  <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: tempPillColor }} />
                  <span className="text-[10px] font-bold text-slate-200 whitespace-nowrap">
                    {city.name} <span className="text-slate-400 font-normal ml-0.5">{tempVal}°</span>
                  </span>
                </div>

                {/* Wind speed & direction arrow pill */}
                <div className="flex items-center gap-1 bg-[#0f172acc] border border-slate-800 rounded-full px-1.5 py-0.5 shadow-md text-[8px] font-bold text-sky-400 transition-transform duration-200 group-hover:scale-105">
                  <span>{Math.round(weather.windSpeed)}</span>
                  <span 
                    className="inline-block text-[9px]"
                    style={{ transform: `rotate(${cardinalToDegrees(aiPrediction.direction) + 180}deg)` }}
                  >
                    ↑
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Hover Tooltip */}
      {hoveredInfo && (
        <div
          style={{ left: hoveredInfo.x + 12, top: hoveredInfo.y - 48 }}
          className="absolute z-50 glass-panel pointer-events-none rounded-lg p-3 text-xs w-48 shadow-2xl border border-slate-700/50 flex flex-col gap-1.5 animate-in fade-in zoom-in-95 duration-100"
        >
          <div className="font-bold text-slate-100 flex items-center justify-between">
            <span>{hoveredInfo.name}</span>
            <span className="text-[10px] bg-slate-800 px-1.5 py-0.5 rounded text-sky-400 font-mono">AI Prediction</span>
          </div>
          <div className="h-px bg-slate-700/40 my-0.5" />
          <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-slate-300">
            <span>Temp:</span>     <span className="text-right text-slate-100 font-semibold">{hoveredInfo.temp}°C</span>
            <span>Wind:</span>     <span className="text-right text-slate-100 font-semibold">{hoveredInfo.windSpeed} km/h</span>
            <span>Humidity:</span> <span className="text-right text-slate-100 font-semibold">{hoveredInfo.humidity}%</span>
            <span>Pressure:</span> <span className="text-right text-slate-100 font-semibold">{hoveredInfo.pressure} hPa</span>
          </div>
          <div className="h-px bg-slate-700/40 my-0.5" />
          <div className="flex items-center justify-between text-[11px] font-bold text-slate-200 pt-0.5">
            <span>Storm Prob:</span>
            <span className={
              hoveredInfo.stormProb > 80 ? 'text-red-400' :
              hoveredInfo.stormProb > 50 ? 'text-orange-400' :
              hoveredInfo.stormProb > 25 ? 'text-yellow-400' : 'text-emerald-400'
            }>{hoveredInfo.stormProb}%</span>
          </div>
        </div>
      )}

      {/* Dynamic Map Legend Overlay */}
      {mapReady && (layers.temperature || layers.rain || layers.humidity || layers.clouds) && (
        <div className="absolute bottom-5 right-5 z-20 pointer-events-auto glass-panel p-3.5 rounded-xl shadow-xl border border-slate-700/40 text-slate-300 w-52 flex flex-col gap-2.5 animate-in slide-in-from-bottom duration-300">
          {layers.clouds && (
            <div className="flex flex-col gap-1.5">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider font-mono">Cloud Cover Scale</span>
              <div className="h-2 w-full rounded bg-gradient-to-r from-transparent via-slate-500 to-white border border-slate-700/60" />
              <div className="flex justify-between text-[9px] font-bold text-slate-500 font-mono">
                <span>0% (Clear)</span>
                <span>45%</span>
                <span>100% (Overcast)</span>
              </div>
            </div>
          )}
          {layers.temperature && (
            <div className="flex flex-col gap-1.5">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider font-mono">Temperature Scale</span>
              <div className="h-2 w-full rounded bg-gradient-to-r from-blue-500 via-yellow-400 to-purple-600 border border-slate-700/60" />
              <div className="flex justify-between text-[9px] font-bold text-slate-500 font-mono">
                <span>&lt;10°C (Cold)</span>
                <span>25°C</span>
                <span>&gt;40°C (Hot)</span>
              </div>
            </div>
          )}
          {layers.rain && (
            <div className="flex flex-col gap-1.5">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider font-mono">Rain Scale (mm/hr)</span>
              <div className="h-2 w-full rounded bg-gradient-to-r from-sky-200 via-cyan-500 to-fuchsia-500 border border-slate-700/60" />
              <div className="flex justify-between text-[9px] font-bold text-slate-500 font-mono">
                <span>0.5 (Light)</span>
                <span>15 (Mod)</span>
                <span>30+ (Severe)</span>
              </div>
            </div>
          )}
          {layers.humidity && (
            <div className="flex flex-col gap-1.5">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider font-mono">Humidity Scale</span>
              <div className="h-2 w-full rounded bg-gradient-to-r from-cyan-200 via-cyan-500 to-cyan-900 border border-slate-700/60" />
              <div className="flex justify-between text-[9px] font-bold text-slate-500 font-mono">
                <span>40% (Dry)</span>
                <span>60%</span>
                <span>80%+ (Wet)</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Distance Measurement Tooltip */}
      {(() => {
        const lastPoint = measurePoints[measurePoints.length - 1];
        const lastProjected = lastPoint ? project(lastPoint.lng, lastPoint.lat) : null;
        if (!measuring || !lastProjected) return null;
        return (
          <div
            className="absolute z-20 pointer-events-none px-2.5 py-1 rounded bg-[#0d1117dd] border border-amber-500 text-amber-500 font-mono text-[10px] font-black shadow-lg"
            style={{
              left: lastProjected.x + 8,
              top: lastProjected.y - 12
            }}
          >
            {getCumulativeDistance().toFixed(3)} km
          </div>
        );
      })()}

      {/* WebGL Fallback Overlay */}
      {!webglSupported && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-slate-950/90 backdrop-blur-md p-6">
          <div className="max-w-md text-center flex flex-col gap-4 border border-red-500/30 p-6 rounded-2xl bg-red-950/20 shadow-2xl">
            <span className="text-red-400 font-bold text-lg">WebGL Context Blocked/Unsupported</span>
            <p className="text-sm text-slate-300 leading-relaxed">
              Your browser has disabled WebGL context creation due to a GPU crash or excessive memory usage.
            </p>
            <p className="text-xs text-slate-400">
              Please **fully close your browser** and reopen it, or ensure **Hardware Acceleration** is enabled in your browser settings to fix this.
            </p>
            <button 
              onClick={() => window.location.reload()} 
              className="mt-2 px-4 py-2 bg-sky-500 hover:bg-sky-600 text-slate-950 font-bold rounded-lg transition-colors text-xs self-center cursor-pointer pointer-events-auto"
            >
              Reload Page
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
