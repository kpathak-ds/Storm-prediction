import { 
  Wind, 
  CloudRain, 
  Zap, 
  Cloud, 
  Compass, 
  Droplets, 
  Thermometer, 
  Mountain,
  Map, 
  Eye, 
  EyeOff,
  Layers,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { useState } from 'react';

interface LayerControlsProps {
  layers: {
    wind: boolean;
    rain: boolean;
    storm: boolean;
    clouds: boolean;
    pressure: boolean;
    humidity: boolean;
    temperature: boolean;
    lightning: boolean;
    terrain: boolean;
    satellite: boolean;
    borders: boolean;
    roads: boolean;
  };
  onToggleLayer: (layerKey: keyof LayerControlsProps['layers']) => void;
}

export default function LayerControls({ layers, onToggleLayer }: LayerControlsProps) {
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    "Weather Overlays": true,
    "Base Map Layers": false
  });

  const toggleSection = (title: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [title]: !prev[title]
    }));
  };

  const categories = [
    {
      title: "Weather Overlays",
      items: [
        { key: "wind" as const, label: "Wind Streamlines", icon: Wind, color: "text-sky-400" },
        { key: "rain" as const, label: "Precipitation (Rain)", icon: CloudRain, color: "text-blue-400" },
        { key: "storm" as const, label: "Storm Warnings", icon: Zap, color: "text-purple-400" },
        { key: "clouds" as const, label: "Cloud Cover", icon: Cloud, color: "text-slate-300" },
        { key: "pressure" as const, label: "Isobaric Pressure", icon: Compass, color: "text-teal-400" },
        { key: "humidity" as const, label: "Humidity index", icon: Droplets, color: "text-cyan-400" },
        { key: "temperature" as const, label: "Temperature Map", icon: Thermometer, color: "text-orange-400" },
        { key: "lightning" as const, label: "Lightning Strikes", icon: Zap, color: "text-yellow-400 animate-pulse" },
      ]
    },
    {
      title: "Base Map Layers",
      items: [
        { key: "terrain" as const, label: "3D Terrain", icon: Mountain, color: "text-amber-500" },
        { key: "borders" as const, label: "District Borders", icon: Map, color: "text-pink-400" },
        { key: "roads" as const, label: "Roads & City Labels", icon: Layers, color: "text-indigo-400" },
      ]
    }
  ];

  return (
    <div className="text-slate-100 flex flex-col gap-3.5 p-1">
      <div className="flex items-center justify-between border-b border-slate-800 pb-2">
        <span className="text-[10px] font-bold tracking-wider uppercase text-slate-400 font-mono">
          Weather & Map Overlays
        </span>
        <span className="text-[10px] bg-sky-500/10 text-sky-400 border border-sky-500/20 px-2 py-0.5 rounded-full font-semibold">
          LIVE
        </span>
      </div>

      {categories.map((cat, idx) => {
        const isExpanded = expandedSections[cat.title];
        return (
          <div key={idx} className="flex flex-col gap-2 border-b border-slate-900/60 pb-2 last:border-b-0 last:pb-0">
            <button 
              onClick={() => toggleSection(cat.title)}
              className="flex items-center justify-between w-full text-[10px] font-extrabold text-slate-500 hover:text-slate-300 uppercase tracking-widest px-1 py-1 text-left transition-colors"
            >
              <span>{cat.title}</span>
              {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>

            {isExpanded && (
              <div className="flex flex-col gap-1 animate-in fade-in duration-150">
                {cat.items.map((item) => {
                  const Icon = item.icon;
                  const isActive = layers[item.key];
                  return (
                    <button
                      key={item.key}
                      onClick={() => onToggleLayer(item.key)}
                      className={`flex items-center justify-between w-full px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 text-left border ${
                        isActive 
                          ? 'bg-slate-800/80 border-slate-700 text-white shadow-inner shadow-slate-950/20' 
                          : 'bg-transparent border-transparent hover:bg-slate-800/30 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <Icon className={`w-4 h-4 ${isActive ? item.color : 'text-slate-500'}`} />
                        <span>{item.label}</span>
                      </div>
                      {isActive ? (
                        <Eye className="w-3.5 h-3.5 text-sky-400" />
                      ) : (
                        <EyeOff className="w-3.5 h-3.5 text-slate-600" />
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}

      <div className="text-[9px] text-slate-600 text-center pt-1 font-mono">
        Models: ICON 13km / GFS 22km
      </div>
    </div>
  );
}
