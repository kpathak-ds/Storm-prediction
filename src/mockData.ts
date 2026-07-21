// Mock weather data and dynamic calculation model for the AI Storm Intelligence Platform

export interface Coordinate {
  lat: number;
  lng: number;
}

export interface StormState {
  timeOffset: number;
  label: string;
  position: Coordinate;
  pressure: number;
  maxWindSpeed: number;
  gusts: number;
  direction: string;
  speed: number;
  radius: number;
}

export interface CityInfo {
  id: string;
  name: string;
  state: string;
  country: string;
  coord: Coordinate;
  baseTemp: number;
  baseHumidity: number;
  baseWindSpeed: number;
  basePressure: number;
}

export interface LiveWeatherData {
  temp: number;
  feelsLike: number;
  humidity: number;
  pressure: number;
  windSpeed: number;
  windGust: number;
  visibility: number;
  rainfall: number;
  cloudCover: number;
  lightningProb: number;
}

export interface AIStormPrediction {
  probability: number;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'EXTREME';
  confidence: number;
  arrivalTime: number | null;
  duration: number;
  direction: string;
  speed: number;
  radius: number;
  explainableAI: string[];
}

export interface CityWeatherSnapshot {
  city: CityInfo;
  weather: LiveWeatherData;
  aiPrediction: AIStormPrediction;
  distanceToEye: number;
}

// ============================================================
// GLOBAL ACTIVE STORMS — displayed on world map immediately
// ============================================================
export interface GlobalStorm {
  id: string;
  name: string;
  category: number;
  type: 'Typhoon' | 'Hurricane' | 'Cyclone' | 'Tropical Storm' | 'Tropical Depression';
  track: StormState[];
  probability: number;
  forecastMovement: string;
}

export let presentStorms: GlobalStorm[] = [];

export const historicalStorms: GlobalStorm[] = [
  {
    id: 'aero-tempest',
    name: 'Cyclone Amphan',
    category: 4,
    type: 'Cyclone',
    probability: 92,
    forecastMovement: 'NNW at 18 km/h',
    track: [
      { timeOffset: -24, label: '24h Ago',   position: { lat: 12.0, lng: 89.0 }, pressure: 965, maxWindSpeed: 130, gusts: 160, direction: 'Northwest',       speed: 15, radius: 300 },
      { timeOffset: -12, label: '12h Ago',   position: { lat: 15.0, lng: 88.0 }, pressure: 950, maxWindSpeed: 150, gusts: 180, direction: 'Northwest',       speed: 16, radius: 330 },
      { timeOffset:   0, label: 'Now',       position: { lat: 18.0, lng: 87.0 }, pressure: 935, maxWindSpeed: 175, gusts: 210, direction: 'Northwest',       speed: 18, radius: 360 },
      { timeOffset:   1, label: '+1 Hour',   position: { lat: 18.3, lng: 86.8 }, pressure: 932, maxWindSpeed: 180, gusts: 215, direction: 'Northwest',       speed: 18, radius: 370 },
      { timeOffset:   3, label: '+3 Hours',  position: { lat: 18.9, lng: 86.4 }, pressure: 928, maxWindSpeed: 185, gusts: 220, direction: 'Northwest',       speed: 19, radius: 380 },
      { timeOffset:   6, label: '+6 Hours',  position: { lat: 20.0, lng: 85.8 }, pressure: 935, maxWindSpeed: 165, gusts: 200, direction: 'North-Northwest', speed: 20, radius: 360 },
      { timeOffset:  12, label: '+12 Hours', position: { lat: 21.5, lng: 85.2 }, pressure: 955, maxWindSpeed: 130, gusts: 160, direction: 'North-Northwest', speed: 22, radius: 300 },
      { timeOffset:  24, label: '+24 Hours', position: { lat: 24.5, lng: 84.0 }, pressure: 980, maxWindSpeed:  85, gusts: 110, direction: 'North-Northwest', speed: 24, radius: 200 },
    ],
  },
  {
    id: 'cyclone-vera',
    name: 'Cyclone Vera',
    category: 2,
    type: 'Cyclone',
    probability: 65,
    forecastMovement: 'SW at 12 km/h',
    track: [
      { timeOffset: -24, label: '24h Ago',   position: { lat: -14.0, lng: 42.0 }, pressure: 975, maxWindSpeed: 120, gusts: 150, direction: 'Southwest', speed: 10, radius: 270 },
      { timeOffset: -12, label: '12h Ago',   position: { lat: -15.5, lng: 41.0 }, pressure: 968, maxWindSpeed: 135, gusts: 165, direction: 'Southwest', speed: 11, radius: 285 },
      { timeOffset:   0, label: 'Now',       position: { lat: -17.0, lng: 39.8 }, pressure: 962, maxWindSpeed: 145, gusts: 178, direction: 'Southwest', speed: 12, radius: 295 },
      { timeOffset:   6, label: '+6 Hours',  position: { lat: -18.2, lng: 38.8 }, pressure: 967, maxWindSpeed: 138, gusts: 168, direction: 'Southwest', speed: 12, radius: 285 },
      { timeOffset:  12, label: '+12 Hours', position: { lat: -19.5, lng: 37.5 }, pressure: 974, maxWindSpeed: 120, gusts: 148, direction: 'SW',        speed: 13, radius: 260 },
      { timeOffset:  24, label: '+24 Hours', position: { lat: -22.0, lng: 35.5 }, pressure: 984, maxWindSpeed:  90, gusts: 115, direction: 'SW',        speed: 14, radius: 210 },
    ],
  },
];

