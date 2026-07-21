import React, { useState } from 'react';
import { Columns, X, Thermometer, Wind, Gauge, Droplets, CloudRain, Shield } from 'lucide-react';
import { ComparisonService, type ComparisonMetric } from '../../services/comparisonService';
import { cities } from '../../mockData';

interface ComparisonModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ComparisonModal: React.FC<ComparisonModalProps> = ({ isOpen, onClose }) => {
  const [selectedIds, setSelectedIds] = useState<string[]>(['mumbai', 'tokyo']);

  if (!isOpen) return null;

  const comparisonData: ComparisonMetric[] = ComparisonService.compareLocations(selectedIds);

  const toggleCity = (id: string) => {
    if (selectedIds.includes(id)) {
      if (selectedIds.length > 1) {
        setSelectedIds(prev => prev.filter(i => i !== id));
      }
    } else {
      if (selectedIds.length < 4) {
        setSelectedIds(prev => [...prev, id]);
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-[#0b0e17] border border-slate-800 rounded-2xl w-full max-w-4xl shadow-2xl overflow-hidden flex flex-col text-slate-100">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-2">
            <Columns className="w-5 h-5 text-sky-400" />
            <h3 className="text-xs font-bold uppercase tracking-wide font-mono">
              Multi-Location Weather Comparison
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* City Selectors */}
        <div className="px-5 py-3 border-b border-slate-800/80 bg-slate-900/40 flex items-center gap-2 overflow-x-auto custom-scrollbar">
          <span className="text-[10px] font-bold text-slate-400 uppercase font-mono shrink-0">Compare (Max 4):</span>
          {cities.slice(0, 10).map(c => {
            const active = selectedIds.includes(c.id);
            return (
              <button
                key={c.id}
                onClick={() => toggleCity(c.id)}
                className={`px-3 py-1 rounded-full text-xs font-bold transition-all border whitespace-nowrap ${
                  active
                    ? 'bg-sky-500/20 border-sky-500 text-sky-300 shadow-md'
                    : 'bg-slate-900/80 border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                {c.name} {active && '✓'}
              </button>
            );
          })}
        </div>

        {/* Comparison Grid */}
        <div className="p-5 max-h-[70vh] overflow-y-auto custom-scrollbar">
          <div className={`grid gap-4 grid-cols-1 ${selectedIds.length === 2 ? 'md:grid-cols-2' : selectedIds.length === 3 ? 'md:grid-cols-3' : 'md:grid-cols-4'}`}>
            {comparisonData.map(item => (
              <div
                key={item.locationId}
                className="bg-slate-900/50 border border-slate-800 rounded-2xl p-4 flex flex-col gap-3"
              >
                <div className="border-b border-slate-800 pb-2 flex justify-between items-center">
                  <span className="font-extrabold text-sm text-white truncate">{item.locationName}</span>
                </div>

                <div className="flex flex-col gap-2 text-xs">
                  <div className="flex items-center justify-between p-2 rounded-xl bg-slate-950/60 border border-slate-800/60">
                    <span className="text-slate-400 flex items-center gap-1.5">
                      <Thermometer className="w-4 h-4 text-orange-400" /> Temperature
                    </span>
                    <span className="font-bold text-white">{item.temp}°C</span>
                  </div>

                  <div className="flex items-center justify-between p-2 rounded-xl bg-slate-950/60 border border-slate-800/60">
                    <span className="text-slate-400 flex items-center gap-1.5">
                      <Droplets className="w-4 h-4 text-cyan-400" /> Humidity
                    </span>
                    <span className="font-bold text-white">{item.humidity}%</span>
                  </div>

                  <div className="flex items-center justify-between p-2 rounded-xl bg-slate-950/60 border border-slate-800/60">
                    <span className="text-slate-400 flex items-center gap-1.5">
                      <Wind className="w-4 h-4 text-sky-400" /> Wind Speed
                    </span>
                    <span className="font-bold text-white">{item.windSpeed} km/h</span>
                  </div>

                  <div className="flex items-center justify-between p-2 rounded-xl bg-slate-950/60 border border-slate-800/60">
                    <span className="text-slate-400 flex items-center gap-1.5">
                      <Gauge className="w-4 h-4 text-purple-400" /> Pressure
                    </span>
                    <span className="font-bold text-white">{item.pressure} hPa</span>
                  </div>

                  <div className="flex items-center justify-between p-2 rounded-xl bg-slate-950/60 border border-slate-800/60">
                    <span className="text-slate-400 flex items-center gap-1.5">
                      <CloudRain className="w-4 h-4 text-blue-400" /> Rainfall
                    </span>
                    <span className="font-bold text-white">{item.rainfall} mm/h</span>
                  </div>

                  <div className="flex items-center justify-between p-2 rounded-xl bg-slate-950/60 border border-slate-800/60">
                    <span className="text-slate-400 flex items-center gap-1.5">
                      <Shield className="w-4 h-4 text-emerald-400" /> Air Quality (AQI)
                    </span>
                    <span className="font-bold text-emerald-400">{item.aqi}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
