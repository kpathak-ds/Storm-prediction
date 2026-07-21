import { AreaChart, Area, LineChart, Line, ResponsiveContainer, XAxis, YAxis, Tooltip as ChartTooltip } from 'recharts';
import { 
  Activity, 
  Wind, 
  Gauge, 
  CloudRain, 
  Zap, 
  Thermometer, 
  Droplets,
  TrendingDown,
  TrendingUp,
  AlertOctagon
} from 'lucide-react';
import { 
  cities, 
  getInterpolatedStormState, 
  calculateCityWeather, 
  stormTrack,
  globalStorms 
} from '../mockData';
import { useEffect, useState } from 'react';
import { fetchLiveWeather, type OpenMeteoData } from '../api/openMeteo';



interface AIDashboardProps {
  timeOffset: number;
  selectedLocationId: string | null;
  selectedLocationType: 'city' | 'storm' | null;
  selectedDate: string;
  compareDate: string | null;
  onCloseLocation: () => void;
}

export default function AIDashboard({ 
  timeOffset, 
  selectedLocationId, 
  selectedLocationType,
  selectedDate,
  compareDate,
  onCloseLocation
}: AIDashboardProps) {




  const [liveData, setLiveData] = useState<OpenMeteoData | null>(null);
  const [historicalData, setHistoricalData] = useState<any>(null);
  const [compareData, setCompareData] = useState<any>(null);

  const todayStr = new Date().toISOString().split('T')[0];
  const isHistorical = selectedDate !== todayStr;

  useEffect(() => {
    if (!selectedLocationId || selectedLocationType !== 'city') return;
    const city = cities.find(c => c.id === selectedLocationId);
    if (!city) return;

    const fetchWeather = async () => {
      try {
        if (isHistorical) {
          const { getHistoricalRecord } = await import('../api/historicalData');
          setHistoricalData(await getHistoricalRecord(selectedDate));
        } else {
          const data = await fetchLiveWeather(city.coord);
          setLiveData(data);
          setHistoricalData(null);
        }

        if (compareDate) {
          const { getHistoricalRecord } = await import('../api/historicalData');
          if (compareDate !== todayStr) {
             setCompareData(await getHistoricalRecord(compareDate));
          } else {
             const data = await fetchLiveWeather(city.coord);
             setCompareData(data); // hacky way to cache today's for comparison
          }
        } else {
          setCompareData(null);
        }
      } catch (err) {
        // Silently fallback to mock models for charts if error
      }
    };

    fetchWeather();
    if (!isHistorical) {
      const interval = setInterval(fetchWeather, 10 * 60 * 1000);
      return () => clearInterval(interval);
    }
  }, [selectedLocationId, selectedLocationType, selectedDate, compareDate, isHistorical]);

  // 1. Fetch current weather snapshot to display in dashboard
  let title = "Regional Summary";
  let subtitle = "Active Cyclone Buffer";
  let probability = 0;
  let riskLevel = "MEDIUM";
  let confidence = 0;
  let windSpeed = 0;
  let pressure = 0;
  let rainfall = 0;
  let humidity = 0;
  let temp = 0;
  let lightningProb = 0;

  // Generate trend data for the charts
  // If a city is selected, calculate city weather parameters at each point of the storm track to construct the trend!
  // This is highly advanced: it shows how the city's weather evolves over time as the typhoon passes!
  const trendData = stormTrack.map(trackPoint => {
    if (selectedLocationType === 'city' && selectedLocationId) {
      const city = cities.find(c => c.id === selectedLocationId);
      if (city) {
        const snap = calculateCityWeather(city, trackPoint.timeOffset, isHistorical ? null : liveData, isHistorical ? historicalData : null);
        let cSnap = null;
        if (compareDate) {
          // If compareData exists (historical or today's pseudo-historical), pass it as historical, else if it's today, we might pass it as live.
          const isCompHist = compareDate !== todayStr;
          cSnap = calculateCityWeather(city, trackPoint.timeOffset, isCompHist ? null : compareData, isCompHist ? compareData : null);
        }

        return {
          hour: trackPoint.label,
          pressure: snap.weather.pressure,
          windSpeed: snap.weather.windSpeed,
          rainfall: snap.weather.rainfall,
          lightning: snap.weather.lightningProb,
          comparePressure: cSnap?.weather.pressure,
          compareWindSpeed: cSnap?.weather.windSpeed,
        };
      }
    }
    
    // Default to storm track values
    return {
      hour: trackPoint.label,
      pressure: trackPoint.pressure,
      windSpeed: trackPoint.maxWindSpeed,
      rainfall: trackPoint.timeOffset >= 0 ? 55 + trackPoint.timeOffset/2 : 40,
      lightning: trackPoint.timeOffset >= 0 ? 90 : 80,
    };
  });

  // Calculate current state
  if (selectedLocationType === 'storm') {
    const activeStorm = globalStorms.find(s => s.id === selectedLocationId) || globalStorms[0];
    const storm = getInterpolatedStormState(timeOffset, activeStorm.track);
    title = activeStorm.name;
    subtitle = `${activeStorm.type} Center Core`;
    probability = 100;
    riskLevel = "EXTREME";
    confidence = 95;
    windSpeed = storm.maxWindSpeed;
    pressure = storm.pressure;
    rainfall = 65;
    humidity = 98;
    temp = 26;
    lightningProb = 95;
  } else if (selectedLocationType === 'city' && selectedLocationId) {
    const city = cities.find(c => c.id === selectedLocationId);
    if (city) {
      const snap = calculateCityWeather(city, timeOffset, isHistorical ? null : liveData, isHistorical ? historicalData : null);
      title = `${city.name}`;
      subtitle = `${city.country}`;
      probability = snap.aiPrediction.probability;
      riskLevel = snap.aiPrediction.riskLevel;
      confidence = snap.aiPrediction.confidence;
      windSpeed = snap.weather.windSpeed;
      pressure = snap.weather.pressure;
      rainfall = snap.weather.rainfall;
      humidity = snap.weather.humidity;
      temp = snap.weather.temp;
      lightningProb = snap.weather.lightningProb;
    }
  } else {
    // General regional averages (Indian Subcontinent / Bay of Bengal region)
    title = "AI COMMAND CENTER";
    subtitle = "Indian Subcontinent / Bay of Bengal Grid";
    
    // Average metrics of all warning cities
    const snaps = cities.map(c => calculateCityWeather(c, timeOffset));
    const count = snaps.length;
    probability = Math.round(snaps.reduce((acc, s) => acc + s.aiPrediction.probability, 0) / count);
    confidence = Math.round(snaps.reduce((acc, s) => acc + s.aiPrediction.confidence, 0) / count);
    windSpeed = Math.round(snaps.reduce((acc, s) => acc + s.weather.windSpeed, 0) / count);
    pressure = Math.round(snaps.reduce((acc, s) => acc + s.weather.pressure, 0) / count);
    rainfall = Number((snaps.reduce((acc, s) => acc + s.weather.rainfall, 0) / count).toFixed(1));
    humidity = Math.round(snaps.reduce((acc, s) => acc + s.weather.humidity, 0) / count);
    temp = Math.round(snaps.reduce((acc, s) => acc + s.weather.temp, 0) / count);
    lightningProb = Math.round(snaps.reduce((acc, s) => acc + s.weather.lightningProb, 0) / count);

    // Determine aggregate threat
    if (probability > 70) riskLevel = "HIGH";
    else if (probability > 40) riskLevel = "MEDIUM";
    else riskLevel = "LOW";
  }

  const getRiskColor = (lvl: string) => {
    switch (lvl) {
      case 'EXTREME': return 'text-red-400 bg-red-950/40 border-red-500/30';
      case 'HIGH': return 'text-orange-400 bg-orange-950/40 border-orange-500/30';
      case 'MEDIUM': return 'text-yellow-400 bg-yellow-950/40 border-yellow-500/30';
      default: return 'text-emerald-400 bg-emerald-950/40 border-emerald-500/30';
    }
  };

  return (
    <div className="glass-panel rounded-2xl p-4 shadow-2xl border border-slate-700/40 text-slate-100 flex flex-col gap-4 max-h-[85vh] overflow-y-auto w-full">
      
      {/* Title */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <div>
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-sky-400 animate-pulse" />
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-400">
              AI Command Center
            </h2>
          </div>
          <p className="text-xs text-slate-500 font-semibold">{title} &middot; {subtitle}</p>
        </div>

        {selectedLocationId && (
          <button 
            onClick={onCloseLocation}
            className="text-[10px] bg-slate-800 border border-slate-700 text-sky-400 hover:text-white px-2 py-0.5 rounded transition-all"
          >
            Clear Filter
          </button>
        )}
      </div>

      {/* Quick Stats Grid */}
      <div className="grid grid-cols-3 gap-2">
        {/* Probability Card */}
        <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-2.5 flex flex-col items-center justify-center text-center">
          <span className="text-[18px] font-black text-white font-mono">{probability}%</span>
          <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wide">Storm Prob</span>
        </div>

        {/* Risk Card */}
        <div className={`border rounded-xl p-2.5 flex flex-col items-center justify-center text-center ${getRiskColor(riskLevel)}`}>
          <span className="text-[12px] font-black tracking-wider font-mono">{riskLevel}</span>
          <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wide mt-1">Threat Level</span>
        </div>

        {/* Confidence Card */}
        <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-2.5 flex flex-col items-center justify-center text-center">
          <span className="text-[18px] font-black text-white font-mono">{confidence}%</span>
          <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wide">Confidence</span>
        </div>
      </div>

      {/* Main Charts Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        
        {/* Wind Speed Trend Chart */}
        <div className="bg-slate-900/40 border border-slate-800/80 rounded-xl p-3 flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <Wind className="w-3.5 h-3.5 text-sky-400" />
              Wind Trend (km/h)
            </span>
            <span className="text-xs font-bold text-white font-mono flex items-center gap-1">
              <TrendingUp className="w-3 h-3 text-red-400" />
              {windSpeed} km/h
            </span>
          </div>

          <div className="h-28 w-full font-mono text-[9px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trendData} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorWind" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#38bdf8" stopOpacity={0.4}/>
                    <stop offset="95%" stopColor="#38bdf8" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <XAxis dataKey="hour" stroke="#475569" tickLine={false} />
                <YAxis stroke="#475569" tickLine={false} domain={[0, 'auto']} />
                <ChartTooltip 
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', color: '#f8fafc' }}
                  labelStyle={{ fontWeight: 'bold', fontSize: '10px' }}
                />
                <Area type="monotone" dataKey="windSpeed" name="Wind Speed" stroke="#38bdf8" strokeWidth={2} fillOpacity={1} fill="url(#colorWind)" />
                {compareDate && <Area type="monotone" dataKey="compareWindSpeed" name="Compare Wind" stroke="#a855f7" strokeWidth={1.5} strokeDasharray="3 3" fillOpacity={0} dot={false} />}
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Pressure Trend Chart */}
        <div className="bg-slate-900/40 border border-slate-800/80 rounded-xl p-3 flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <Gauge className="w-3.5 h-3.5 text-purple-400" />
              Pressure Trend (hPa)
            </span>
            <span className="text-xs font-bold text-white font-mono flex items-center gap-1">
              <TrendingDown className="w-3 h-3 text-sky-400" />
              {pressure} hPa
            </span>
          </div>

          <div className="h-28 w-full font-mono text-[9px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendData} margin={{ top: 5, right: 5, left: -15, bottom: 0 }}>
                <XAxis dataKey="hour" stroke="#475569" tickLine={false} />
                <YAxis stroke="#475569" tickLine={false} domain={['dataMin - 10', 'dataMax + 10']} />
                <ChartTooltip 
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', color: '#f8fafc' }}
                  labelStyle={{ fontWeight: 'bold', fontSize: '10px' }}
                />
                <Line type="monotone" dataKey="pressure" name="Barometric" stroke="#a855f7" strokeWidth={2} dot={{ r: 2 }} activeDot={{ r: 4 }} />
                {compareDate && <Line type="monotone" dataKey="comparePressure" name="Compare Pressure" stroke="#38bdf8" strokeWidth={1.5} strokeDasharray="3 3" dot={false} />}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

      </div>

      {/* Secondary Metrics Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {/* Rainfall */}
        <div className="bg-slate-900/40 border border-slate-800/80 rounded-xl p-2.5 flex items-center gap-2">
          <CloudRain className="w-4 h-4 text-blue-400 shrink-0" />
          <div className="flex flex-col">
            <span className="text-[8px] font-bold text-slate-500 uppercase font-mono">Rainfall</span>
            <span className="text-xs font-extrabold text-white font-mono">{rainfall} mm/h</span>
          </div>
        </div>

        {/* Humidity */}
        <div className="bg-slate-900/40 border border-slate-800/80 rounded-xl p-2.5 flex items-center gap-2">
          <Droplets className="w-4 h-4 text-cyan-400 shrink-0" />
          <div className="flex flex-col">
            <span className="text-[8px] font-bold text-slate-500 uppercase font-mono">Humidity</span>
            <span className="text-xs font-extrabold text-white font-mono">{humidity}%</span>
          </div>
        </div>

        {/* Temp */}
        <div className="bg-slate-900/40 border border-slate-800/80 rounded-xl p-2.5 flex items-center gap-2">
          <Thermometer className="w-4 h-4 text-orange-400 shrink-0" />
          <div className="flex flex-col">
            <span className="text-[8px] font-bold text-slate-500 uppercase font-mono">Temperature</span>
            <span className="text-xs font-extrabold text-white font-mono">{temp}°C</span>
          </div>
        </div>

        {/* Lightning */}
        <div className="bg-slate-900/40 border border-slate-800/80 rounded-xl p-2.5 flex items-center gap-2">
          <Zap className="w-4 h-4 text-yellow-400 shrink-0" />
          <div className="flex flex-col">
            <span className="text-[8px] font-bold text-slate-500 uppercase font-mono">Lightning</span>
            <span className="text-xs font-extrabold text-white font-mono">{lightningProb}%</span>
          </div>
        </div>
      </div>

      {/* Warnings & Advisories */}
      <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 flex gap-2.5 items-start">
        <AlertOctagon className="w-5 h-5 text-red-400 shrink-0 mt-0.5 animate-bounce" />
        <div className="text-[11px] leading-relaxed text-red-300 font-semibold">
          {selectedLocationType === 'city' ? (
            <span>Warning: AI forecasts high-velocity hurricane winds and convective precipitations approaching this location. Activate storm shelters.</span>
          ) : (
            <span>Regional Warning: Active storms tracking NW in Bay of Bengal. High risk of storm surges, coastal flooding and landslides.</span>
          )}
        </div>
      </div>




    </div>
  );
}