export const futureStorms: GlobalStorm[] = [
  {
    id: 'hurricane-max',
    name: 'Hurricane Max',
    category: 1,
    type: 'Hurricane',
    probability: 55,
    forecastMovement: 'WNW at 16 km/h',
    track: [
      { timeOffset: -24, label: '24h Ago',   position: { lat: 14.5, lng: -100.0 }, pressure: 978, maxWindSpeed: 110, gusts: 135, direction: 'WNW', speed: 15, radius: 240 },
      { timeOffset: -12, label: '12h Ago',   position: { lat: 15.0, lng: -102.5 }, pressure: 972, maxWindSpeed: 125, gusts: 155, direction: 'WNW', speed: 16, radius: 255 },
      { timeOffset:   0, label: 'Now',       position: { lat: 15.5, lng: -105.0 }, pressure: 975, maxWindSpeed: 120, gusts: 148, direction: 'WNW', speed: 16, radius: 250 },
      { timeOffset:   6, label: '+6 Hours',  position: { lat: 15.8, lng: -107.2 }, pressure: 979, maxWindSpeed: 110, gusts: 135, direction: 'WNW', speed: 17, radius: 235 },
      { timeOffset:  12, label: '+12 Hours', position: { lat: 16.2, lng: -109.5 }, pressure: 983, maxWindSpeed: 100, gusts: 122, direction: 'WNW', speed: 18, radius: 220 },
      { timeOffset:  24, label: '+24 Hours', position: { lat: 17.0, lng: -114.0 }, pressure: 990, maxWindSpeed:  80, gusts:  98, direction: 'WNW', speed: 20, radius: 185 },
    ],
  },
];

export let globalStorms: GlobalStorm[] = [
  ...presentStorms,
  ...historicalStorms,
  ...futureStorms,
];

// Primary storm track (backward compat — points to first global storm)
export let stormTrack: StormState[] = globalStorms[0]?.track || [];

export function updatePresentStorms(newPresentStorms: GlobalStorm[]) {
  presentStorms = newPresentStorms;
  globalStorms = [
    ...presentStorms,
    ...historicalStorms,
    ...futureStorms,
  ];
  stormTrack = globalStorms[0]?.track || [];
}

// No longer mutates storm positions — search only flies the camera
export function teleportStormTo(_lat: number, _lng: number) {
  // no-op: storms are fixed globally
}

