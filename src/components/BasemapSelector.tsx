import { Globe, Map, Compass, Moon, Shield, Anchor, Layers } from 'lucide-react';

export type BasemapType = 'dark' | 'osm' | 'esri' | 'google-sat' | 'google-hyb' | 'topo' | 'ocean';

interface BasemapSelectorProps {
  activeBasemap: BasemapType;
  onChangeBasemap: (type: BasemapType) => void;
}

export default function BasemapSelector({ activeBasemap, onChangeBasemap }: BasemapSelectorProps) {
  const basemaps = [
    { type: 'dark' as const, label: 'Dark Matter', desc: 'Ideal for weather overlays', icon: Moon, color: 'text-purple-400' },
    { type: 'osm' as const, label: 'OpenStreetMap', desc: 'Standard street map', icon: Map, color: 'text-sky-400' },
    { type: 'esri' as const, label: 'ESRI Satellite', desc: 'High-res satellite imagery', icon: Globe, color: 'text-emerald-400' },
    { type: 'google-sat' as const, label: 'Google Satellite', desc: 'Precision satellite map', icon: Compass, color: 'text-teal-400' },
    { type: 'google-hyb' as const, label: 'Google Hybrid', desc: 'Satellite with road labels', icon: Layers, color: 'text-indigo-400' },
    { type: 'topo' as const, label: 'Topographic', desc: 'Terrain & elevation contours', icon: Shield, color: 'text-orange-400' },
    { type: 'ocean' as const, label: 'ESRI Ocean', desc: 'Deep-sea bathymetry', icon: Anchor, color: 'text-blue-400' },
  ];

  return (
    <div className="flex flex-col gap-2 p-1">
      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono mb-1">
        Select Base Map Layer
      </div>

      <div className="flex flex-col gap-1.5 max-h-[320px] overflow-y-auto pr-1 custom-scrollbar">
        {basemaps.map((b) => {
          const Icon = b.icon;
          const active = b.type === activeBasemap;
          return (
            <button
              key={b.type}
              onClick={() => onChangeBasemap(b.type)}
              className={`flex items-center gap-3 w-full p-2.5 rounded-xl text-left transition-all border ${
                active 
                  ? 'bg-sky-500/15 border-sky-500/50 text-white shadow-lg shadow-sky-500/10 ring-1 ring-sky-500/30' 
                  : 'bg-slate-900/50 border-slate-800/80 hover:bg-slate-800/80 hover:border-slate-700 text-slate-300'
              }`}
            >
              <div className={`p-2 rounded-lg ${active ? 'bg-sky-500/20' : 'bg-slate-800/80'} shrink-0`}>
                <Icon className={`w-4 h-4 ${b.color}`} />
              </div>

              <div className="flex flex-col min-w-0 flex-1">
                <span className={`text-xs font-bold truncate ${active ? 'text-sky-300' : 'text-slate-200'}`}>
                  {b.label}
                </span>
                <span className="text-[10px] text-slate-400 truncate font-medium">
                  {b.desc}
                </span>
              </div>

              {active && (
                <span className="w-2 h-2 rounded-full bg-sky-400 shadow-[0_0_8px_rgba(56,189,248,0.8)] shrink-0" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
