import { useState, useEffect } from 'react';

import { 
  Compass, 
  Layers, 
  Activity, 
  Info,
  FolderOpen
} from 'lucide-react';
import WeatherMap from './components/WeatherMap';
import LayerControls from './components/LayerControls';
import Timeline from './components/Timeline';
import SidePanel from './components/SidePanel';
import AIDashboard from './components/AIDashboard';
import SearchBar from './components/SearchBar';
import BasemapSelector, { type BasemapType } from './components/BasemapSelector';
import GeoPortalPanel, { type UploadedKml } from './components/GeoPortalPanel';
import { type GisLayerDef, GIS_CATALOG } from './api/gisCatalog';

import { cities, updatePresentStorms } from './mockData';
import { fetchActiveStorms } from './api/stormAPI';

export default function App() {
  // 1. Core Platform State
  const [timeOffset, setTimeOffset] = useState<number>(0);
  const [layers, setLayers] = useState({
    wind: true,
    rain: false,
    storm: true,
    clouds: false,
    pressure: false,
    humidity: false,
    temperature: false,
    lightning: true,
    terrain: false,
    satellite: true,
    borders: true,
    roads: true,
  });

  const [activeBasemap, setActiveBasemap] = useState<BasemapType>('google-hyb');

  // GeoPortal states
  const [showGeoPortal, setShowGeoPortal] = useState(false);
  const [activeGisLayers, setActiveGisLayers] = useState<Record<string, GisLayerDef & { visible: boolean; opacity: number }>>({});
  const [gibsDate, setGibsDate] = useState<string>(new Date(Date.now() - 3 * 86400000).toISOString().split('T')[0]);
  const [waybackRel, setWaybackRel] = useState<string>('');
  const [uploadedKmls, setUploadedKmls] = useState<UploadedKml[]>([]);
  const [measuring, setMeasuring] = useState(false);

  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(null);
  const [selectedLocationType, setSelectedLocationType] = useState<'city' | 'storm' | null>(null);
  const [searchTrigger, setSearchTrigger] = useState<{
    lat: number;
    lng: number;
    zoom: number;
    timestamp: number;
  } | null>(null);

  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [compareDate, setCompareDate] = useState<string | null>(null);
  const [activePanelTab, setActivePanelTab] = useState<'present' | 'past' | 'future'>('present');
  const isToday = selectedDate === new Date().toISOString().split('T')[0];
  void setSelectedDate;
  void setCompareDate;

  // UI state for collapsing panels
  const [showLayerPanel, setShowLayerPanel] = useState(true);
  const [showDashboardPanel, setShowDashboardPanel] = useState(false);
  const [showTutorial, setShowTutorial] = useState(true);
  const [stormsUpdateKey, setStormsUpdateKey] = useState(0);
  const [loadingStorms, setLoadingStorms] = useState(true);
  const [activeStormsCount, setActiveStormsCount] = useState(0);

  useEffect(() => {
    let active = true;

    const syncStorms = async () => {
      setLoadingStorms(true);
      try {
        const activeList = await fetchActiveStorms();
        if (active) {
          updatePresentStorms(activeList);
          setActiveStormsCount(activeList.length);
          setStormsUpdateKey(k => k + 1);
        }
      } catch (err) {
        console.error("Failed to sync storms:", err);
      } finally {
        if (active) setLoadingStorms(false);
      }
    };

    syncStorms();

    // Refresh every 10 minutes
    const interval = setInterval(syncStorms, 10 * 60 * 1000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);
  // 2. Action Handlers
  const handleToggleLayer = (key: keyof typeof layers) => {
    setLayers(prev => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const handleSelectLocation = (id: string, type: 'city' | 'storm') => {
    setSelectedLocationId(id);
    setSelectedLocationType(type);
  };

  const handleToggleGisLayer = (id: string, visible: boolean) => {
    setActiveGisLayers(prev => {
      if (prev[id]) {
        return {
          ...prev,
          [id]: { ...prev[id], visible }
        };
      }
      // Look up in catalog
      let found: GisLayerDef | undefined;
      for (const g of GIS_CATALOG) {
        found = g.layers.find(l => l.id === id);
        if (found) break;
      }
      if (found) {
        return {
          ...prev,
          [id]: { ...found, visible, opacity: 1.0 }
        };
      }
      return prev;
    });
  };

  const handleGisOpacityChange = (id: string, opacity: number) => {
    setActiveGisLayers(prev => {
      if (prev[id]) {
        return {
          ...prev,
          [id]: { ...prev[id], opacity }
        };
      }
      return prev;
    });
  };

  const handleAddKml = (kml: UploadedKml) => {
    setUploadedKmls(prev => [...prev, kml]);
  };

  const handleRemoveKml = (id: string) => {
    setUploadedKmls(prev => prev.filter(k => k.id !== id));
  };

  const handleUpdateKmlProps = (id: string, props: Partial<UploadedKml>) => {
    setUploadedKmls(prev => prev.map(k => k.id === id ? { ...k, ...props } : k));
  };

  // const handleDateChange = (date1: string, date2: string | null) => {
  //   setSelectedDate(date1);
  //   setCompareDate(date2);
  // };

  const handleCloseLocation = () => {
    setSelectedLocationId(null);
    setSelectedLocationType(null);
  };

  const handleMapClick = (lat: number, lng: number) => {
    const customId = `custom_${lat.toFixed(4)}_${lng.toFixed(4)}`;
    let matchedCity = cities.find((c: any) => c.id === customId);

    if (!matchedCity) {
      matchedCity = {
        id: customId,
        name: `Pinned Location`,
        state: `${Math.abs(lat).toFixed(4)}° ${lat >= 0 ? 'N' : 'S'}`,
        country: `${Math.abs(lng).toFixed(4)}° ${lng >= 0 ? 'E' : 'W'}`,
        coord: { lat, lng },
        baseTemp: 25,
        baseHumidity: 60,
        baseWindSpeed: 10,
        basePressure: 1010
      };
      cities.push(matchedCity);
    }
    handleSelectLocation(customId, 'city');
  };

  const handleSearchSelect = (item: any) => {
    setSearchTrigger({
      lat: item.lat,
      lng: item.lng,
      zoom: item.zoom,
      timestamp: Date.now()
    });

    if (item.type === 'city') {
      // Search only zooms the camera — storm positions are fixed globally.
      let matchedCity = cities.find((c: any) => c.id === item.id);

      // If it's a global city from Geocoding API that isn't in our array yet, add it!
      if (!matchedCity) {
        matchedCity = {
          id: item.id,
          name: item.originalName || item.name.split(',')[0],
          state: item.originalState || item.name.split(',')[1]?.trim() || '',
          country: item.country || '',
          coord: { lat: item.lat, lng: item.lng },
          baseTemp: 25,
          baseHumidity: 60,
          baseWindSpeed: 10,
          basePressure: 1010
        };
        cities.push(matchedCity);
      }
      handleSelectLocation(matchedCity.id, 'city');
    }
  };

  return (
    <main className="relative w-screen h-screen overflow-hidden bg-[#07090e] select-none text-slate-100 font-sans">
      
      {/* 1. Full-screen Interactive Weather Map */}
      <div className="absolute inset-0 w-full h-full z-0">
        <WeatherMap
          key={stormsUpdateKey}
          timeOffset={timeOffset}
          layers={layers}
          selectedLocationId={selectedLocationId}
          onSelectLocation={handleSelectLocation}
          onMapClick={handleMapClick}
          searchTrigger={searchTrigger}
          selectedDate={selectedDate}
          activeTab={activePanelTab}
          activeBasemap={activeBasemap}
          activeGisLayers={activeGisLayers}
          gibsDate={gibsDate}
          waybackRel={waybackRel}
          uploadedKmls={uploadedKmls}
          measuring={measuring}
        />
      </div>

      {/* 2. Top-Left Branding & Search Overlay */}
      <div 
        className="absolute top-5 left-5 flex flex-col gap-3 pointer-events-none"
        style={{ zIndex: 9999 }}
      >
        
        {/* Branding header */}
        <div className="glass-panel rounded-2xl px-4 py-3 shadow-xl border border-slate-700/40 flex items-center gap-3 pointer-events-auto">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-sky-500 via-blue-600 to-purple-600 flex items-center justify-center shadow-lg shadow-sky-500/25 animate-pulse">
            <Compass className="w-5 h-5 text-white animate-spin" style={{ animationDuration: '12s' }} />
          </div>
          <div>
            <h1 className="text-sm font-extrabold tracking-widest text-white uppercase font-heading flex items-center gap-1.5">
              AeroTempest <span className="text-[10px] bg-sky-500/10 text-sky-400 border border-sky-500/20 px-2 py-0.5 rounded-full font-bold">AI</span>
            </h1>
            <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">
              Storm Intelligence Platform
            </p>
          </div>
        </div>

        {/* Search & Date Controls */}
        <div className="pointer-events-auto w-full flex flex-col gap-2">
          <SearchBar onSearchSelect={handleSearchSelect} />
        </div>
      </div>

      {/* 3. Left Side Control Panels (Layer Controls & Basemap Switcher) */}
      <div 
        className="absolute left-5 bottom-[140px] flex flex-col gap-2 pointer-events-none"
        style={{ zIndex: 10 }}
      >
        <BasemapSelector
          activeBasemap={activeBasemap}
          onChangeBasemap={setActiveBasemap}
        />

        <button 
          onClick={() => {
            setShowGeoPortal(!showGeoPortal);
            if (!showGeoPortal) setShowLayerPanel(false);
          }}
          className={`p-3 rounded-xl glass-panel shadow-lg border pointer-events-auto transition-all ${
            showGeoPortal 
              ? 'bg-black border-slate-700 text-amber-500 scale-105 shadow-amber-500/10' 
              : 'text-slate-300 border-slate-700/50 hover:text-white hover:bg-slate-800'
          }`}
          title="Toggle COJAG GeoPortal"
        >
          <FolderOpen className="w-5 h-5" />
        </button>
        
        {/* Collapsible Layer Panel */}
        <div className="flex flex-col gap-2 pointer-events-auto h-full justify-start items-start">
          <button 
            onClick={() => {
              setShowLayerPanel(!showLayerPanel);
              if (!showLayerPanel) setShowGeoPortal(false);
            }}
            className={`p-3 rounded-xl glass-panel shadow-lg border transition-all ${
              showLayerPanel 
                ? 'bg-black border-slate-700 text-sky-400' 
                : 'text-slate-300 border-slate-700/50 hover:text-white hover:bg-slate-800'
            }`}
            title="Toggle Map Layers"
          >
            <Layers className="w-5 h-5" />
          </button>
          
          {showLayerPanel && (
            <div className="animate-in slide-in-from-left duration-250">
              <LayerControls 
                layers={layers}
                onToggleLayer={handleToggleLayer}
              />
            </div>
          )}
        </div>

      </div>

      {/* GeoPortal Panel — positioned independently to avoid overlap */}
      {showGeoPortal && (
        <div 
          className="fixed left-[70px] bottom-[140px] z-50 pointer-events-auto animate-in slide-in-from-left duration-300"
        >
          <GeoPortalPanel
            onClose={() => setShowGeoPortal(false)}
            activeGisLayers={activeGisLayers}
            onToggleGisLayer={handleToggleGisLayer}
            onGisOpacityChange={handleGisOpacityChange}
            gibsDate={gibsDate}
            onGibsDateChange={setGibsDate}
            waybackRel={waybackRel}
            onWaybackRelChange={setWaybackRel}
            uploadedKmls={uploadedKmls}
            onAddKml={handleAddKml}
            onRemoveKml={handleRemoveKml}
            onUpdateKmlProps={handleUpdateKmlProps}
            measuring={measuring}
            onToggleMeasuring={() => setMeasuring(!measuring)}
          />
        </div>
      )}

      {/* 4. Bottom Timeline Controller */}
      <div 
        className="absolute bottom-5 left-5 z-30 pointer-events-none flex justify-center transition-all duration-300"
        style={{ right: selectedLocationId ? '424px' : '20px' }}
      >
        <div className="pointer-events-auto w-full max-w-5xl">
          <Timeline 
            timeOffset={timeOffset}
            onChangeTimeOffset={setTimeOffset}
          />
        </div>
      </div>

      {/* 5. Right Edge Panels — side-by-side, no overlap */}
      {selectedLocationId && (
        <div className="absolute top-0 right-0 bottom-0 z-40 flex flex-row-reverse pointer-events-auto">
          <SidePanel
            locationId={selectedLocationId}
            locationType={selectedLocationType}
            timeOffset={timeOffset}
            selectedDate={selectedDate}
            compareDate={compareDate}
            onClose={handleCloseLocation}
            activeTab={activePanelTab}
            onTabChange={setActivePanelTab}
          />
        </div>
      )}

      {/* 6. Top Right Panels (Tutorial & AI Dashboard) */}
      <div 
        className="absolute top-5 flex flex-col items-end gap-4 pointer-events-none transition-all duration-300"
        style={{ right: selectedLocationId ? '404px' : '20px', zIndex: 30 }}
      >
        
        {/* Onboarding Tutorial Panel */}
        {showTutorial && (
          <div className="pointer-events-auto glass-panel max-w-sm rounded-xl p-4 shadow-xl border border-slate-700/40 text-slate-300 flex flex-col gap-2.5 animate-in fade-in slide-in-from-right duration-500">
            <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
              <span className="text-xs font-bold text-white flex items-center gap-1.5">
                <Info className="w-4 h-4 text-sky-400" />
                Storm Simulation Lab
              </span>
              <button 
                onClick={() => setShowTutorial(false)}
                className="text-[10px] text-slate-500 hover:text-slate-300 font-bold"
              >
                Dismiss
              </button>
            </div>
            <p className="text-[11px] leading-relaxed">
              Drag the <b>Forecast Timeline</b> at the bottom to watch the typhoon path shift. Click on the <b>Typhoon eye</b> or any <b>City marker</b> to see real-time meteorology and AI predictions!
            </p>
            <div className="text-[10px] text-slate-400 font-mono flex items-center justify-between mt-1">
              <span>🔴 Extreme Risk</span>
              <span>🟠 High Risk</span>
              <span>🟡 Medium Risk</span>
              <span>🟢 Low Risk</span>
            </div>
          </div>
        )}

        {/* AI Command Center Toggle */}
        <div className="pointer-events-auto">
          <button 
            onClick={() => setShowDashboardPanel(!showDashboardPanel)}
            className={`p-3 rounded-xl glass-panel shadow-lg border transition-all ${
              showDashboardPanel 
                ? 'bg-black border-slate-700 text-sky-400' 
                : 'text-slate-300 border-slate-700/50 hover:text-white hover:bg-slate-800'
            }`}
            title="Toggle AI Dashboard"
          >
            <Activity className="w-5 h-5" />
          </button>
        </div>

        {/* AI Command Center Panel */}
        {showDashboardPanel && (
          <div className="pointer-events-auto w-96 md:w-[480px] max-w-[85vw] animate-in slide-in-from-right duration-250 relative">
            <AIDashboard 
              timeOffset={timeOffset}
              selectedLocationId={selectedLocationId}
              selectedLocationType={selectedLocationType}
              selectedDate={selectedDate}
              compareDate={compareDate}
              onCloseLocation={handleCloseLocation}
            />
          </div>
        )}

      </div>

      {/* 8. "No Active Tropical Cyclones" Alert */}
      {isToday && activeStormsCount === 0 && !loadingStorms && (
        <div className="absolute bottom-[130px] left-1/2 -translate-x-1/2 glass-panel px-4 py-2.5 rounded-full border border-emerald-500/20 bg-emerald-950/20 text-emerald-400 font-semibold tracking-wide text-xs shadow-2xl flex items-center gap-2 z-50 animate-pulse">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
          No Active Tropical Cyclones Today
        </div>
      )}

    </main>
  );
}
