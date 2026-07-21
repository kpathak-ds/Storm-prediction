import { useState, useRef, useEffect } from 'react';
import { Globe, Map, Compass, Moon, Shield, Anchor, Layers } from 'lucide-react';

export type BasemapType = 'dark' | 'osm' | 'esri' | 'google-sat' | 'google-hyb' | 'topo' | 'ocean';

interface BasemapSelectorProps {
  activeBasemap: BasemapType;
  onChangeBasemap: (type: BasemapType) => void;
}

export default function BasemapSelector({ activeBasemap, onChangeBasemap }: BasemapSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const basemaps = [
    { type: 'dark' as const, label: 'Dark Matter', desc: 'Ideal for overlays', icon: Moon, color: 'text-purple-400' },
    { type: 'osm' as const, label: 'OpenStreetMap', desc: 'Standard street map', icon: Map, color: 'text-sky-400' },
    { type: 'esri' as const, label: 'ESRI Satellite', desc: 'High-res imagery', icon: Globe, color: 'text-emerald-400' },
    { type: 'google-sat' as const, label: 'Google Satellite', desc: 'Precision satellite', icon: Compass, color: 'text-teal-400' },
    { type: 'google-hyb' as const, label: 'Google Hybrid', desc: 'Satellite with labels', icon: Layers, color: 'text-indigo-400' },
    { type: 'topo' as const, label: 'Topographic', desc: 'Terrain & elevation', icon: Shield, color: 'text-orange-400' },
    { type: 'ocean' as const, label: 'ESRI Ocean', desc: 'Deep-sea bathymetry', icon: Anchor, color: 'text-blue-400' },
  ];

  const activeObj = basemaps.find(b => b.type === activeBasemap) || basemaps[0];
  const ActiveIcon = activeObj.icon;

  return (
    <div ref={containerRef} className="relative pointer-events-auto">
      {/* Floating Toggle Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`p-3 rounded-xl glass-panel shadow-lg border transition-all flex items-center justify-center hover:bg-slate-800 ${
          isOpen 
            ? 'bg-black border-slate-700 text-sky-400 scale-105' 
            : 'text-slate-300 border-slate-700/50 hover:text-white'
        }`}
        title="Switch Base Map"
      >
        <ActiveIcon className={`w-5 h-5 ${activeObj.color}`} />
      </button>

      {/* Dropdown Options Box */}
      {isOpen && (
        <div className="absolute left-[120%] top-0 z-50 bg-[#0f121d] border border-slate-700/80 rounded-xl shadow-2xl p-2 w-[240px] flex flex-col gap-1.5 animate-in slide-in-from-left duration-200">
          <div className="px-2.5 py-1.5 border-b border-slate-800/80 mb-0.5">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest font-mono">Basemap Layer</span>
          </div>

          <div className="flex flex-col gap-0.5 max-h-[280px] overflow-y-auto scrollbar-thin">
            {basemaps.map((b) => {
              const Icon = b.icon;
              const active = b.type === activeBasemap;
              return (
                <button
                  key={b.type}
                  onClick={() => {
                    onChangeBasemap(b.type);
                    setIsOpen(false);
                  }}
                  className={`flex items-start gap-3 w-full px-2.5 py-2 rounded-lg text-left transition-all ${
                    active 
                      ? 'bg-sky-500/10 border border-sky-500/20 shadow-md' 
                      : 'hover:bg-slate-800/60 border border-transparent'
                  }`}
                >
                  <div className={`p-1.5 rounded-md ${active ? 'bg-sky-500/15' : 'bg-slate-900/50'} shrink-0`}>
                    <Icon className={`w-4 h-4 ${b.color}`} />
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className={`text-[11px] font-bold truncate leading-tight ${active ? 'text-sky-400' : 'text-slate-200'}`}>
                      {b.label}
                    </span>
                    <span className="text-[9px] text-slate-500 truncate mt-0.5 font-medium leading-none">
                      {b.desc}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