// ── City definitions ─────────────────────────────────────────
export const cities: CityInfo[] = [
  { id: 'mumbai',        name: 'Mumbai',       state: 'Maharashtra',   country: 'India', coord: { lat: 19.0760, lng: 72.8777 }, baseTemp: 32, baseHumidity: 75, baseWindSpeed: 15, basePressure: 1010 },
  { id: 'delhi',         name: 'New Delhi',    state: 'Delhi',         country: 'India', coord: { lat: 28.7041, lng: 77.1025 }, baseTemp: 38, baseHumidity: 50, baseWindSpeed: 10, basePressure: 1005 },
  { id: 'kolkata',       name: 'Kolkata',      state: 'West Bengal',   country: 'India', coord: { lat: 22.5726, lng: 88.3639 }, baseTemp: 34, baseHumidity: 80, baseWindSpeed: 18, basePressure: 1007 },
  { id: 'chennai',       name: 'Chennai',      state: 'Tamil Nadu',    country: 'India', coord: { lat: 13.0827, lng: 80.2707 }, baseTemp: 35, baseHumidity: 85, baseWindSpeed: 20, basePressure: 1009 },
  { id: 'bengaluru',     name: 'Bengaluru',    state: 'Karnataka',     country: 'India', coord: { lat: 12.9716, lng: 77.5946 }, baseTemp: 28, baseHumidity: 65, baseWindSpeed: 12, basePressure: 1012 },
  { id: 'hyderabad',     name: 'Hyderabad',    state: 'Telangana',     country: 'India', coord: { lat: 17.3850, lng: 78.4867 }, baseTemp: 36, baseHumidity: 55, baseWindSpeed: 14, basePressure: 1008 },
  { id: 'bhubaneswar',   name: 'Bhubaneswar',  state: 'Odisha',        country: 'India', coord: { lat: 20.2961, lng: 85.8245 }, baseTemp: 33, baseHumidity: 78, baseWindSpeed: 16, basePressure: 1006 },
  { id: 'visakhapatnam', name: 'Visakhapatnam',state: 'Andhra Pradesh',country: 'India', coord: { lat: 17.6868, lng: 83.2185 }, baseTemp: 32, baseHumidity: 82, baseWindSpeed: 22, basePressure: 1007 },
  { id: 'jaipur',        name: 'Jaipur',       state: 'Rajasthan',     country: 'India', coord: { lat: 26.9124, lng: 75.7873 }, baseTemp: 39, baseHumidity: 45, baseWindSpeed: 12, basePressure: 1006 },
  { id: 'gandhinagar',   name: 'Gandhinagar',  state: 'Gujarat',       country: 'India', coord: { lat: 23.2156, lng: 72.6369 }, baseTemp: 37, baseHumidity: 62, baseWindSpeed: 14, basePressure: 1008 },
  { id: 'lucknow',       name: 'Lucknow',      state: 'Uttar Pradesh', country: 'India', coord: { lat: 26.8467, lng: 80.9462 }, baseTemp: 36, baseHumidity: 58, baseWindSpeed: 11, basePressure: 1007 },
  { id: 'patna',         name: 'Patna',        state: 'Bihar',         country: 'India', coord: { lat: 25.5941, lng: 85.1376 }, baseTemp: 35, baseHumidity: 65, baseWindSpeed: 10, basePressure: 1006 },
  { id: 'bhopal',        name: 'Bhopal',       state: 'Madhya Pradesh',country: 'India', coord: { lat: 23.2599, lng: 77.4126 }, baseTemp: 36, baseHumidity: 52, baseWindSpeed: 13, basePressure: 1009 },
  { id: 'chandigarh',    name: 'Chandigarh',   state: 'Punjab',        country: 'India', coord: { lat: 30.7333, lng: 76.7794 }, baseTemp: 34, baseHumidity: 55, baseWindSpeed: 11, basePressure: 1008 },
  { id: 'gurugram',      name: 'Gurugram',     state: 'Haryana',       country: 'India', coord: { lat: 28.4595, lng: 77.0266 }, baseTemp: 36, baseHumidity: 50, baseWindSpeed: 12, basePressure: 1006 },
  { id: 'srinagar',      name: 'Srinagar',     state: 'Jammu & Kashmir',country: 'India', coord: { lat: 34.0837, lng: 74.7973 }, baseTemp: 24, baseHumidity: 70, baseWindSpeed: 8,  basePressure: 1011 },
  { id: 'shimla',        name: 'Shimla',       state: 'Himachal Pradesh',country: 'India', coord: { lat: 31.1048, lng: 77.1734 }, baseTemp: 22, baseHumidity: 60, baseWindSpeed: 9,  basePressure: 1013 },
  { id: 'dehradun',      name: 'Dehradun',     state: 'Uttarakhand',   country: 'India', coord: { lat: 30.3165, lng: 78.0322 }, baseTemp: 30, baseHumidity: 63, baseWindSpeed: 10, basePressure: 1010 },
  { id: 'trivandrum',    name: 'Trivandrum',   state: 'Kerala',        country: 'India', coord: { lat: 8.5241,  lng: 76.9366 }, baseTemp: 31, baseHumidity: 88, baseWindSpeed: 18, basePressure: 1011 },
  { id: 'panaji',        name: 'Panaji',       state: 'Goa',           country: 'India', coord: { lat: 15.4909, lng: 73.8278 }, baseTemp: 32, baseHumidity: 80, baseWindSpeed: 15, basePressure: 1010 },
  { id: 'raipur',        name: 'Raipur',       state: 'Chhattisgarh',  country: 'India', coord: { lat: 21.2514, lng: 81.6296 }, baseTemp: 36, baseHumidity: 68, baseWindSpeed: 12, basePressure: 1007 },
  { id: 'ranchi',        name: 'Ranchi',       state: 'Jharkhand',     country: 'India', coord: { lat: 23.3441, lng: 85.3096 }, baseTemp: 34, baseHumidity: 64, baseWindSpeed: 11, basePressure: 1008 },
  { id: 'guwahati',      name: 'Guwahati',     state: 'Assam',         country: 'India', coord: { lat: 26.1445, lng: 91.7362 }, baseTemp: 32, baseHumidity: 85, baseWindSpeed: 14, basePressure: 1006 },
  { id: 'shillong',      name: 'Shillong',     state: 'Meghalaya',     country: 'India', coord: { lat: 25.5788, lng: 91.8831 }, baseTemp: 23, baseHumidity: 80, baseWindSpeed: 10, basePressure: 1012 },
  { id: 'itanagar',      name: 'Itanagar',     state: 'Arunachal Pradesh', country: 'India', coord: { lat: 27.0844, lng: 93.6053 }, baseTemp: 28, baseHumidity: 78, baseWindSpeed: 11, basePressure: 1009 },
  { id: 'kohima',        name: 'Kohima',       state: 'Nagaland',      country: 'India', coord: { lat: 25.6751, lng: 94.1086 }, baseTemp: 24, baseHumidity: 82, baseWindSpeed: 9,  basePressure: 1011 },
  { id: 'imphal',        name: 'Imphal',       state: 'Manipur',       country: 'India', coord: { lat: 24.8170, lng: 93.9368 }, baseTemp: 26, baseHumidity: 80, baseWindSpeed: 10, basePressure: 1010 },
  { id: 'aizawl',        name: 'Aizawl',       state: 'Mizoram',       country: 'India', coord: { lat: 23.7307, lng: 92.7173 }, baseTemp: 25, baseHumidity: 84, baseWindSpeed: 9,  basePressure: 1011 },
  { id: 'agartala',      name: 'Agartala',     state: 'Tripura',       country: 'India', coord: { lat: 23.8315, lng: 91.2868 }, baseTemp: 31, baseHumidity: 85, baseWindSpeed: 12, basePressure: 1008 },
  { id: 'gangtok',       name: 'Gangtok',      state: 'Sikkim',        country: 'India', coord: { lat: 27.3314, lng: 88.6138 }, baseTemp: 20, baseHumidity: 75, baseWindSpeed: 8,  basePressure: 1014 },
  { id: 'leh',           name: 'Leh',          state: 'Ladakh',        country: 'India', coord: { lat: 34.1526, lng: 77.5771 }, baseTemp: 16, baseHumidity: 35, baseWindSpeed: 14, basePressure: 1016 },
  { id: 'port_blair',    name: 'Port Blair',   state: 'Andaman UT',    country: 'India', coord: { lat: 11.6234, lng: 92.7265 }, baseTemp: 31, baseHumidity: 85, baseWindSpeed: 24, basePressure: 1010 },
];


