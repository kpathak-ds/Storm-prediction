import { X, Thermometer, Wind, Droplets, Gauge, CloudRain, Cloud, Compass, Eye, Zap, AlertTriangle, ShieldCheck, Sunrise, Sunset, Activity, Download, Compass as DirectionIcon } from 'lucide-react';
import { AreaChart, Area, LineChart, Line, ResponsiveContainer, XAxis, YAxis, Tooltip as ChartTooltip } from 'recharts';
import { 
  calculateCityWeather,
  getInterpolatedStormState,
  cities,
  globalStorms
} from '../mockData';
import type { 
  CityInfo, 
  LiveWeatherData, 
  AIStormPrediction, 
  Coordinate
} from '../mockData';

import { useEffect, useState } from 'react';
import { fetchLiveWeather, type OpenMeteoData } from '../api/openMeteo';
import { getHistoricalRecord } from '../api/historicalData';
import { stormModel } from '../api/aiModel';
import { jsPDF } from 'jspdf';
import CustomDatePicker from './CustomDatePicker';
import { fetchFuturePrediction, getFuturePrediction, type FuturePredictionResult } from '../api/futureService';

type PanelTab = 'present' | 'past' | 'future';
type PastRange = 'yesterday' | '7days' | '30days' | 'custom';

interface SidePanelProps {
  locationId: string | null;
  locationType: 'city' | 'storm' | null;
  timeOffset: number;
  selectedDate: string;
  compareDate: string | null;
  onClose: () => void;
  activeTab?: PanelTab;
  onTabChange?: (tab: PanelTab) => void;
}

interface AIPastPrediction {
  probability: number;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'EXTREME';
  confidence: number;
  explainableAI: string[];
  stormOccurred: boolean;
  stormStatus: string;
}

function calculatePastStormPrediction(data: {
  temp: number;
  humidity: number;
  pressure: number;
  windSpeed: number;
  windGust: number;
  rainfall: number;
  cloudCover: number;
}): AIPastPrediction {
  const prediction = stormModel.predict([data.temp, data.humidity, data.pressure, data.windSpeed, data.rainfall]);
  
  const explainableAI: string[] = [];
  if (prediction.stormOccurred) {
    explainableAI.push(`Storm passage confirmed: ${prediction.probability}% probability classified by the trained Logistic Regression model.`);
  } else {
    explainableAI.push(`No storm detected: Stable conditions (${prediction.probability}% probability) classified by the trained Logistic Regression model.`);
  }

  if (data.windGust > 45) {
    explainableAI.push(`Severe gust speeds registered (${data.windGust} km/h), indicating active outer cyclonic wind bands.`);
  } else if (data.windSpeed > 25) {
    explainableAI.push(`Brisk wind speeds recorded (${data.windSpeed} km/h), indicating regional pressure gradients.`);
  }

  const baseline = data.pressure < 930 ? 887 : 1013;
  const drop = Math.max(0, baseline - data.pressure);
  if (drop > 5) {
    explainableAI.push(`Significant barometric depression (${data.pressure} hPa, -${drop} hPa deviation from baseline).`);
  }

  if (data.rainfall > 5) {
    explainableAI.push(`Convective atmospheric moisture flow: heavy precipitation detected (${data.rainfall} mm/hr).`);
  }

  explainableAI.push(`AI Engine: Trained on NASA/POWER MERRA-2 historical daily records.`);

  return {
    probability: prediction.probability,
    riskLevel: prediction.riskLevel,
    confidence: prediction.confidence,
    stormOccurred: prediction.stormOccurred,
    stormStatus: prediction.stormOccurred ? "STORM OCCURRED" : "NO STORM OCCURRED",
    explainableAI
  };
}

export default function SidePanel({ locationId, locationType, timeOffset, selectedDate, compareDate, onClose, activeTab: propTab, onTabChange: propSetTab }: SidePanelProps) {
  const [localTab, setLocalTab] = useState<PanelTab>('present');
  const tab = propTab !== undefined ? propTab : localTab;
  const setTab = propSetTab !== undefined ? propSetTab : setLocalTab;

  const [futureTimelineOffset, setFutureTimelineOffset] = useState<number>(3); // default +3 Hours
  const [pastRange, setPastRange] = useState<PastRange>('yesterday');
  const [customDate, setCustomDate] = useState(new Date().toISOString().split('T')[0]);
  const [pastData, setPastData] = useState<any>(null);
  const [pastLoading, setPastLoading] = useState(false);
  const [pastError, setPastError] = useState('');
  const [futureResult, setFutureResult] = useState<FuturePredictionResult | null>(null);
  const [futureLoading, setFutureLoading] = useState(false);
  const [futureError, setFutureError] = useState('');
  const [isCustomFutureDate, setIsCustomFutureDate] = useState(false);
  const tomorrowStr = new Date(Date.now() + 86400000).toISOString().split('T')[0];
  const [customFutureDate, setCustomFutureDate] = useState(tomorrowStr);
  const [liveData, setLiveData] = useState<OpenMeteoData | null>(null);
  const [historicalData, setHistoricalData] = useState<any>(null);
  const [futureMLData, setFutureMLData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState(false);
  const [aqi, setAqi] = useState<number | null>(null);
  // Dummy usage to avoid TS unused variable warning
  void compareDate; void futureMLData; void setFutureMLData; void loading; void setLoading;
  const todayStr = new Date().toISOString().split('T')[0];
  const isToday = selectedDate === todayStr;
  const isHistorical = selectedDate < todayStr;
  const isFuture = selectedDate > todayStr;

  useEffect(() => {
    if (!locationId || locationType !== 'city') return;
    const city = cities.find(c => c.id === locationId);
    if (!city) return;

    const fetchWeather = async () => {
      setLoading(true);
      setApiError(false);
      try {
        if (isToday) {
          const data = await fetchLiveWeather(city.coord);
          setLiveData(data);
          setHistoricalData(null);
          setFutureMLData(null);
          try {
            const aqiRes = await fetch(`https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${city.coord.lat}&longitude=${city.coord.lng}&current=us_aqi`);
            if (aqiRes.ok) {
              const aqiJson = await aqiRes.json();
              setAqi(aqiJson.current?.us_aqi ?? null);
            } else {
              setAqi(null);
            }
          } catch (e) {
            setAqi(null);
          }
        } else if (isHistorical) {
          const { getHistoricalRecord } = await import('../api/historicalData');
          const csvRecord = await getHistoricalRecord(selectedDate);
          if (csvRecord) {
            setHistoricalData({
              ...csvRecord,
              source: 'CSV (NASA/POWER)'
            });
            setLiveData(null);
            setFutureMLData(null);
          } else {
            const r = await fetch(`https://archive-api.open-meteo.com/v1/archive?latitude=${city.coord.lat}&longitude=${city.coord.lng}&start_date=${selectedDate}&end_date=${selectedDate}&hourly=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,cloud_cover,visibility,pressure_msl,wind_speed_10m,wind_gusts_10m,wind_direction_10m,dew_point_2m&daily=sunrise,sunset,uv_index_max&timezone=auto`);
            if (r.ok) {
              const d = await r.json();
              if (d.hourly?.time?.length > 0) {
                setHistoricalData({
                  date: selectedDate,
                  hourly: d.hourly,
                  daily: d.daily,
                  temp: Math.round(d.hourly.temperature_2m[12] ?? 25),
                  humidity: Math.round(d.hourly.relative_humidity_2m[12] ?? 60),
                  pressure: Math.round(d.hourly.pressure_msl[12] ?? 1013),
                  windSpeed: Math.round(d.hourly.wind_speed_10m[12] ?? 10),
                  windGust: Math.round(d.hourly.wind_gusts_10m[12] ?? 15),
                  windDirection: Math.round(d.hourly.wind_direction_10m[12] ?? 180),
                  rainfall: d.daily.precipitation_sum?.[0] ?? 0,
                  cloudCover: Math.round(d.hourly.cloud_cover[12] ?? 30),
                  sunrise: d.daily.sunrise?.[0] ?? '',
                  sunset: d.daily.sunset?.[0] ?? '',
                  source: 'Open-Meteo Archive'
                });
                setLiveData(null);
                setFutureMLData(null);
              } else {
                setApiError(true);
              }
            } else {
              setApiError(true);
            }
          }
        } else if (isFuture) {
          // Future predictions are handled independently by the Future tab's own useEffect
          // which calls fetchFuturePrediction() from the refactored futureService.
          // This branch is intentionally left as a no-op to avoid dual fetch conflicts.
          setLiveData(null);
          setHistoricalData(null);
        }
      } catch (err) {
        setApiError(true);
      } finally {
        setLoading(false);
      }
    };

    fetchWeather();
    let interval: any = null;
    if (isToday) {
      interval = setInterval(fetchWeather, 5 * 60 * 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [locationId, locationType, selectedDate, isToday, isHistorical, isFuture]);

  // Fetch PAST data
  useEffect(() => {
    if (tab !== 'past' || locationType !== 'city') return;
    const city = cities.find(c => c.id === locationId);
    if (!city) return;

    let active = true;
    setPastLoading(true);
    setPastError('');

    const fetchPast = async () => {
      let dateStr = '';
      if (pastRange === 'yesterday') { const d = new Date(); d.setDate(d.getDate()-1); dateStr = d.toISOString().split('T')[0]; }
      else if (pastRange === 'custom') { dateStr = customDate; }
      else { const d = new Date(); d.setDate(d.getDate()-(pastRange==='7days'?7:30)); dateStr = d.toISOString().split('T')[0]; }

      try {
        const csvLat = 26.7578;
        const csvLng = 40.9869;
        const dist = Math.sqrt(Math.pow(city.coord.lat - csvLat, 2) + Math.pow(city.coord.lng - csvLng, 2));

        let resolvedData: any = null;
        let sourceName = '';

        if (dist < 2.0) {
          const csv = await getHistoricalRecord(dateStr);
          if (csv) {
            resolvedData = csv;
            sourceName = 'CSV (NASA/POWER)';
          }
        }

        if (!resolvedData) {
          const r = await fetch(`https://archive-api.open-meteo.com/v1/archive?latitude=${city.coord.lat}&longitude=${city.coord.lng}&start_date=${dateStr}&end_date=${dateStr}&hourly=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,cloud_cover,visibility,pressure_msl,wind_speed_10m,wind_gusts_10m,wind_direction_10m,dew_point_2m&daily=sunrise,sunset,uv_index_max&timezone=auto`);
          if (!active) return;

          if (r.ok) {
            const d = await r.json();
            if (d.hourly?.time?.length > 0) {
              resolvedData = {
                date: dateStr,
                hourly: d.hourly,
                daily: d.daily,
                temp: Math.round(d.hourly.temperature_2m[12] ?? 25),
                humidity: Math.round(d.hourly.relative_humidity_2m[12] ?? 60),
                pressure: Math.round(d.hourly.pressure_msl[12] ?? 1013),
                windSpeed: Math.round(d.hourly.wind_speed_10m[12] ?? 10),
                windGust: Math.round(d.hourly.wind_gusts_10m[12] ?? 15),
                windDirection: Math.round(d.hourly.wind_direction_10m[12] ?? 180),
                rainfall: d.daily.precipitation_sum?.[0] ?? 0,
                cloudCover: Math.round(d.hourly.cloud_cover[12] ?? 30),
                sunrise: d.daily.sunrise?.[0] ?? '',
                sunset: d.daily.sunset?.[0] ?? '',
              };
              sourceName = 'Open-Meteo Archive';
            }
          }
        }

        if (!active) return;

        if (resolvedData) {
          setPastData({ source: sourceName, ...resolvedData });
          setPastError('');
        } else {
          setPastError('Failed to fetch historical data.');
        }
      } catch {
        if (active) setPastError('Network error.');
      } finally {
        if (active) setPastLoading(false);
      }
    };

    fetchPast();
    return () => {
      active = false;
    };
  }, [tab, pastRange, customDate, locationId, locationType]);

  // Fetch FUTURE data — unified through the refactored futureService
  useEffect(() => {
    if (tab !== 'future' || locationType !== 'city') return;
    const city = cities.find(c => c.id === locationId);
    if (!city) return;

    let active = true;
    setFutureLoading(true);
    setFutureError('');

    // Compute the actual target date
    let targetDate: string;
    if (isCustomFutureDate) {
      targetDate = customFutureDate;
    } else {
      // Convert hour offset to a target date
      const offsetMs = futureTimelineOffset * 60 * 60 * 1000;
      const target = new Date(Date.now() + offsetMs);
      targetDate = target.toISOString().split('T')[0];
      // If the offset is small enough that targetDate is still today, push to tomorrow
      const todayLocal = new Date().toISOString().split('T')[0];
      if (targetDate <= todayLocal) {
        const tomorrow = new Date(Date.now() + 86400000);
        targetDate = tomorrow.toISOString().split('T')[0];
      }
    }

    console.log(`[SidePanel] Future fetch: targetDate=${targetDate}, isCustom=${isCustomFutureDate}, offset=${futureTimelineOffset}h`);

    fetchFuturePrediction(city.coord, targetDate, city)
      .then(result => {
        if (!active) return;
        setFutureResult(result);
        if (!result.success) {
          setFutureError(result.error || 'Unknown error fetching future prediction.');
          console.error('[SidePanel] Future prediction failed:', result.error);
        } else {
          setFutureError('');
          console.log('[SidePanel] Future prediction success:', {
            dataSource: result.dataSource,
            targetDate: result.data?.targetDate,
            stormProbability: result.data?.stormProbability,
            threatLevel: result.data?.threatLevel,
          });
        }
      })
      .catch(err => {
        if (!active) return;
        const errorMsg = `Future prediction failed: ${err?.message || 'Network error'}`;
        setFutureError(errorMsg);
        console.error('[SidePanel] Future prediction error:', err);
      })
      .finally(() => {
        if (active) setFutureLoading(false);
      });

    return () => { active = false; };
  }, [tab, isCustomFutureDate, customFutureDate, futureTimelineOffset, locationId, locationType]);

  if (!locationId || !locationType) return null;

  let title = "";
  let subtitle = "";
  let coordinate: Coordinate = { lat: 0, lng: 0 };
  let weather: LiveWeatherData;
  let ai: AIStormPrediction;
  let distanceToEye = 0;

  if (locationType === 'storm') {
    const activeStorm = globalStorms.find(s => s.id === locationId) || globalStorms[0];
    const storm = getInterpolatedStormState(timeOffset, activeStorm.track);
    title = activeStorm.name;

    // Determine category dynamically based on wind speed
    let stormCat = activeStorm.category;
    const wind = storm.maxWindSpeed;
    if (wind >= 252) stormCat = 5;
    else if (wind >= 209) stormCat = 4;
    else if (wind >= 178) stormCat = 3;
    else if (wind >= 154) stormCat = 2;
    else if (wind >= 119) stormCat = 1;
    else stormCat = 0;

    subtitle = stormCat > 0 
      ? `Category ${stormCat} ${activeStorm.type}` 
      : activeStorm.type;
      
    coordinate = storm.position;
    
    weather = {
      temp: 26,
      feelsLike: 23,
      humidity: 98,
      pressure: storm.pressure,
      windSpeed: storm.maxWindSpeed,
      windGust: storm.gusts,
      visibility: 1.0,
      rainfall: Math.round(storm.maxWindSpeed / 2.7),
      cloudCover: 100,
      lightningProb: 95
    };

    ai = {
      probability: activeStorm.probability,
      riskLevel: stormCat >= 4 ? 'EXTREME' : stormCat >= 3 ? 'HIGH' : stormCat >= 2 ? 'MEDIUM' : 'LOW',
      confidence: 95,
      arrivalTime: 0,
      duration: 18,
      direction: storm.direction,
      speed: storm.speed,
      radius: storm.radius,
      explainableAI: [
        `Active storm tracking: Current movement is ${activeStorm.forecastMovement || 'Northwest'}.`,
        `Central pressure dropped to ultra-low levels (${storm.pressure} hPa) indicating extreme storm cyclogenesis.`,
        `Maximum sustained winds are at hurricane force (${storm.maxWindSpeed} km/h, gusting to ${storm.gusts} km/h).`,
        `Core convective cloud band is completely closed (100% cover) with intense rainfall (${weather.rainfall} mm/hr).`,
        `Eye structure is defined at Latitude ${storm.position.lat.toFixed(4)}, Longitude ${storm.position.lng.toFixed(4)}.`
      ]
    };
  } else {
    // City selected
    const city = cities.find((c: CityInfo) => c.id === locationId);
    if (!city) return null;

    const snapshot = calculateCityWeather(city, timeOffset, isToday ? liveData : null, isHistorical ? historicalData : (isFuture ? futureMLData : null), tab);
    title = city.name;
    subtitle = `${city.state}, ${city.country}`;
    coordinate = city.coord;
    weather = snapshot.weather;
    // Override weather with future prediction data when available
    if (tab === 'future' && futureResult?.success && futureResult.data) {
      const fd = futureResult.data;
      weather = {
        temp: fd.temp,
        feelsLike: fd.feelsLike,
        humidity: fd.humidity,
        pressure: fd.pressure,
        windSpeed: fd.windSpeed,
        windGust: fd.windGust,
        visibility: typeof fd.visibility === 'number' && fd.visibility > 1000 ? Math.round(fd.visibility / 1000) : fd.visibility,
        rainfall: fd.rainfall,
        cloudCover: fd.cloudCover,
        lightningProb: fd.lightning
      };
    }
    distanceToEye = snapshot.distanceToEye;

    // Run active weather metrics through the trained Logistic Regression model
    const prediction = stormModel.predict([
      weather.temp,
      weather.humidity,
      weather.pressure,
      weather.windSpeed,
      weather.rainfall
    ]);

    ai = {
      ...snapshot.aiPrediction,
      probability: prediction.probability,
      riskLevel: prediction.riskLevel,
      confidence: prediction.confidence,
    };
  }

  const presentStormOccurred = ai.probability >= 45 || weather.windSpeed >= 38 || weather.windGust >= 52;
  const presentStormStatus = presentStormOccurred ? "STORM DETECTED" : "NO STORM DETECTED";

  // Circular progress stroke helper
  const renderCircleGauge = (percent: number, colorClass: string, strokeWidth = 6) => {
    const radius = 32;
    const circumference = 2 * Math.PI * radius;
    const strokeDashoffset = circumference - (percent / 100) * circumference;

    return (
      <svg className="w-20 h-20 transform -rotate-90">
        <circle
          cx="40"
          cy="40"
          r={radius}
          className="stroke-slate-800"
          strokeWidth={strokeWidth}
          fill="transparent"
        />
        <circle
          cx="40"
          cy="40"
          r={radius}
          className={`${colorClass} transition-all duration-500 ease-out`}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          fill="transparent"
        />
      </svg>
    );
  };

  const getRiskColor = (risk: string) => {
    switch (risk) {
      case 'EXTREME': return 'text-red-500 bg-red-500/10 border-red-500/30';
      case 'HIGH': return 'text-orange-500 bg-orange-500/10 border-orange-500/30';
      case 'MEDIUM': return 'text-yellow-500 bg-yellow-500/10 border-yellow-500/30';
      default: return 'text-emerald-500 bg-emerald-500/10 border-emerald-500/30';
    }
  };
  const handleExportReport = () => {
    const modeStr = isToday ? "Live Observations" : isHistorical ? "Historical Record" : "ML Prediction";

    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    // 1. Header Banner
    doc.setFillColor(12, 14, 20); // Dark background
    doc.rect(0, 0, 210, 38, 'F');
    
    // Branding
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(20);
    doc.text('AeroTempest AI', 20, 16);
    
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(147, 197, 253); // Light blue
    doc.text('STORM INTELLIGENCE PLATFORM', 20, 22);

    doc.setFontSize(12);
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.text('METEOROLOGICAL BRIEFING', 120, 20);
    
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(156, 163, 175);
    doc.text(`Generated: ${new Date().toLocaleString('en-IN')}`, 120, 25);

    // 2. Metadata Section (Location details)
    doc.setTextColor(30, 41, 59);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text(title, 20, 50);
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    doc.text(subtitle, 20, 55);
    doc.text(`Coordinates: ${coordinate.lat.toFixed(4)}° N, ${coordinate.lng.toFixed(4)}° E`, 20, 60);
    doc.text(`Forecast Date: ${selectedDate} (${modeStr})`, 20, 65);

    // Divider Line
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.5);
    doc.line(20, 72, 190, 72);

    // 3. Observations Section (2-Column Grid)
    doc.setTextColor(30, 41, 59);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('WEATHER OBSERVATIONS SUMMARY', 20, 82);

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);

    // Column 1
    doc.text(`Temperature: ${weather.temp}°C`, 20, 92);
    doc.text(`Humidity: ${weather.humidity}%`, 20, 98);
    doc.text(`Wind Speed: ${weather.windSpeed} km/h`, 20, 104);
    doc.text(`Wind Gusts: ${weather.windGust} km/h`, 20, 110);
    
    // Column 2
    doc.text(`Barometric Pressure: ${weather.pressure} hPa`, 110, 92);
    doc.text(`Rainfall / Precip: ${weather.rainfall} mm/h`, 110, 98);
    doc.text(`Cloud Cover: ${weather.cloudCover}%`, 110, 104);
    doc.text(`Visibility: ${isFuture ? 'N/A (ML)' : `${weather.visibility} km`}`, 110, 110);

    let nextY = 116;
    if (isToday) {
      if (liveData?.daily?.uvIndexMax?.[0] !== undefined) {
        doc.text(`UV Index (Max): ${liveData.daily.uvIndexMax[0]}`, 20, 116);
      }
      if (aqi !== null) {
        doc.text(`Air Quality Index: ${aqi} AQI`, 110, 116);
      }
      nextY = 122;
    }

    doc.line(20, nextY + 6, 190, nextY + 6);

    // 4. AI Prediction Section
    const aiY = nextY + 16;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(30, 41, 59);
    doc.text('AI STORM PREDICTION & RISK ANALYTICS', 20, aiY);

    // Risk Level Badge Box
    const risk = ai.riskLevel;
    let badgeColor = [16, 185, 129]; // Low - Green
    if (risk === 'EXTREME') badgeColor = [239, 68, 68]; // Red
    else if (risk === 'HIGH') badgeColor = [249, 115, 22]; // Orange
    else if (risk === 'MEDIUM') badgeColor = [234, 179, 8]; // Yellow

    const badgeY = aiY + 6;
    doc.setFillColor(badgeColor[0], badgeColor[1], badgeColor[2]);
    doc.rect(20, badgeY, 45, 18, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('RISK LEVEL', 23, badgeY + 6);
    doc.setFontSize(12);
    doc.text(risk, 23, badgeY + 14);

    // Probability & Confidence Boxes
    doc.setFillColor(241, 245, 249);
    doc.rect(75, badgeY, 50, 18, 'F');
    doc.setTextColor(30, 41, 59);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text('STORM PROBABILITY', 78, badgeY + 6);
    doc.setFontSize(12);
    doc.text(`${ai.probability}%`, 78, badgeY + 14);

    doc.setFillColor(241, 245, 249);
    doc.rect(135, badgeY, 55, 18, 'F');
    doc.setTextColor(30, 41, 59);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text('MODEL CONFIDENCE', 138, badgeY + 6);
    doc.setFontSize(12);
    doc.text(`${ai.confidence}%`, 138, badgeY + 14);

    // Explainable AI Insights
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(30, 41, 59);
    doc.text('Explainable AI Insights & Decision Logic:', 20, badgeY + 32);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(71, 85, 105);
    let yPos = badgeY + 40;
    ai.explainableAI.forEach((insight) => {
      const splitText = doc.splitTextToSize(`* ${insight}`, 170);
      splitText.forEach((line: string) => {
        doc.text(line, 20, yPos);
        yPos += 5;
      });
      yPos += 1;
    });

    // 5. 7-Day Forecast (If today is selected, add to Page 2)
    if (isToday && liveData?.daily) {
      doc.addPage();
      
      // Page 2 Header
      doc.setFillColor(12, 14, 20);
      doc.rect(0, 0, 210, 20, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.text('AeroTempest AI - 7-Day Extended Forecast', 20, 13);

      doc.setTextColor(30, 41, 59);
      doc.setFontSize(12);
      doc.text('DAILY METEOROLOGICAL TRENDS', 20, 32);

      let forecastY = 44;
      liveData.daily.time.forEach((dateStr, idx) => {
        const maxT = Math.round(liveData.daily.temperature2mMax[idx]);
        const minT = Math.round(liveData.daily.temperature2mMin[idx]);
        const dayName = new Date(dateStr).toLocaleDateString('en-IN', { weekday: 'long', month: 'short', day: 'numeric' });
        
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.text(dayName, 20, forecastY);

        doc.setFont('helvetica', 'normal');
        doc.text(`Max Temp: ${maxT}°C   |   Min Temp: ${minT}°C`, 80, forecastY);

        // Draw a light grey underline
        doc.setDrawColor(241, 245, 249);
        doc.setLineWidth(0.3);
        doc.line(20, forecastY + 3, 190, forecastY + 3);

        forecastY += 12;
      });
    }

    // 6. Footer on all pages
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184);
      doc.text('CONFIDENTIAL - FOR RESEARCH & SIMULATION USE ONLY', 20, 287);
      doc.text(`Page ${i} of ${pageCount}`, 175, 287);
    }

    doc.save(`AeroTempest_Briefing_${title.replace(/\s+/g, '_')}_${selectedDate}.pdf`);
  };
  return (
    <div className="glass-panel w-96 h-full flex flex-col shadow-2xl border-l border-slate-700/40 text-slate-200 overflow-y-auto animate-in slide-in-from-right duration-300">
      
      {/* Header */}
      <div className="flex items-center justify-between p-5 border-b border-slate-800 shrink-0">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-white">{title}</h2>
          <p className="text-xs text-slate-400 font-medium">{subtitle}</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Export Report */}
          <button
            onClick={handleExportReport}
            className="p-1.5 rounded-lg bg-sky-500/10 border border-sky-500/20 text-sky-400 hover:bg-sky-500/20 hover:text-sky-300 transition-all flex items-center gap-1.5 text-xs font-bold"
            title="Download Meteorological Report"
          >
            <Download className="w-4 h-4" />
            <span>Export</span>
          </button>
          
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-slate-800/40 border border-slate-700/60 hover:bg-slate-700/60 hover:text-white transition-all"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Tab Bar */}
      <div className="flex border-b border-slate-800 shrink-0">
        {(['present','past','future'] as PanelTab[]).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`flex-1 py-2.5 text-[11px] font-bold uppercase tracking-wider transition-colors ${tab===t?'text-sky-400 border-b-2 border-sky-400 bg-sky-500/5':'text-slate-500 hover:text-slate-300'}`}>
            {t}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-6">

        {/* PAST TAB */}
        {tab==='past' && (
          <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-3 bg-slate-950/40 border border-slate-800 rounded-xl p-3">
              <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Select Historical Period</span>
              <div className="flex gap-1.5 flex-wrap">
                {(['yesterday','7days','30days','custom'] as PastRange[]).map(r=>(
                  <button key={r} onClick={()=>setPastRange(r)} className={`px-2.5 py-1.5 rounded-lg text-[10px] font-bold uppercase transition-all ${pastRange===r?'bg-sky-500 text-white shadow-lg shadow-sky-500/20':'bg-slate-900/60 border border-slate-800 text-slate-400 hover:text-white'}`}>
                    {r==='yesterday'?'Yesterday':r==='7days'?'Last 7 Days':r==='30days'?'Last 30 Days':'Custom'}
                  </button>
                ))}
              </div>
              {pastRange==='custom' && (
                <div className="w-full mt-1.5 animate-in fade-in duration-150">
                  <CustomDatePicker 
                    value={customDate} 
                    onChange={setCustomDate} 
                  />
                </div>
              )}
            </div>

            {pastLoading && (
              <div className="flex flex-col gap-4 animate-pulse py-4">
                <div className="h-14 bg-slate-900 rounded-xl" />
                <div className="grid grid-cols-2 gap-4">
                  <div className="h-28 bg-slate-900 rounded-xl" />
                  <div className="h-28 bg-slate-900 rounded-xl" />
                </div>
                <div className="h-24 bg-slate-900 rounded-xl" />
                <div className="h-32 bg-slate-900 rounded-xl" />
              </div>
            )}

            {pastError && <div className="bg-orange-500/10 border border-orange-500/20 text-orange-400 p-3 rounded-xl flex items-center gap-2 text-xs"><AlertTriangle className="w-4 h-4"/>{pastError}</div>}
            
            {pastData && !pastLoading && (() => {
              const city = cities.find(c => c.id === locationId);
              if (!city) return null;

              const pastAI = calculatePastStormPrediction(pastData);
              const sunriseStr = pastData.daily?.sunrise?.[0] ? new Date(pastData.daily.sunrise[0]).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : '06:00 AM';
              const sunsetStr = pastData.daily?.sunset?.[0] ? new Date(pastData.daily.sunset[0]).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : '06:30 PM';

              const getPastObsValue = (param: string, offset: number) => {
                if (pastData?.hourly) {
                  const idx = Math.min(23, 12 + offset);
                  if (param === 'temp') return `${Math.round(pastData.hourly.temperature_2m[idx])}°`;
                  if (param === 'wind') return `${Math.round(pastData.hourly.wind_speed_10m[idx])}`;
                  if (param === 'pressure') return `${Math.round(pastData.hourly.pressure_msl[idx])}`;
                  if (param === 'humidity') return `${Math.round(pastData.hourly.relative_humidity_2m[idx])}%`;
                  if (param === 'rain') return `${(pastData.hourly.precipitation[idx] || 0).toFixed(1)}`;
                  if (param === 'cloud') return `${Math.round(pastData.hourly.cloud_cover[idx])}%`;
                  if (param === 'lightning') return `${Math.round(pastData.hourly.cloud_cover[idx] > 70 ? 45 : 5)}%`;
                  if (param === 'visibility') return `${Math.round(pastData.hourly.visibility[idx] / 1000)}k`;
                }
                if (param === 'temp') return `${Math.round(pastData.temp)}°`;
                if (param === 'wind') return `${Math.round(pastData.windSpeed)}`;
                if (param === 'pressure') return `${Math.round(pastData.pressure)}`;
                if (param === 'humidity') return `${Math.round(pastData.humidity)}%`;
                if (param === 'rain') return `${(pastData.rainfall).toFixed(1)}`;
                if (param === 'cloud') return `${Math.round(pastData.cloudCover)}%`;
                return 'N/A';
              };

              // Recharts data generation for the past trends
              const pastChartData = [];
              if (pastData.hourly) {
                for (let h = 0; h < 24; h += 3) {
                  const tVal = Math.round(pastData.hourly.temperature_2m[h]);
                  const wVal = Math.round(pastData.hourly.wind_speed_10m[h]);
                  const pVal = parseFloat((pastData.hourly.precipitation[h] || 0).toFixed(2));
                  const prVal = Math.round(pastData.hourly.pressure_msl[h]);
                  const huVal = Math.round(pastData.hourly.relative_humidity_2m[h]);
                  const cVal = Math.round(pastData.hourly.cloud_cover[h]);
                  const lVal = Math.round(pastData.hourly.lightning_probability?.[h] ?? (cVal > 70 ? 40 : 5));

                  const pred = getFuturePrediction({
                    temp: tVal,
                    humidity: huVal,
                    pressure: prVal,
                    windSpeed: wVal,
                    rainfall: pVal,
                    cloudCover: cVal,
                    lightning: lVal,
                  });

                  pastChartData.push({
                    hour: `${h}:00`,
                    temp: tVal,
                    windSpeed: wVal,
                    rainfall: pVal,
                    pressure: prVal,
                    humidity: huVal,
                    stormProb: pred.probability,
                  });
                }
              }

              return (
                <div className="flex flex-col gap-6 animate-in fade-in duration-200">
                  <div className="text-[9px] text-slate-500 uppercase font-mono tracking-wider">Source: {pastData.source}</div>

                  {/* Geo Coordinates & Distance Info */}
                  <div className="grid grid-cols-2 gap-3 bg-slate-950/40 border border-slate-800 rounded-xl p-3 text-xs font-mono">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-[10px] text-slate-500 uppercase tracking-wider">Latitude</span>
                      <span className="text-slate-200 font-semibold">{city.coord.lat.toFixed(4)}° N</span>
                    </div>
                    <div className="flex flex-col gap-0.5">
                      <span className="text-[10px] text-slate-500 uppercase tracking-wider">Longitude</span>
                      <span className="text-slate-200 font-semibold">{city.coord.lng.toFixed(4)}° E</span>
                    </div>
                  </div>

                  {/* AI Predictor for Past Date */}
                  <div className="flex flex-col gap-3">
                    <h3 className="text-xs font-extrabold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-sky-400" />
                      AI Storm Predictor (Historical)
                    </h3>

                    <div className="grid grid-cols-2 gap-4">
                      {/* Probability Gauge */}
                      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 flex flex-col items-center justify-center text-center relative overflow-hidden group">
                        <div className="relative flex items-center justify-center">
                          {renderCircleGauge(pastAI.probability, pastAI.probability > 75 ? 'stroke-red-500' : pastAI.probability > 45 ? 'stroke-orange-500' : pastAI.probability > 20 ? 'stroke-yellow-500' : 'stroke-emerald-500')}
                          <span className="absolute text-base font-extrabold text-white font-mono">
                            {pastAI.probability}%
                          </span>
                        </div>
                        <span className="text-[10px] font-bold text-slate-400 mt-2.5 uppercase tracking-wide">
                          Storm Probability
                        </span>
                      </div>

                      {/* Confidence Gauge */}
                      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 flex flex-col items-center justify-center text-center relative overflow-hidden group">
                        <div className="relative flex items-center justify-center">
                          {renderCircleGauge(pastAI.confidence, 'stroke-sky-400')}
                          <span className="absolute text-base font-extrabold text-white font-mono">
                            {pastAI.confidence}%
                          </span>
                        </div>
                        <span className="text-[10px] font-bold text-slate-400 mt-2.5 uppercase tracking-wide">
                          AI Confidence
                        </span>
                      </div>

                      {/* Risk Classification */}
                      <div className="col-span-2 bg-slate-900/60 border border-slate-800 rounded-xl p-3.5 flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-300">Storm Threat Classification</span>
                        <span className={`text-xs font-black tracking-widest px-3 py-1 rounded-md border ${getRiskColor(pastAI.riskLevel)}`}>
                          {pastAI.riskLevel}
                        </span>
                      </div>

                      {/* Storm Status Banner */}
                      <div className={`col-span-2 border rounded-xl p-3.5 flex flex-col gap-1.5 transition-all ${
                        pastAI.stormOccurred 
                          ? 'bg-red-500/10 border-red-500/20 text-red-400' 
                          : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                      }`}>
                        <span className="text-[9px] uppercase font-bold tracking-wider opacity-60">Status Analysis</span>
                        <span className="text-xs font-extrabold tracking-wide flex items-center gap-2">
                          <span className={`w-2.5 h-2.5 rounded-full ${pastAI.stormOccurred ? 'bg-red-500 animate-pulse' : 'bg-emerald-500'}`} />
                          {pastAI.stormStatus}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Explainable AI Insights */}
                  <div className="flex flex-col gap-2.5">
                    <h3 className="text-xs font-extrabold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-yellow-400 animate-pulse" />
                      Explainable AI Insights
                    </h3>
                    <div className="flex flex-col gap-2 bg-yellow-500/[0.02] border border-yellow-500/10 rounded-xl p-4">
                      {pastAI.explainableAI.map((insight, idx) => (
                        <div key={idx} className="flex gap-2.5 items-start text-xs leading-relaxed text-slate-300">
                          <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-yellow-400 shrink-0" />
                          <p>{insight}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Historical Weather Observations */}
                  <div className="flex flex-col gap-3">
                    <h3 className="text-xs font-extrabold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                      <Compass className="w-4 h-4 text-sky-400" />
                      Historical Weather Observations
                    </h3>

                    <div className="grid grid-cols-2 gap-2.5">
                      {/* Temperature */}
                      <div className="bg-slate-900/40 hover:bg-slate-900/60 border border-slate-800/80 rounded-xl p-3 flex flex-col transition-colors">
                        <div className="flex items-center gap-3">
                          <Thermometer className="w-5 h-5 text-orange-400 shrink-0" />
                          <div className="flex flex-col">
                            <span className="text-[10px] text-slate-500 uppercase font-mono">Temp</span>
                            <span className="text-sm font-bold text-white">{pastData.temp}°C</span>
                            <span className="text-[9px] text-slate-400">Midday Mean</span>
                          </div>
                        </div>
                        <div className="mt-2.5 pt-2.5 border-t border-slate-800/60 grid grid-cols-5 gap-1 text-[8px] font-mono text-center">
                          {[{o:-12,l:'00h'},{o:-6,l:'06h'},{o:0,l:'12h'},{o:6,l:'18h'},{o:11,l:'23h'}].map(({o,l}) => (
                            <div key={o} className="flex flex-col">
                              <span className="text-slate-500">{l}</span>
                              <span className="font-semibold text-slate-300">{getPastObsValue('temp', o)}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Wind */}
                      <div className="bg-slate-900/40 hover:bg-slate-900/60 border border-slate-800/80 rounded-xl p-3 flex flex-col transition-colors">
                        <div className="flex items-center gap-3">
                          <Wind className="w-5 h-5 text-sky-400 shrink-0" />
                          <div className="flex flex-col">
                            <span className="text-[10px] text-slate-500 uppercase font-mono">Wind</span>
                            <span className="text-sm font-bold text-white">{pastData.windSpeed} km/h</span>
                            <span className="text-[9px] text-slate-400">Gusts {pastData.windGust} km/h</span>
                          </div>
                        </div>
                        <div className="mt-2.5 pt-2.5 border-t border-slate-800/60 grid grid-cols-5 gap-1 text-[8px] font-mono text-center">
                          {[{o:-12,l:'00h'},{o:-6,l:'06h'},{o:0,l:'12h'},{o:6,l:'18h'},{o:11,l:'23h'}].map(({o,l}) => (
                            <div key={o} className="flex flex-col">
                              <span className="text-slate-500">{l}</span>
                              <span className="font-semibold text-slate-300">{getPastObsValue('wind', o)}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Pressure */}
                      <div className="bg-slate-900/40 hover:bg-slate-900/60 border border-slate-800/80 rounded-xl p-3 flex flex-col transition-colors">
                        <div className="flex items-center gap-3">
                          <Gauge className="w-5 h-5 text-purple-400 shrink-0" />
                          <div className="flex flex-col">
                            <span className="text-[10px] text-slate-500 uppercase font-mono">Pressure</span>
                            <span className="text-sm font-bold text-white">{pastData.pressure} hPa</span>
                            <span className="text-[9px] text-slate-400">Barometric</span>
                          </div>
                        </div>
                        <div className="mt-2.5 pt-2.5 border-t border-slate-800/60 grid grid-cols-5 gap-1 text-[8px] font-mono text-center">
                          {[{o:-12,l:'00h'},{o:-6,l:'06h'},{o:0,l:'12h'},{o:6,l:'18h'},{o:11,l:'23h'}].map(({o,l}) => (
                            <div key={o} className="flex flex-col">
                              <span className="text-slate-500">{l}</span>
                              <span className="font-semibold text-slate-300">{getPastObsValue('pressure', o)}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Humidity */}
                      <div className="bg-slate-900/40 hover:bg-slate-900/60 border border-slate-800/80 rounded-xl p-3 flex flex-col transition-colors">
                        <div className="flex items-center gap-3">
                          <Droplets className="w-5 h-5 text-cyan-400 shrink-0" />
                          <div className="flex flex-col">
                            <span className="text-[10px] text-slate-500 uppercase font-mono">Humidity</span>
                            <span className="text-sm font-bold text-white">{pastData.humidity}%</span>
                            <span className="text-[9px] text-slate-400">Saturated flow</span>
                          </div>
                        </div>
                        <div className="mt-2.5 pt-2.5 border-t border-slate-800/60 grid grid-cols-5 gap-1 text-[8px] font-mono text-center">
                          {[{o:-12,l:'00h'},{o:-6,l:'06h'},{o:0,l:'12h'},{o:6,l:'18h'},{o:11,l:'23h'}].map(({o,l}) => (
                            <div key={o} className="flex flex-col">
                              <span className="text-slate-500">{l}</span>
                              <span className="font-semibold text-slate-300">{getPastObsValue('humidity', o)}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Rainfall */}
                      <div className="bg-slate-900/40 hover:bg-slate-900/60 border border-slate-800/80 rounded-xl p-3 flex flex-col transition-colors">
                        <div className="flex items-center gap-3">
                          <CloudRain className="w-5 h-5 text-blue-400 shrink-0" />
                          <div className="flex flex-col">
                            <span className="text-[10px] text-slate-500 uppercase font-mono">Rainfall</span>
                            <span className="text-sm font-bold text-white">{pastData.rainfall} mm/h</span>
                            <span className="text-[9px] text-slate-400">Precipitation</span>
                          </div>
                        </div>
                        <div className="mt-2.5 pt-2.5 border-t border-slate-800/60 grid grid-cols-5 gap-1 text-[8px] font-mono text-center">
                          {[{o:-12,l:'00h'},{o:-6,l:'06h'},{o:0,l:'12h'},{o:6,l:'18h'},{o:11,l:'23h'}].map(({o,l}) => (
                            <div key={o} className="flex flex-col">
                              <span className="text-slate-500">{l}</span>
                              <span className="font-semibold text-slate-300">{getPastObsValue('rain', o)}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Cloud Cover */}
                      <div className="bg-slate-900/40 hover:bg-slate-900/60 border border-slate-800/80 rounded-xl p-3 flex flex-col transition-colors">
                        <div className="flex items-center gap-3">
                          <Cloud className="w-5 h-5 text-slate-300 shrink-0" />
                          <div className="flex flex-col">
                            <span className="text-[10px] text-slate-500 uppercase font-mono">Cloud</span>
                            <span className="text-sm font-bold text-white">{pastData.cloudCover}%</span>
                            <span className="text-[9px] text-slate-400">Sky Cover</span>
                          </div>
                        </div>
                        <div className="mt-2.5 pt-2.5 border-t border-slate-800/60 grid grid-cols-5 gap-1 text-[8px] font-mono text-center">
                          {[{o:-12,l:'00h'},{o:-6,l:'06h'},{o:0,l:'12h'},{o:6,l:'18h'},{o:11,l:'23h'}].map(({o,l}) => (
                            <div key={o} className="flex flex-col">
                              <span className="text-slate-500">{l}</span>
                              <span className="font-semibold text-slate-300">{getPastObsValue('cloud', o)}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Sunrise Card */}
                      <div className="bg-slate-900/40 hover:bg-slate-900/60 border border-slate-800/80 rounded-xl p-3.5 flex items-center gap-3.5 transition-colors">
                        <Sunrise className="w-5 h-5 text-amber-400 shrink-0" />
                        <div className="flex flex-col">
                          <span className="text-[10px] text-slate-500 uppercase font-mono">Sunrise</span>
                          <span className="text-xs font-bold text-white">{sunriseStr}</span>
                          <span className="text-[9px] text-slate-400">First light</span>
                        </div>
                      </div>

                      {/* Sunset Card */}
                      <div className="bg-slate-900/40 hover:bg-slate-900/60 border border-slate-800/80 rounded-xl p-3.5 flex items-center gap-3.5 transition-colors">
                        <Sunset className="w-5 h-5 text-indigo-400 shrink-0" />
                        <div className="flex flex-col">
                          <span className="text-[10px] text-slate-500 uppercase font-mono">Sunset</span>
                          <span className="text-xs font-bold text-white">{sunsetStr}</span>
                          <span className="text-[9px] text-slate-400">Dusk</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Past Trends Section */}
                  {pastChartData.length > 0 && (
                    <div className="flex flex-col gap-3 border-t border-slate-800/60 pt-4 pb-6">
                      <h3 className="text-xs font-extrabold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                        <Activity className="w-4 h-4 text-sky-400" />
                        Historical 24-Hour Trends
                      </h3>

                      <div className="bg-slate-950/50 border border-slate-800/80 rounded-xl p-3.5 flex flex-col gap-4">
                        {/* Temp & Wind Speed Trend Chart */}
                        <div className="flex flex-col gap-1.5">
                          <span className="text-[10px] font-bold text-slate-400 uppercase font-mono">Temperature & Wind Speed Trend</span>
                          <div className="h-36 w-full">
                            <ResponsiveContainer width="100%" height="100%">
                              <LineChart data={pastChartData} margin={{ top: 5, right: 5, left: -25, bottom: 5 }}>
                                <XAxis dataKey="hour" stroke="#475569" fontSize={8} tickLine={false} />
                                <YAxis stroke="#475569" fontSize={8} tickLine={false} />
                                <ChartTooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', fontSize: '10px' }} />
                                <Line type="monotone" dataKey="temp" stroke="#f97316" strokeWidth={2} name="Temp (°C)" dot={false} />
                                <Line type="monotone" dataKey="windSpeed" stroke="#06b6d4" strokeWidth={1.5} name="Wind (km/h)" dot={false} strokeDasharray="3 3" />
                              </LineChart>
                            </ResponsiveContainer>
                          </div>
                        </div>

                        {/* Pressure & Storm Prob Trend Chart */}
                        <div className="flex flex-col gap-1.5 border-t border-slate-800/60 pt-3">
                          <span className="text-[10px] font-bold text-slate-400 uppercase font-mono">Barometric Pressure & Storm Probability</span>
                          <div className="h-36 w-full">
                            <ResponsiveContainer width="100%" height="100%">
                              <AreaChart data={pastChartData} margin={{ top: 5, right: 5, left: -25, bottom: 5 }}>
                                <XAxis dataKey="hour" stroke="#475569" fontSize={8} tickLine={false} />
                                <YAxis stroke="#475569" fontSize={8} tickLine={false} />
                                <ChartTooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', fontSize: '10px' }} />
                                <Area type="monotone" dataKey="stormProb" stroke="#38bdf8" fill="rgba(56, 189, 248, 0.1)" strokeWidth={2} name="Storm Prob (%)" />
                                <Line type="monotone" dataKey="pressure" stroke="#8b5cf6" strokeWidth={1.5} name="Pressure (hPa)" dot={false} />
                              </AreaChart>
                            </ResponsiveContainer>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        )}

        {/* FUTURE TAB */}
        {tab==='future' && (
          <div className="flex flex-col gap-4">
            {/* Future Timeline Selector */}
            <div className="flex flex-col gap-3 bg-slate-950/40 border border-slate-800 rounded-xl p-3">
              <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Select Forecast Horizon</span>
              <div className="flex gap-1.5 items-center flex-wrap">
                {([
                  { l: '+3h', v: 3 },
                  { l: '+6h', v: 6 },
                  { l: '+12h', v: 12 },
                  { l: '+24h', v: 24 },
                  { l: '+48h', v: 48 },
                  { l: '+72h', v: 72 }
                ]).map(({ l, v }) => (
                  <button 
                    key={v} 
                    onClick={() => {
                      setIsCustomFutureDate(false);
                      setFutureTimelineOffset(v);
                    }} 
                    className={`px-2.5 py-1.5 rounded-lg text-[10px] font-bold uppercase transition-all ${
                      (!isCustomFutureDate && futureTimelineOffset === v)
                        ? 'bg-purple-600 text-white shadow-lg shadow-purple-500/25'
                        : 'bg-slate-900/60 border border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800'
                    }`}
                  >
                    {l}
                  </button>
                ))}
                
                <button 
                  onClick={() => setIsCustomFutureDate(true)}
                  className={`px-2.5 py-1.5 rounded-lg text-[10px] font-bold uppercase transition-all ${
                    isCustomFutureDate
                      ? 'bg-purple-600 text-white shadow-lg shadow-purple-500/25'
                      : 'bg-slate-900/60 border border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800'
                  }`}
                >
                  Custom Date
                </button>
              </div>

              {isCustomFutureDate && (
                <div className="w-full mt-1.5 animate-in fade-in duration-150">
                  <CustomDatePicker 
                    value={customFutureDate} 
                    onChange={setCustomFutureDate}
                    min={tomorrowStr}
                  />
                </div>
              )}
            </div>

            {futureLoading && (
              <div className="flex flex-col gap-4 animate-pulse py-4">
                <div className="h-14 bg-slate-900 rounded-xl" />
                <div className="grid grid-cols-2 gap-4">
                  <div className="h-28 bg-slate-900 rounded-xl" />
                  <div className="h-28 bg-slate-900 rounded-xl" />
                </div>
                <div className="h-24 bg-slate-900 rounded-xl" />
                <div className="h-32 bg-slate-900 rounded-xl" />
                <div className="grid grid-cols-2 gap-3">
                  <div className="h-20 bg-slate-900 rounded-xl" style={{ animationDelay: '0.1s' }} />
                  <div className="h-20 bg-slate-900 rounded-xl" style={{ animationDelay: '0.2s' }} />
                </div>
              </div>
            )}

            {/* Error State */}
            {!futureLoading && futureError && (
              <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-xs p-4 rounded-xl flex flex-col gap-2">
                <div className="flex gap-2 items-center">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span className="font-bold">Future Prediction Error</span>
                </div>
                <p className="text-[11px] leading-relaxed opacity-90">{futureError}</p>
                {futureResult?.requestedDate && (
                  <p className="text-[10px] opacity-60">Requested date: {futureResult.requestedDate}</p>
                )}
              </div>
            )}

            {/* Success State — Future Prediction Data */}
            {!futureLoading && !futureError && futureResult?.success && futureResult.data && (() => {
              const city = cities.find(c => c.id === locationId);
              if (!city) return null;

              const fd = futureResult.data;
              const hourly = fd.hourlyData;

              // Build chart data from hourly data
              const chartData: any[] = [];
              if (hourly?.time) {
                for (let h = 0; h < hourly.time.length && h <= 72; h += 6) {
                  const tVal = Math.round(hourly.temperature_2m[h] ?? 25);
                  const wVal = Math.round(hourly.wind_speed_10m[h] ?? 10);
                  const pVal = parseFloat((hourly.precipitation[h] || 0).toFixed(2));
                  const prVal = Math.round(hourly.pressure_msl[h] ?? 1013);
                  const huVal = Math.round(hourly.relative_humidity_2m[h] ?? 60);
                  const cVal = Math.round(hourly.cloud_cover[h] ?? 30);
                  const lVal = Math.round(hourly.lightning_probability?.[h] ?? (cVal > 70 ? 40 : 5));

                  const pred = getFuturePrediction({
                    temp: tVal, humidity: huVal, pressure: prVal,
                    windSpeed: wVal, rainfall: pVal, cloudCover: cVal, lightning: lVal,
                  });

                  chartData.push({
                    hour: `+${h}h`, temp: tVal, windSpeed: wVal, rainfall: pVal,
                    pressure: prVal, humidity: huVal, stormProb: pred.probability,
                  });
                }
              }

              const getLookahead = (arr: any[] | undefined, offset: number, format?: (v: any) => string) => {
                if (!arr || arr.length <= offset) return 'N/A';
                return format ? format(arr[offset]) : arr[offset];
              };

              return (
                <div className="flex flex-col gap-4 animate-in fade-in duration-200">
                  {/* Data Source Badge */}
                  <div className={`flex items-center justify-between bg-slate-950/40 border rounded-xl p-3 text-xs ${
                    futureResult.dataSource === 'AI_PREDICTION' ? 'border-purple-500/30' : 'border-sky-500/30'
                  }`}>
                    <div className="flex flex-col gap-0.5">
                      <span className="text-[9px] text-slate-500 uppercase tracking-wider">Prediction Source</span>
                      <span className="text-slate-200 font-semibold">{fd.targetDate}</span>
                    </div>
                    <span className={`text-[9px] font-black tracking-wider px-2.5 py-1 rounded-full border uppercase ${
                      futureResult.dataSource === 'AI_PREDICTION'
                        ? 'bg-purple-500/10 text-purple-400 border-purple-500/30'
                        : 'bg-sky-500/10 text-sky-400 border-sky-500/30'
                    }`}>
                      {futureResult.dataSource === 'AI_PREDICTION' ? '🧠 AI Prediction' : '📡 API Forecast'}
                    </span>
                  </div>

                  {/* Geo Coordinates & Distance */}
                  <div className="grid grid-cols-2 gap-3 bg-slate-950/40 border border-slate-800 rounded-xl p-3 text-xs font-mono">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-[10px] text-slate-500 uppercase tracking-wider">Latitude</span>
                      <span className="text-slate-200 font-semibold">{city.coord.lat.toFixed(4)}° N</span>
                    </div>
                    <div className="flex flex-col gap-0.5">
                      <span className="text-[10px] text-slate-500 uppercase tracking-wider">Longitude</span>
                      <span className="text-slate-200 font-semibold">{city.coord.lng.toFixed(4)}° E</span>
                    </div>
                    <div className="col-span-2 flex justify-between items-center border-t border-slate-800 pt-2.5 mt-1">
                      <span className="text-[10px] text-slate-500 uppercase tracking-wider">Distance to Storm Eye</span>
                      <span className={`font-semibold ${
                        distanceToEye < 150 ? 'text-red-400 font-bold animate-pulse' : distanceToEye < 350 ? 'text-orange-400' : 'text-slate-300'
                      }`}>
                        {distanceToEye > 1500 ? 'No Active Threat' : `${distanceToEye} km`}
                      </span>
                    </div>
                  </div>

                  {/* AI Analytics Dashboard */}
                  <div className="flex flex-col gap-3">
                    <h3 className="text-xs font-extrabold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-purple-400 animate-pulse" />
                      AI Storm Predictor ({isCustomFutureDate ? fd.targetDate : `+${futureTimelineOffset}h`})
                    </h3>

                    <div className="grid grid-cols-2 gap-4">
                      {/* Probability Gauge */}
                      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 flex flex-col items-center justify-center text-center relative overflow-hidden group">
                        <div className="relative flex items-center justify-center">
                          {renderCircleGauge(fd.stormProbability, fd.stormProbability > 75 ? 'stroke-red-500' : fd.stormProbability > 45 ? 'stroke-orange-500' : fd.stormProbability > 20 ? 'stroke-yellow-500' : 'stroke-emerald-500')}
                          <span className="absolute text-base font-extrabold text-white font-mono">{fd.stormProbability}%</span>
                        </div>
                        <span className="text-[10px] font-bold text-slate-400 mt-2.5 uppercase tracking-wide">Storm Probability</span>
                      </div>

                      {/* Confidence Gauge */}
                      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 flex flex-col items-center justify-center text-center relative overflow-hidden group">
                        <div className="relative flex items-center justify-center">
                          {renderCircleGauge(fd.aiConfidence, 'stroke-purple-400')}
                          <span className="absolute text-base font-extrabold text-white font-mono">{fd.aiConfidence}%</span>
                        </div>
                        <span className="text-[10px] font-bold text-slate-400 mt-2.5 uppercase tracking-wide">AI Confidence</span>
                      </div>

                      {/* Risk level */}
                      <div className="col-span-2 bg-slate-900/60 border border-slate-800 rounded-xl p-3.5 flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-300">Storm Threat Classification</span>
                        <span className={`text-xs font-black tracking-widest px-3 py-1 rounded-md border ${getRiskColor(fd.threatLevel)}`}>{fd.threatLevel}</span>
                      </div>

                      {/* Storm Status Banner */}
                      <div className={`col-span-2 border rounded-xl p-3.5 flex flex-col gap-1.5 transition-all ${
                        fd.stormProbability > 45 ? 'bg-red-500/10 border-red-500/20 text-red-400' : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                      }`}>
                        <span className="text-[9px] uppercase font-bold tracking-wider opacity-60">Status Analysis</span>
                        <span className="text-xs font-extrabold tracking-wide flex items-center gap-2">
                          <span className={`w-2.5 h-2.5 rounded-full ${fd.stormProbability > 45 ? 'bg-red-500 animate-pulse' : 'bg-emerald-500'}`} />
                          {fd.stormStatus}
                        </span>
                      </div>
                    </div>

                    {/* AI Metrics Grid */}
                    <div className="grid grid-cols-2 gap-3 bg-slate-900/40 border border-slate-800/80 rounded-xl p-3.5 text-xs">
                      <div className="flex justify-between items-center border-b border-slate-800/50 pb-2">
                        <span className="text-slate-400">Storm Arrival:</span>
                        <span className="font-semibold text-slate-200">{fd.estimatedArrival === null ? 'N/A' : fd.estimatedArrival === 0 ? 'Active Now' : `${fd.estimatedArrival} Hours`}</span>
                      </div>
                      <div className="flex justify-between items-center border-b border-slate-800/50 pb-2">
                        <span className="text-slate-400">Duration:</span>
                        <span className="font-semibold text-slate-200">{fd.estimatedDuration} Hours</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-slate-400">Heading:</span>
                        <span className="font-semibold text-slate-200 flex items-center gap-1">
                          <DirectionIcon className="w-3 h-3 text-purple-400" />
                          {fd.stormDirection}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-slate-400">Speed:</span>
                        <span className="font-semibold text-slate-200">{fd.stormSpeed} km/h</span>
                      </div>
                      <div className="col-span-2 flex justify-between items-center border-t border-slate-800/50 pt-2 mt-2">
                        <span className="text-slate-400">Affected Radius:</span>
                        <span className="font-semibold text-slate-200">{fd.affectedRadius} km</span>
                      </div>
                    </div>
                  </div>

                  {/* Explainable AI */}
                  <div className="flex flex-col gap-2.5">
                    <h3 className="text-xs font-extrabold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-purple-400 animate-pulse" />
                      Explainable AI Insights
                    </h3>
                    <div className="flex flex-col gap-2 bg-purple-500/[0.02] border border-purple-500/10 rounded-xl p-4">
                      {fd.explainableInsights.map((insight, idx) => (
                        <div key={idx} className="flex gap-2.5 items-start text-xs leading-relaxed text-slate-300">
                          <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-purple-400 shrink-0" />
                          <p>{insight}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Weather Parameters */}
                  <div className="flex flex-col gap-3">
                    <h3 className="text-xs font-extrabold text-slate-400 uppercase tracking-widest flex items-center gap-2 w-full">
                      <Compass className="w-4 h-4 text-purple-400" />
                      <span>Future Weather Parameters</span>
                      <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold ml-auto uppercase animate-pulse shrink-0 border ${
                        futureResult.dataSource === 'AI_PREDICTION' ? 'bg-purple-500/10 text-purple-400 border-purple-500/20' : 'bg-sky-500/10 text-sky-400 border-sky-500/20'
                      }`}>
                        {futureResult.dataSource === 'AI_PREDICTION' ? 'AI Predicted' : 'Forecasted'}
                      </span>
                    </h3>

                    <div className="grid grid-cols-2 gap-2.5">
                      {/* Temperature */}
                      <div className="bg-slate-900/40 hover:bg-slate-900/60 border border-slate-800/80 rounded-xl p-3 flex flex-col transition-colors">
                        <div className="flex items-center gap-3">
                          <Thermometer className="w-5 h-5 text-orange-400 shrink-0" />
                          <div className="flex flex-col">
                            <span className="text-[10px] text-slate-500 uppercase font-mono">Temp</span>
                            <span className="text-sm font-bold text-white">{fd.temp}°C</span>
                            <span className="text-[9px] text-slate-400">Feels Like {Math.round(fd.feelsLike)}°C</span>
                          </div>
                        </div>
                        <div className="mt-2.5 pt-2.5 border-t border-slate-800/60 grid grid-cols-5 gap-1 text-[8px] font-mono text-center">
                          {[{o:0,l:'Cur'},{o:3,l:'+3h'},{o:6,l:'+6h'},{o:12,l:'+12h'},{o:24,l:'+24h'}].map(({o,l}) => (
                            <div key={o} className="flex flex-col">
                              <span className="text-slate-500">{l}</span>
                              <span className="font-semibold text-slate-300">{getLookahead(hourly?.temperature_2m, o, v => `${Math.round(v)}°`)}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Wind */}
                      <div className="bg-slate-900/40 hover:bg-slate-900/60 border border-slate-800/80 rounded-xl p-3 flex flex-col transition-colors">
                        <div className="flex items-center gap-3">
                          <Wind className="w-5 h-5 text-sky-400 shrink-0" />
                          <div className="flex flex-col">
                            <span className="text-[10px] text-slate-500 uppercase font-mono">Wind</span>
                            <span className="text-sm font-bold text-white">{fd.windSpeed} km/h</span>
                            <span className="text-[9px] text-slate-400">Gusts {fd.windGust} km/h</span>
                          </div>
                        </div>
                        <div className="mt-2.5 pt-2.5 border-t border-slate-800/60 grid grid-cols-5 gap-1 text-[8px] font-mono text-center">
                          {[{o:0,l:'Cur'},{o:3,l:'+3h'},{o:6,l:'+6h'},{o:12,l:'+12h'},{o:24,l:'+24h'}].map(({o,l}) => (
                            <div key={o} className="flex flex-col">
                              <span className="text-slate-500">{l}</span>
                              <span className="font-semibold text-slate-300">{getLookahead(hourly?.wind_speed_10m, o, v => `${Math.round(v)}`)}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Pressure */}
                      <div className="bg-slate-900/40 hover:bg-slate-900/60 border border-slate-800/80 rounded-xl p-3 flex flex-col transition-colors">
                        <div className="flex items-center gap-3">
                          <Gauge className="w-5 h-5 text-purple-400 shrink-0" />
                          <div className="flex flex-col">
                            <span className="text-[10px] text-slate-500 uppercase font-mono">Pressure</span>
                            <span className="text-sm font-bold text-white">{fd.pressure} hPa</span>
                            <span className="text-[9px] text-slate-400">Barometric</span>
                          </div>
                        </div>
                        <div className="mt-2.5 pt-2.5 border-t border-slate-800/60 grid grid-cols-5 gap-1 text-[8px] font-mono text-center">
                          {[{o:0,l:'Cur'},{o:3,l:'+3h'},{o:6,l:'+6h'},{o:12,l:'+12h'},{o:24,l:'+24h'}].map(({o,l}) => (
                            <div key={o} className="flex flex-col">
                              <span className="text-slate-500">{l}</span>
                              <span className="font-semibold text-slate-300">{getLookahead(hourly?.pressure_msl, o, v => `${Math.round(v)}`)}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Humidity */}
                      <div className="bg-slate-900/40 hover:bg-slate-900/60 border border-slate-800/80 rounded-xl p-3 flex flex-col transition-colors">
                        <div className="flex items-center gap-3">
                          <Droplets className="w-5 h-5 text-cyan-400 shrink-0" />
                          <div className="flex flex-col">
                            <span className="text-[10px] text-slate-500 uppercase font-mono">Humidity</span>
                            <span className="text-sm font-bold text-white">{fd.humidity}%</span>
                            <span className="text-[9px] text-slate-400">Saturated flow</span>
                          </div>
                        </div>
                        <div className="mt-2.5 pt-2.5 border-t border-slate-800/60 grid grid-cols-5 gap-1 text-[8px] font-mono text-center">
                          {[{o:0,l:'Cur'},{o:3,l:'+3h'},{o:6,l:'+6h'},{o:12,l:'+12h'},{o:24,l:'+24h'}].map(({o,l}) => (
                            <div key={o} className="flex flex-col">
                              <span className="text-slate-500">{l}</span>
                              <span className="font-semibold text-slate-300">{getLookahead(hourly?.relative_humidity_2m, o, v => `${Math.round(v)}%`)}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Rainfall */}
                      <div className="bg-slate-900/40 hover:bg-slate-900/60 border border-slate-800/80 rounded-xl p-3 flex flex-col transition-colors">
                        <div className="flex items-center gap-3">
                          <CloudRain className="w-5 h-5 text-blue-400 shrink-0" />
                          <div className="flex flex-col">
                            <span className="text-[10px] text-slate-500 uppercase font-mono">Rainfall</span>
                            <span className="text-sm font-bold text-white">{fd.rainfall} mm/h</span>
                            <span className="text-[9px] text-slate-400">Precipitation ({fd.precipProbability}%)</span>
                          </div>
                        </div>
                        <div className="mt-2.5 pt-2.5 border-t border-slate-800/60 grid grid-cols-5 gap-1 text-[8px] font-mono text-center">
                          {[{o:0,l:'Cur'},{o:3,l:'+3h'},{o:6,l:'+6h'},{o:12,l:'+12h'},{o:24,l:'+24h'}].map(({o,l}) => (
                            <div key={o} className="flex flex-col">
                              <span className="text-slate-500">{l}</span>
                              <span className="font-semibold text-slate-300">{getLookahead(hourly?.precipitation, o, v => `${v.toFixed(1)}`)}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Cloud Cover */}
                      <div className="bg-slate-900/40 hover:bg-slate-900/60 border border-slate-800/80 rounded-xl p-3 flex flex-col transition-colors">
                        <div className="flex items-center gap-3">
                          <Cloud className="w-5 h-5 text-slate-300 shrink-0" />
                          <div className="flex flex-col">
                            <span className="text-[10px] text-slate-500 uppercase font-mono">Cloud Cover</span>
                            <span className="text-sm font-bold text-white">{fd.cloudCover}%</span>
                            <span className="text-[9px] text-slate-400">Convective index</span>
                          </div>
                        </div>
                        <div className="mt-2.5 pt-2.5 border-t border-slate-800/60 grid grid-cols-5 gap-1 text-[8px] font-mono text-center">
                          {[{o:0,l:'Cur'},{o:3,l:'+3h'},{o:6,l:'+6h'},{o:12,l:'+12h'},{o:24,l:'+24h'}].map(({o,l}) => (
                            <div key={o} className="flex flex-col">
                              <span className="text-slate-500">{l}</span>
                              <span className="font-semibold text-slate-300">{getLookahead(hourly?.cloud_cover, o, v => `${Math.round(v)}%`)}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Wind Direction */}
                      <div className="bg-slate-900/40 hover:bg-slate-900/60 border border-slate-800/80 rounded-xl p-3 flex flex-col transition-colors">
                        <div className="flex items-center gap-3">
                          <DirectionIcon className="w-5 h-5 text-teal-400 shrink-0" />
                          <div className="flex flex-col">
                            <span className="text-[10px] text-slate-500 uppercase font-mono">Wind Direction</span>
                            <span className="text-sm font-bold text-white">{fd.windDirection}°</span>
                            <span className="text-[9px] text-slate-400">Bearing</span>
                          </div>
                        </div>
                      </div>

                      {/* Lightning */}
                      <div className="bg-slate-900/40 hover:bg-slate-900/60 border border-slate-800/80 rounded-xl p-3 flex flex-col transition-colors">
                        <div className="flex items-center gap-3">
                          <Zap className="w-5 h-5 text-yellow-400 shrink-0" />
                          <div className="flex flex-col">
                            <span className="text-[10px] text-slate-500 uppercase font-mono">Lightning</span>
                            <span className="text-sm font-bold text-white">{fd.lightning}%</span>
                            <span className="text-[9px] text-slate-400">Discharge rate</span>
                          </div>
                        </div>
                      </div>

                      {/* Visibility */}
                      <div className="bg-slate-900/40 hover:bg-slate-900/60 border border-slate-800/80 rounded-xl p-3 flex items-center gap-3 transition-colors">
                        <Eye className="w-5 h-5 text-emerald-400 shrink-0" />
                        <div className="flex flex-col">
                          <span className="text-[10px] text-slate-500 uppercase font-mono">Visibility</span>
                          <span className="text-sm font-bold text-white">{typeof fd.visibility === 'number' && fd.visibility > 1000 ? Math.round(fd.visibility / 1000) : fd.visibility} km</span>
                          <span className="text-[9px] text-slate-400">Surface sight</span>
                        </div>
                      </div>

                      {/* Sunrise */}
                      <div className="bg-slate-900/40 hover:bg-slate-900/60 border border-slate-800/80 rounded-xl p-3 flex items-center gap-3 transition-colors">
                        <Sunrise className="w-5 h-5 text-amber-400 shrink-0" />
                        <div className="flex flex-col">
                          <span className="text-[10px] text-slate-500 uppercase font-mono">Sunrise</span>
                          <span className="text-xs font-bold text-white">
                            {fd.dailyData?.sunrise?.[0] ? new Date(fd.dailyData.sunrise[0]).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : '06:00 AM'}
                          </span>
                        </div>
                      </div>

                      {/* Sunset */}
                      <div className="bg-slate-900/40 hover:bg-slate-900/60 border border-slate-800/80 rounded-xl p-3 flex items-center gap-3 transition-colors">
                        <Sunset className="w-5 h-5 text-indigo-400 shrink-0" />
                        <div className="flex flex-col">
                          <span className="text-[10px] text-slate-500 uppercase font-mono">Sunset</span>
                          <span className="text-xs font-bold text-white">
                            {fd.dailyData?.sunset?.[0] ? new Date(fd.dailyData.sunset[0]).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : '06:30 PM'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Charts */}
                  {chartData.length > 0 && (
                    <div className="flex flex-col gap-3 border-t border-slate-800/60 pt-4 pb-6">
                      <h3 className="text-xs font-extrabold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                        <Activity className="w-4 h-4 text-purple-400" />
                        Forecast Trends
                      </h3>
                      <div className="bg-slate-950/50 border border-slate-800/80 rounded-xl p-3.5 flex flex-col gap-4">
                        <div className="flex flex-col gap-1.5">
                          <span className="text-[10px] font-bold text-slate-400 uppercase font-mono">Temperature & Wind Speed</span>
                          <div className="h-36 w-full">
                            <ResponsiveContainer width="100%" height="100%">
                              <LineChart data={chartData} margin={{ top: 5, right: 5, left: -25, bottom: 5 }}>
                                <XAxis dataKey="hour" stroke="#475569" fontSize={8} tickLine={false} />
                                <YAxis stroke="#475569" fontSize={8} tickLine={false} />
                                <ChartTooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', fontSize: '10px' }} />
                                <Line type="monotone" dataKey="temp" stroke="#f97316" strokeWidth={2} name="Temp (°C)" dot={false} />
                                <Line type="monotone" dataKey="windSpeed" stroke="#06b6d4" strokeWidth={1.5} name="Wind (km/h)" dot={false} strokeDasharray="3 3" />
                              </LineChart>
                            </ResponsiveContainer>
                          </div>
                        </div>
                        <div className="flex flex-col gap-1.5 border-t border-slate-800/60 pt-3">
                          <span className="text-[10px] font-bold text-slate-400 uppercase font-mono">Pressure & Storm Probability</span>
                          <div className="h-36 w-full">
                            <ResponsiveContainer width="100%" height="100%">
                              <AreaChart data={chartData} margin={{ top: 5, right: 5, left: -25, bottom: 5 }}>
                                <XAxis dataKey="hour" stroke="#475569" fontSize={8} tickLine={false} />
                                <YAxis stroke="#475569" fontSize={8} tickLine={false} />
                                <ChartTooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', fontSize: '10px' }} />
                                <Area type="monotone" dataKey="stormProb" stroke="#a855f7" fill="rgba(168, 85, 247, 0.1)" strokeWidth={2} name="Storm Prob (%)" />
                                <Line type="monotone" dataKey="pressure" stroke="#8b5cf6" strokeWidth={1.5} name="Pressure (hPa)" dot={false} />
                              </AreaChart>
                            </ResponsiveContainer>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        )}


        {/* PRESENT TAB — all existing content */}
        {tab==='present' && <>

        {apiError && (
          <div className="bg-orange-500/10 border border-orange-500/20 text-orange-400 text-[10px] p-2 rounded-lg flex gap-2 items-center">
            <AlertTriangle className="w-3 h-3" />
            {isHistorical ? "No weather data available for this date." : isFuture ? "Forecast data unavailable for this date." : "Live weather temporarily unavailable. Showing cached data."}
          </div>
        )}
        
        {/* Geo Coordinates & Distance Info */}
        <div className="grid grid-cols-2 gap-3 bg-slate-950/40 border border-slate-800 rounded-xl p-3 text-xs font-mono">
          <div className="flex flex-col gap-0.5">
            <span className="text-[10px] text-slate-500 uppercase tracking-wider">Latitude</span>
            <span className="text-slate-200 font-semibold">{coordinate.lat.toFixed(4)}° N</span>
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-[10px] text-slate-500 uppercase tracking-wider">Longitude</span>
            <span className="text-slate-200 font-semibold">{coordinate.lng.toFixed(4)}° E</span>
          </div>
          {locationType === 'city' && (
            <div className="col-span-2 flex justify-between items-center border-t border-slate-800 pt-2.5 mt-1">
              <span className="text-[10px] text-slate-500 uppercase tracking-wider">Distance to Storm Eye</span>
              <span className={`font-semibold ${
                distanceToEye < 150 ? 'text-red-400 font-bold' : distanceToEye < 350 ? 'text-orange-400' : 'text-slate-300'
              }`}>
                {distanceToEye > 1500 ? 'No Active Threat' : `${distanceToEye} km`}
              </span>
            </div>
          )}
        </div>

        {/* AI Analytics Dashboard Section */}
        <div className="flex flex-col gap-3">
          <h3 className="text-xs font-extrabold text-slate-400 uppercase tracking-widest flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-sky-400" />
            AI Storm Predictor
          </h3>

          <div className="grid grid-cols-2 gap-4">
            
            {/* Probability Gauge */}
            <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 flex flex-col items-center justify-center text-center relative overflow-hidden group">
              <div className="relative flex items-center justify-center">
                {renderCircleGauge(ai.probability, ai.probability > 75 ? 'stroke-red-500' : ai.probability > 45 ? 'stroke-orange-500' : ai.probability > 20 ? 'stroke-yellow-500' : 'stroke-emerald-500')}
                <span className="absolute text-base font-extrabold text-white font-mono">
                  {ai.probability}%
                </span>
              </div>
              <span className="text-[10px] font-bold text-slate-400 mt-2.5 uppercase tracking-wide">
                Storm Probability
              </span>
            </div>

            {/* Confidence Gauge */}
            <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 flex flex-col items-center justify-center text-center relative overflow-hidden group">
              <div className="relative flex items-center justify-center">
                {renderCircleGauge(ai.confidence, 'stroke-sky-400')}
                <span className="absolute text-base font-extrabold text-white font-mono">
                  {ai.confidence}%
                </span>
              </div>
              <span className="text-[10px] font-bold text-slate-400 mt-2.5 uppercase tracking-wide">
                AI Confidence
              </span>
            </div>

            {/* Risk level badge */}
            <div className="col-span-2 bg-slate-900/60 border border-slate-800 rounded-xl p-3.5 flex items-center justify-between">
              <span className="text-xs font-bold text-slate-300">Storm Threat Classification</span>
              <span className={`text-xs font-black tracking-widest px-3 py-1 rounded-md border ${getRiskColor(ai.riskLevel)}`}>
                {ai.riskLevel}
              </span>
            </div>

            {/* Storm Status Banner */}
            <div className={`col-span-2 border rounded-xl p-3.5 flex flex-col gap-1.5 transition-all ${
              presentStormOccurred 
                ? 'bg-red-500/10 border-red-500/20 text-red-400' 
                : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
            }`}>
              <span className="text-[9px] uppercase font-bold tracking-wider opacity-60">Status Analysis</span>
              <span className="text-xs font-extrabold tracking-wide flex items-center gap-2">
                <span className={`w-2.5 h-2.5 rounded-full ${presentStormOccurred ? 'bg-red-500 animate-pulse' : 'bg-emerald-500'}`} />
                {presentStormStatus}
              </span>
            </div>
          </div>

          {/* AI Metrics Grid */}
          <div className="grid grid-cols-2 gap-3 bg-slate-900/40 border border-slate-800/80 rounded-xl p-3.5 text-xs">
            <div className="flex justify-between items-center border-b border-slate-800/50 pb-2">
              <span className="text-slate-400">Storm Arrival:</span>
              <span className="font-semibold text-slate-200">
                {ai.arrivalTime === null ? 'N/A' : ai.arrivalTime === 0 ? 'Active Now' : `${ai.arrivalTime} Hours`}
              </span>
            </div>
            <div className="flex justify-between items-center border-b border-slate-800/50 pb-2">
              <span className="text-slate-400">Storm Duration:</span>
              <span className="font-semibold text-slate-200">{ai.duration} Hours</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-400">Heading:</span>
              <span className="font-semibold text-slate-200 flex items-center gap-1">
                <DirectionIcon className="w-3 h-3 text-sky-400" />
                {ai.direction}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-400">Est. Speed:</span>
              <span className="font-semibold text-slate-200">{ai.speed} km/h</span>
            </div>
            <div className="col-span-2 flex justify-between items-center border-t border-slate-800/50 pt-2 mt-2">
              <span className="text-slate-400">Affected Buffer Radius:</span>
              <span className="font-semibold text-slate-200">{ai.radius} km</span>
            </div>
          </div>
        </div>

        {/* Explainable AI Predictions */}
        <div className="flex flex-col gap-2.5">
          <h3 className="text-xs font-extrabold text-slate-400 uppercase tracking-widest flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-yellow-400 animate-pulse" />
            Explainable AI Insights
          </h3>
          <div className="flex flex-col gap-2 bg-yellow-500/[0.02] border border-yellow-500/10 rounded-xl p-4">
            {ai.explainableAI.map((insight, idx) => (
              <div key={idx} className="flex gap-2.5 items-start text-xs leading-relaxed text-slate-300">
                <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-yellow-400 shrink-0" />
                <p>{insight}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Weather Observations */}
        <div className="flex flex-col gap-3 pb-6">
          <h3 className="text-xs font-extrabold text-slate-400 uppercase tracking-widest flex items-center gap-2 w-full">
            <Compass className="w-4 h-4 text-sky-400" />
            <span>{isFuture ? "Predicted Weather Observations" : isHistorical ? "Historical Weather Observations" : "Live Weather Observations"}</span>
            {isFuture && (
              <span className="text-[9px] bg-purple-500/10 text-purple-400 border border-purple-500/20 px-2 py-0.5 rounded-full font-bold ml-auto uppercase animate-pulse shrink-0">
                Predicted using ML Model
              </span>
            )}
          </h3>

          <div className="flex flex-col gap-3">

            {(() => {
              const sunriseStr = isToday ? (liveData?.daily?.sunrise?.[0] ? new Date(liveData.daily.sunrise[0]).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : '06:00 AM') : (historicalData?.daily?.sunrise?.[0] ? new Date(historicalData.daily.sunrise[0]).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : '06:00 AM');
              const sunsetStr = isToday ? (liveData?.daily?.sunset?.[0] ? new Date(liveData.daily.sunset[0]).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : '06:30 PM') : (historicalData?.daily?.sunset?.[0] ? new Date(historicalData.daily.sunset[0]).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : '06:30 PM');

              const getObsValue = (param: string, offset: number) => {
                if (isToday && liveData?.hourly) {
                  const curHour = new Date().getHours();
                  const idx = Math.min(167, curHour + offset);
                  if (param === 'temp') return `${Math.round(liveData.hourly.temperature2m[idx])}°`;
                  if (param === 'wind') return `${Math.round(liveData.hourly.windSpeed10m[idx])}`;
                  if (param === 'pressure') return `${Math.round(liveData.hourly.pressureMsl[idx])}`;
                  if (param === 'humidity') return `${Math.round(liveData.hourly.relativeHumidity2m[idx])}%`;
                  if (param === 'rain') return `${(liveData.hourly.precipitation[idx] || 0).toFixed(1)}`;
                  if (param === 'cloud') return `${Math.round(liveData.hourly.cloudCover[idx])}%`;
                  if (param === 'lightning') return `${Math.round(liveData.hourly.cloudCover[idx] > 70 ? 45 : 5)}%`;
                  if (param === 'visibility') return `${Math.round(liveData.hourly.visibility[idx] / 1000)}k`;
                }
                if (isHistorical && historicalData?.hourly) {
                  const idx = Math.min(23, 12 + offset);
                  if (param === 'temp') return `${Math.round(historicalData.hourly.temperature_2m[idx])}°`;
                  if (param === 'wind') return `${Math.round(historicalData.hourly.wind_speed_10m[idx])}`;
                  if (param === 'pressure') return `${Math.round(historicalData.hourly.pressure_msl[idx])}`;
                  if (param === 'humidity') return `${Math.round(historicalData.hourly.relative_humidity_2m[idx])}%`;
                  if (param === 'rain') return `${(historicalData.hourly.precipitation[idx] || 0).toFixed(1)}`;
                  if (param === 'cloud') return `${Math.round(historicalData.hourly.cloud_cover[idx])}%`;
                  if (param === 'lightning') return `${Math.round(historicalData.hourly.cloud_cover[idx] > 70 ? 45 : 5)}%`;
                  if (param === 'visibility') return `${Math.round(historicalData.hourly.visibility[idx] / 1000)}k`;
                }
                if (param === 'temp') return `${Math.round(weather.temp + offset * -0.1)}°`;
                if (param === 'wind') return `${Math.round(weather.windSpeed + offset * 0.2)}`;
                if (param === 'pressure') return `${Math.round(weather.pressure - offset * 0.15)}`;
                if (param === 'humidity') return `${Math.round(Math.min(100, weather.humidity + offset * 0.5))}%`;
                if (param === 'rain') return `${(weather.rainfall + offset * 0.05).toFixed(1)}`;
                if (param === 'cloud') return `${Math.round(Math.min(100, weather.cloudCover + offset * 0.5))}%`;
                if (param === 'lightning') return `${Math.round(Math.min(100, weather.lightningProb + offset * 0.3))}%`;
                if (param === 'visibility') return `${Math.round(weather.visibility)}k`;
                return 'N/A';
              };

              const presentChartData = [];
              const startHour = isToday ? new Date().getHours() : 12;
              const hasHourly = (isToday && liveData?.hourly) || (isHistorical && historicalData?.hourly);
              if (hasHourly) {
                for (let h = 0; h <= 72; h += 6) {
                  const idx = startHour + h;
                  let tVal = 25;
                  let wVal = 10;
                  let pVal = 0;
                  let prVal = 1013;
                  let huVal = 60;
                  
                  if (isToday && liveData?.hourly) {
                    const targetIdx = Math.min(liveData.hourly.time.length - 1, idx);
                    tVal = Math.round(liveData.hourly.temperature2m[targetIdx]);
                    wVal = Math.round(liveData.hourly.windSpeed10m[targetIdx]);
                    pVal = parseFloat((liveData.hourly.precipitation[targetIdx] || 0).toFixed(2));
                    prVal = Math.round(liveData.hourly.pressureMsl[targetIdx]);
                    huVal = Math.round(liveData.hourly.relativeHumidity2m[targetIdx]);
                  } else if (isHistorical && historicalData?.hourly) {
                    const targetIdx = Math.min(historicalData.hourly.time.length - 1, idx);
                    tVal = Math.round(historicalData.hourly.temperature_2m[targetIdx]);
                    wVal = Math.round(historicalData.hourly.wind_speed_10m[targetIdx]);
                    pVal = parseFloat((historicalData.hourly.precipitation[targetIdx] || 0).toFixed(2));
                    prVal = Math.round(historicalData.hourly.pressure_msl[targetIdx]);
                    huVal = Math.round(historicalData.hourly.relative_humidity_2m[targetIdx]);
                  }

                  const pred = getFuturePrediction({
                    temp: tVal,
                    humidity: huVal,
                    pressure: prVal,
                    windSpeed: wVal,
                    rainfall: pVal,
                    cloudCover: 50,
                    lightning: 10,
                  });

                  presentChartData.push({
                    hour: `+${h}h`,
                    temp: tVal,
                    windSpeed: wVal,
                    rainfall: pVal,
                    pressure: prVal,
                    humidity: huVal,
                    stormProb: pred.probability,
                  });
                }
              }

              return (
                <div className="flex flex-col gap-6">
                  <div className="grid grid-cols-2 gap-2.5">
                    {/* Temperature Card */}
                    <div className="bg-slate-900/40 hover:bg-slate-900/60 border border-slate-800/80 rounded-xl p-3 flex flex-col transition-colors">
                      <div className="flex items-center gap-3">
                        <Thermometer className="w-5 h-5 text-orange-400 shrink-0" />
                        <div className="flex flex-col">
                          <span className="text-[10px] text-slate-500 uppercase font-mono">Temp</span>
                          <span className="text-sm font-bold text-white">{weather.temp}°C</span>
                          <span className="text-[9px] text-slate-400">Feels Like {weather.feelsLike}°C</span>
                        </div>
                      </div>
                      <div className="mt-2.5 pt-2.5 border-t border-slate-800/60 grid grid-cols-5 gap-1 text-[8px] font-mono text-center">
                        {[{o:0,l:'Cur'},{o:3,l:'+3h'},{o:6,l:'+6h'},{o:12,l:'+12h'},{o:24,l:'+24h'}].map(({o,l}) => (
                          <div key={o} className="flex flex-col">
                            <span className="text-slate-500">{l}</span>
                            <span className="font-semibold text-slate-300">{getObsValue('temp', o)}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Wind Card */}
                    <div className="bg-slate-900/40 hover:bg-slate-900/60 border border-slate-800/80 rounded-xl p-3 flex flex-col transition-colors">
                      <div className="flex items-center gap-3">
                        <Wind className="w-5 h-5 text-sky-400 shrink-0" />
                        <div className="flex flex-col">
                          <span className="text-[10px] text-slate-500 uppercase font-mono">Wind</span>
                          <span className="text-sm font-bold text-white">{weather.windSpeed} km/h</span>
                          <span className="text-[9px] text-slate-400">Gusts {weather.windGust} km/h</span>
                        </div>
                      </div>
                      <div className="mt-2.5 pt-2.5 border-t border-slate-800/60 grid grid-cols-5 gap-1 text-[8px] font-mono text-center">
                        {[{o:0,l:'Cur'},{o:3,l:'+3h'},{o:6,l:'+6h'},{o:12,l:'+12h'},{o:24,l:'+24h'}].map(({o,l}) => (
                          <div key={o} className="flex flex-col">
                            <span className="text-slate-500">{l}</span>
                            <span className="font-semibold text-slate-300">{getObsValue('wind', o)}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Pressure Card */}
                    <div className="bg-slate-900/40 hover:bg-slate-900/60 border border-slate-800/80 rounded-xl p-3 flex flex-col transition-colors">
                      <div className="flex items-center gap-3">
                        <Gauge className="w-5 h-5 text-purple-400 shrink-0" />
                        <div className="flex flex-col">
                          <span className="text-[10px] text-slate-500 uppercase font-mono">Pressure</span>
                          <span className="text-sm font-bold text-white">{weather.pressure} hPa</span>
                          <span className="text-[9px] text-slate-400">Barometric</span>
                        </div>
                      </div>
                      <div className="mt-2.5 pt-2.5 border-t border-slate-800/60 grid grid-cols-5 gap-1 text-[8px] font-mono text-center">
                        {[{o:0,l:'Cur'},{o:3,l:'+3h'},{o:6,l:'+6h'},{o:12,l:'+12h'},{o:24,l:'+24h'}].map(({o,l}) => (
                          <div key={o} className="flex flex-col">
                            <span className="text-slate-500">{l}</span>
                            <span className="font-semibold text-slate-300">{getObsValue('pressure', o)}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Humidity Card */}
                    <div className="bg-slate-900/40 hover:bg-slate-900/60 border border-slate-800/80 rounded-xl p-3 flex flex-col transition-colors">
                      <div className="flex items-center gap-3">
                        <Droplets className="w-5 h-5 text-cyan-400 shrink-0" />
                        <div className="flex flex-col">
                          <span className="text-[10px] text-slate-500 uppercase font-mono">Humidity</span>
                          <span className="text-sm font-bold text-white">{weather.humidity}%</span>
                          <span className="text-[9px] text-slate-400">Saturated flow</span>
                        </div>
                      </div>
                      <div className="mt-2.5 pt-2.5 border-t border-slate-800/60 grid grid-cols-5 gap-1 text-[8px] font-mono text-center">
                        {[{o:0,l:'Cur'},{o:3,l:'+3h'},{o:6,l:'+6h'},{o:12,l:'+12h'},{o:24,l:'+24h'}].map(({o,l}) => (
                          <div key={o} className="flex flex-col">
                            <span className="text-slate-500">{l}</span>
                            <span className="font-semibold text-slate-300">{getObsValue('humidity', o)}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Rainfall Card */}
                    <div className="bg-slate-900/40 hover:bg-slate-900/60 border border-slate-800/80 rounded-xl p-3 flex flex-col transition-colors">
                      <div className="flex items-center gap-3">
                        <CloudRain className="w-5 h-5 text-blue-400 shrink-0" />
                        <div className="flex flex-col">
                          <span className="text-[10px] text-slate-500 uppercase font-mono">Rainfall</span>
                          <span className="text-sm font-bold text-white">{weather.rainfall} mm/h</span>
                          <span className="text-[9px] text-slate-400">Precipitation</span>
                        </div>
                      </div>
                      <div className="mt-2.5 pt-2.5 border-t border-slate-800/60 grid grid-cols-5 gap-1 text-[8px] font-mono text-center">
                        {[{o:0,l:'Cur'},{o:3,l:'+3h'},{o:6,l:'+6h'},{o:12,l:'+12h'},{o:24,l:'+24h'}].map(({o,l}) => (
                          <div key={o} className="flex flex-col">
                            <span className="text-slate-500">{l}</span>
                            <span className="font-semibold text-slate-300">{getObsValue('rain', o)}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Cloud Cover Card */}
                    <div className="bg-slate-900/40 hover:bg-slate-900/60 border border-slate-800/80 rounded-xl p-3 flex flex-col transition-colors">
                      <div className="flex items-center gap-3">
                        <Cloud className="w-5 h-5 text-slate-300 shrink-0" />
                        <div className="flex flex-col">
                          <span className="text-[10px] text-slate-500 uppercase font-mono">Cloud Cover</span>
                          <span className="text-sm font-bold text-white">{weather.cloudCover}%</span>
                          <span className="text-[9px] text-slate-400">Convective index</span>
                        </div>
                      </div>
                      <div className="mt-2.5 pt-2.5 border-t border-slate-800/60 grid grid-cols-5 gap-1 text-[8px] font-mono text-center">
                        {[{o:0,l:'Cur'},{o:3,l:'+3h'},{o:6,l:'+6h'},{o:12,l:'+12h'},{o:24,l:'+24h'}].map(({o,l}) => (
                          <div key={o} className="flex flex-col">
                            <span className="text-slate-500">{l}</span>
                            <span className="font-semibold text-slate-300">{getObsValue('cloud', o)}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Lightning Card */}
                    <div className="bg-slate-900/40 hover:bg-slate-900/60 border border-slate-800/80 rounded-xl p-3.5 flex flex-col transition-colors">
                      <div className="flex items-center gap-3">
                        <Zap className="w-5 h-5 text-yellow-400 shrink-0" />
                        <div className="flex flex-col">
                          <span className="text-[10px] text-slate-500 uppercase font-mono">Lightning</span>
                          <span className="text-sm font-bold text-white">{weather.lightningProb}%</span>
                          <span className="text-[9px] text-slate-400">Discharge rate</span>
                        </div>
                      </div>
                      <div className="mt-2.5 pt-2.5 border-t border-slate-800/60 grid grid-cols-5 gap-1 text-[8px] font-mono text-center">
                        {[{o:0,l:'Cur'},{o:3,l:'+3h'},{o:6,l:'+6h'},{o:12,l:'+12h'},{o:24,l:'+24h'}].map(({o,l}) => (
                          <div key={o} className="flex flex-col">
                            <span className="text-slate-500">{l}</span>
                            <span className="font-semibold text-slate-300">{getObsValue('lightning', o)}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Visibility Card */}
                    <div className="bg-slate-900/40 hover:bg-slate-900/60 border border-slate-800/80 rounded-xl p-3 flex flex-col transition-colors">
                      <div className="flex items-center gap-3">
                        <Eye className="w-5 h-5 text-emerald-400 shrink-0" />
                        <div className="flex flex-col">
                          <span className="text-[10px] text-slate-500 uppercase font-mono">Visibility</span>
                          <span className="text-sm font-bold text-white">{weather.visibility} km</span>
                          <span className="text-[9px] text-slate-400">Surface sight</span>
                        </div>
                      </div>
                      <div className="mt-2.5 pt-2.5 border-t border-slate-800/60 grid grid-cols-5 gap-1 text-[8px] font-mono text-center">
                        {[{o:0,l:'Cur'},{o:3,l:'+3h'},{o:6,l:'+6h'},{o:12,l:'+12h'},{o:24,l:'+24h'}].map(({o,l}) => (
                          <div key={o} className="flex flex-col">
                            <span className="text-slate-500">{l}</span>
                            <span className="font-semibold text-slate-300">{getObsValue('visibility', o)}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Sunrise Card */}
                    <div className="bg-slate-900/40 hover:bg-slate-900/60 border border-slate-800/80 rounded-xl p-3 flex items-center gap-3 transition-colors">
                      <Sunrise className="w-5 h-5 text-amber-400 shrink-0" />
                      <div className="flex flex-col">
                        <span className="text-[10px] text-slate-500 uppercase font-mono">Sunrise</span>
                        <span className="text-xs font-bold text-white">{sunriseStr}</span>
                        <span className="text-[9px] text-slate-400">First light</span>
                      </div>
                    </div>

                    {/* Sunset Card */}
                    <div className="bg-slate-900/40 hover:bg-slate-900/60 border border-slate-800/80 rounded-xl p-3 flex items-center gap-3 transition-colors">
                      <Sunset className="w-5 h-5 text-indigo-400 shrink-0" />
                      <div className="flex flex-col">
                        <span className="text-[10px] text-slate-500 uppercase font-mono">Sunset</span>
                        <span className="text-xs font-bold text-white">{sunsetStr}</span>
                        <span className="text-[9px] text-slate-400">Dusk</span>
                      </div>
                    </div>
                  </div>

                  {/* Present/Forecast Trends Charts */}
                  {presentChartData.length > 0 && (
                    <div className="flex flex-col gap-3 border-t border-slate-800/60 pt-4 pb-4">
                      <h3 className="text-xs font-extrabold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                        <Activity className="w-4 h-4 text-sky-400" />
                        Forecast 72-Hour Trends
                      </h3>

                      <div className="bg-slate-950/50 border border-slate-800/80 rounded-xl p-3.5 flex flex-col gap-4">
                        {/* Temp & Wind Speed Chart */}
                        <div className="flex flex-col gap-1.5">
                          <span className="text-[10px] font-bold text-slate-400 uppercase font-mono">Temperature & Wind Speed Trend</span>
                          <div className="h-36 w-full">
                            <ResponsiveContainer width="100%" height="100%">
                              <LineChart data={presentChartData} margin={{ top: 5, right: 5, left: -25, bottom: 5 }}>
                                <XAxis dataKey="hour" stroke="#475569" fontSize={8} tickLine={false} />
                                <YAxis stroke="#475569" fontSize={8} tickLine={false} />
                                <ChartTooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', fontSize: '10px' }} />
                                <Line type="monotone" dataKey="temp" stroke="#f97316" strokeWidth={2} name="Temp (°C)" dot={false} />
                                <Line type="monotone" dataKey="windSpeed" stroke="#06b6d4" strokeWidth={1.5} name="Wind (km/h)" dot={false} strokeDasharray="3 3" />
                              </LineChart>
                            </ResponsiveContainer>
                          </div>
                        </div>

                        {/* Pressure & Storm Prob Chart */}
                        <div className="flex flex-col gap-1.5 border-t border-slate-800/60 pt-3">
                          <span className="text-[10px] font-bold text-slate-400 uppercase font-mono">Barometric Pressure & Storm Probability</span>
                          <div className="h-36 w-full">
                            <ResponsiveContainer width="100%" height="100%">
                              <AreaChart data={presentChartData} margin={{ top: 5, right: 5, left: -25, bottom: 5 }}>
                                <XAxis dataKey="hour" stroke="#475569" fontSize={8} tickLine={false} />
                                <YAxis stroke="#475569" fontSize={8} tickLine={false} />
                                <ChartTooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', fontSize: '10px' }} />
                                <Area type="monotone" dataKey="stormProb" stroke="#38bdf8" fill="rgba(56, 189, 248, 0.1)" strokeWidth={2} name="Storm Prob (%)" />
                                <Line type="monotone" dataKey="pressure" stroke="#8b5cf6" strokeWidth={1.5} name="Pressure (hPa)" dot={false} />
                              </AreaChart>
                            </ResponsiveContainer>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        </div>
      </>}

      </div>
    </div>
  );
}