// Haversine distance in km
export function calculateDistance(coord1: Coordinate, coord2: Coordinate): number {
  const R = 6371;
  const dLat = ((coord2.lat - coord1.lat) * Math.PI) / 180;
  const dLng = ((coord2.lng - coord1.lng) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((coord1.lat * Math.PI) / 180) *
      Math.cos((coord2.lat * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Interpolate storm properties at time t from any track array
export function getInterpolatedStormState(t: number, track: StormState[] = stormTrack): StormState {
  const sorted = [...track].sort((a, b) => a.timeOffset - b.timeOffset);

  if (t <= sorted[0].timeOffset) return sorted[0];
  if (t >= sorted[sorted.length - 1].timeOffset) return sorted[sorted.length - 1];

  let idx = 0;
  for (let i = 0; i < sorted.length - 1; i++) {
    if (t >= sorted[i].timeOffset && t <= sorted[i + 1].timeOffset) { idx = i; break; }
  }

  const s1 = sorted[idx];
  const s2 = sorted[idx + 1];
  const r  = (t - s1.timeOffset) / (s2.timeOffset - s1.timeOffset);

  return {
    timeOffset:   t,
    label:        t === 0 ? 'Now' : t > 0 ? `+${t} Hours` : `${Math.abs(t)}h Ago`,
    position:     { lat: s1.position.lat + (s2.position.lat - s1.position.lat) * r, lng: s1.position.lng + (s2.position.lng - s1.position.lng) * r },
    pressure:     Math.round(s1.pressure     + (s2.pressure     - s1.pressure)     * r),
    maxWindSpeed: Math.round(s1.maxWindSpeed + (s2.maxWindSpeed - s1.maxWindSpeed) * r),
    gusts:        Math.round(s1.gusts        + (s2.gusts        - s1.gusts)        * r),
    speed:        Math.round(s1.speed        + (s2.speed        - s1.speed)        * r),
    radius:       Math.round(s1.radius       + (s2.radius       - s1.radius)       * r),
    direction:    r > 0.5 ? s2.direction : s1.direction,
  };
}

// Get all global storms interpolated at time t for a given mode
export function getAllStormsAtTime(t: number, mode: 'present' | 'past' | 'future' = 'present'): Array<{ storm: GlobalStorm; state: StormState }> {
  const activeSet = mode === 'past' ? historicalStorms : (mode === 'future' ? futureStorms : presentStorms);
  return activeSet.map(storm => ({
    storm,
    state: getInterpolatedStormState(t, storm.track),
  }));
}

// Saffir-Simpson label
export function getCategoryLabel(category: number): string {
  return category === 0 ? 'TS' : `Cat ${category}`;
}

// Color per category
export function getCategoryColor(category: number): string {
  if (category === 0) return '#22d3ee';
  if (category === 1) return '#84cc16';
  if (category === 2) return '#eab308';
  if (category === 3) return '#f97316';
  if (category === 4) return '#ef4444';
  return '#a855f7';
}

// City weather snapshot calculation
export function calculateCityWeather(
  city: CityInfo,
  t: number,
  liveData?: any,
  historicalData?: any,
  mode: 'present' | 'past' | 'future' = 'present'
): CityWeatherSnapshot {
  const activeSet = mode === 'past' ? historicalStorms : (mode === 'future' ? futureStorms : presentStorms);
  
  let closestStormState: StormState | null = null;
  let minDistance = 99999;

  activeSet.forEach(storm => {
    const state = getInterpolatedStormState(t, storm.track);
    const d = calculateDistance(city.coord, state.position);
    if (d < minDistance) {
      minDistance = d;
      closestStormState = state;
    }
  });

  const distance = minDistance;
  const storm = closestStormState || {
    timeOffset: t,
    label: 'Ambient',
    position: { lat: 0, lng: 0 },
    pressure: 1013,
    maxWindSpeed: 10,
    gusts: 15,
    direction: 'N',
    speed: 5,
    radius: 100
  };

  let temp: number, feelsLike: number, humidity: number, pressure: number,
      windSpeed: number, windGust: number, visibility: number,
      rainfall: number, cloudCover: number, lightningProb: number;

  const isEye            = distance < 25;
  const pressureDropMax  = city.basePressure - storm.pressure;
  const pressureImpact   = Math.exp(-distance / 350);
  const windImpact       = Math.exp(-distance / 250);
  const stormWindContrib = (storm.maxWindSpeed - city.baseWindSpeed) * windImpact;
  const rainImpact       = Math.exp(-distance / 120);
  const cloudImpact      = Math.exp(-distance / 450);

  if (liveData) {
    const nowHourStr = liveData.current.time.slice(0, 14) + '00';
    let ci = liveData.hourly.time.findIndex((s: string) => s.startsWith(nowHourStr));
    if (ci === -1) ci = 0;
    let ti = Math.max(0, Math.min(ci + Math.round(t), liveData.hourly.time.length - 1));

    temp         = Math.round(liveData.hourly.temperature2m[ti]);
    feelsLike    = Math.round(liveData.hourly.apparentTemperature[ti]);
    humidity     = Math.round(liveData.hourly.relativeHumidity2m[ti]);
    pressure     = Math.round(liveData.hourly.pressureMsl[ti]);
    windSpeed    = Math.round(liveData.hourly.windSpeed10m[ti]);
    windGust     = Math.round(liveData.hourly.windGusts10m[ti] || windSpeed * 1.35);
    visibility   = liveData.hourly.visibility[ti] ? Number((liveData.hourly.visibility[ti] / 1000).toFixed(1)) : 10;
    rainfall     = liveData.hourly.precipitation[ti] || 0;
    cloudCover   = liveData.hourly.cloudCover[ti];
    const wc     = liveData.hourly.weatherCode[ti];
    lightningProb = wc >= 95 ? 80 + Math.random() * 20 : 0;

  } else if (historicalData) {
    temp         = historicalData.temp;
    feelsLike    = historicalData.temp;
    humidity     = historicalData.humidity;
    pressure     = historicalData.pressure;
    windSpeed    = historicalData.windSpeed;
    windGust     = historicalData.windGust !== undefined ? historicalData.windGust : Math.round(historicalData.windSpeed * 1.35);
    visibility   = historicalData.visibility !== undefined ? historicalData.visibility : 10;
    rainfall     = historicalData.rainfall;
    cloudCover   = historicalData.cloudCover !== undefined ? historicalData.cloudCover : (humidity > 70 ? 90 : 30);
    lightningProb = historicalData.lightningProb !== undefined ? historicalData.lightningProb : (rainfall > 5 ? 70 : 10);

  } else {
    pressure  = Math.round(city.basePressure - pressureDropMax * pressureImpact);
    windSpeed = isEye ? 20 : Math.round(city.baseWindSpeed + stormWindContrib);
    windGust  = isEye ? 35 : Math.round(windSpeed * (1.2 + 0.25 * windImpact));
    rainfall  = Number((50 * rainImpact).toFixed(1));
    cloudCover = Math.min(100, Math.round(30 + 70 * cloudImpact));
    temp      = Math.round(city.baseTemp - 5 * rainImpact);
    feelsLike = Math.round(temp + (rainfall > 0 ? -1.5 : 1) * (windSpeed > 30 ? -2 : 0.5));
    humidity  = Math.min(100, Math.round(city.baseHumidity + (100 - city.baseHumidity) * Math.exp(-distance / 200)));
    lightningProb = distance > 30 && distance < 200
      ? Math.round(85 * Math.exp(-Math.abs(distance - 90) / 60))
      : distance <= 30 ? 30 : Math.min(100, Math.round(15 * Math.exp(-distance / 400)));
    visibility = Math.max(0.5, Number((12 - 11.5 * rainImpact).toFixed(1)));
  }

  const probability = Math.min(100, Math.round(100 * Math.exp(-distance / 280)));

  let riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'EXTREME' = 'LOW';
  if      (probability >= 85 || windSpeed >= 90) riskLevel = 'EXTREME';
  else if (probability >= 60 || windSpeed >= 55) riskLevel = 'HIGH';
  else if (probability >= 30 || windSpeed >= 30) riskLevel = 'MEDIUM';

  let confidence = 95;
  if (distance > 150 && distance < 400) confidence = Math.round(82 + 10 * Math.sin(distance / 50));
  else confidence = Math.round(90 + 8 * (distance > 600 ? 1 : Math.exp(-distance / 100)));
  confidence = Math.max(75, Math.min(98, confidence));

  const stormFuture   = getInterpolatedStormState(t + 3);
  const distanceFuture = calculateDistance(city.coord, stormFuture.position);
  const isApproaching  = distanceFuture < distance;

  let arrivalTime: number | null = null;
  if (isApproaching && distance > 50) {
    const approachSpeed = (distance - distanceFuture) / 3;
    arrivalTime = approachSpeed > 2 ? Math.max(0.5, Number((distance / approachSpeed).toFixed(1))) : null;
  }

  const duration = Math.max(1, Math.round((storm.radius * 1.5) / storm.speed));

  const explainableAI: string[] = [];
  if (distance < 50) explainableAI.push(`Direct impact: City is located inside the storm core radius (${storm.radius} km).`);
  if (pressure < 985) explainableAI.push(`Severe barometric pressure drop detected (${pressure} hPa, -${Math.round(pressureDropMax * pressureImpact)} hPa deviation).`);
  else if (pressure < 1000) explainableAI.push(`Barometric depression in progress (${pressure} hPa), indicating convective cell formation.`);
  if (windSpeed > 75) explainableAI.push(`Violent hurricane-force winds (${windSpeed} km/h, gusting ${windGust} km/h).`);
  else if (windSpeed > 35) explainableAI.push(`Elevated wind speeds (${windSpeed} km/h) consistent with outer storm bands.`);
  if (humidity > 90 && rainfall > 5) explainableAI.push(`Extreme atmospheric saturation (${humidity}%) causing heavy rainfall (${rainfall} mm/hr).`);
  if (lightningProb > 60) explainableAI.push(`High lightning discharge probability (${lightningProb}%) — vigorous convective updrafts.`);
  if (isApproaching) explainableAI.push(`Vector warning: Storm tracking directly towards location at ${storm.speed} km/h.`);
  else if (distance < 300) explainableAI.push(`Storm center is passing; trailing high-velocity wind fields remain active.`);
  else explainableAI.push(`Location outside active warning buffers; regional humidity flow monitored.`);
  explainableAI.push(`Overall storm probability: ${probability}% | AI Confidence: ${confidence}%.`);

  return {
    city,
    weather: { temp, feelsLike, humidity, pressure, windSpeed, windGust, visibility, rainfall, cloudCover, lightningProb },
    aiPrediction: { probability, riskLevel, confidence, arrivalTime, duration, direction: storm.direction, speed: storm.speed, radius: storm.radius, explainableAI },
    distanceToEye: Math.round(distance),
  };
}

export interface WindStreamline {
  id: number;
  coordinates: Coordinate[];
  speed: number;
}

export function generateWindStreamlines(t: number): WindStreamline[] {
  const storm = getInterpolatedStormState(t);
  const streamlines: WindStreamline[] = [];

  for (let i = 0; i < 36; i++) {
    const angleStart = (i * 2 * Math.PI) / 36;
    const points: Coordinate[] = [];
    const startRadius = 400 + Math.random() * 80;
    const endRadius   = 25  + Math.random() * 15;
    for (let step = 0; step < 15; step++) {
      const ratio   = step / 14;
      const radius  = startRadius - (startRadius - endRadius) * ratio;
      const angle   = angleStart + ratio * 2.8;
      points.push({
        lat: storm.position.lat + (radius * Math.sin(angle)) / 111,
        lng: storm.position.lng + (radius * Math.cos(angle)) / (111 * Math.cos((storm.position.lat * Math.PI) / 180)),
      });
    }
    streamlines.push({ id: i, coordinates: points, speed: Math.round(50 + 100 * Math.random()) });
  }

  for (let i = 0; i < 20; i++) {
    const startLat = 10 + i * 1.5;
    const points: Coordinate[] = [];
    for (let step = 0; step < 8; step++) {
      const lat = startLat + step * 0.2 + Math.sin(step * 0.5) * 0.4;
      const lng = 135 - step * 2.5;
      if (calculateDistance({ lat, lng }, storm.position) > 350) points.push({ lat, lng });
    }
    if (points.length > 2) streamlines.push({ id: 100 + i, coordinates: points, speed: 25 });
  }

  return streamlines;
}
