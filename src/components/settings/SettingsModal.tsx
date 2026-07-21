import React from 'react';
import { X, Settings, Thermometer, Wind, Gauge, Compass } from 'lucide-react';
import { useSettings } from '../../context/SettingsContext';
import type { TempUnit, SpeedUnit, PressureUnit, DistanceUnit, ThemeMode, Language } from '../../types/settings';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
  const { preferences, updatePreferences } = useSettings();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-[#0b0e17] border border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col text-slate-100">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-2.5">
            <Settings className="w-5 h-5 text-sky-400" />
            <h2 className="text-sm font-bold tracking-wider uppercase font-mono">Platform Preferences</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 flex flex-col gap-5 max-h-[75vh] overflow-y-auto custom-scrollbar text-xs">
          {/* Temperature Units */}
          <div className="flex flex-col gap-2">
            <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider font-mono flex items-center gap-2">
              <Thermometer className="w-4 h-4 text-orange-400" /> Temperature Unit
            </label>
            <div className="grid grid-cols-2 gap-2">
              {(['C', 'F'] as TempUnit[]).map(unit => (
                <button
                  key={unit}
                  onClick={() => updatePreferences({ tempUnit: unit })}
                  className={`py-2 px-3 rounded-xl font-bold border transition-all ${
                    preferences.tempUnit === unit
                      ? 'bg-sky-500/20 border-sky-500 text-sky-300 shadow-md shadow-sky-500/10'
                      : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  Celsius (°C) {unit === 'C' && '✓'}
                  {unit === 'F' && 'Fahrenheit (°F)'}
                </button>
              ))}
            </div>
          </div>

          {/* Wind Speed Units */}
          <div className="flex flex-col gap-2">
            <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider font-mono flex items-center gap-2">
              <Wind className="w-4 h-4 text-sky-400" /> Wind Speed Unit
            </label>
            <div className="grid grid-cols-4 gap-2">
              {(['kmh', 'mph', 'ms', 'knots'] as SpeedUnit[]).map(unit => (
                <button
                  key={unit}
                  onClick={() => updatePreferences({ speedUnit: unit })}
                  className={`py-2 px-2 rounded-xl font-bold border text-center transition-all uppercase ${
                    preferences.speedUnit === unit
                      ? 'bg-sky-500/20 border-sky-500 text-sky-300 shadow-md'
                      : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  {unit}
                </button>
              ))}
            </div>
          </div>

          {/* Pressure Units */}
          <div className="flex flex-col gap-2">
            <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider font-mono flex items-center gap-2">
              <Gauge className="w-4 h-4 text-purple-400" /> Barometric Pressure Unit
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(['hPa', 'inHg', 'mmHg'] as PressureUnit[]).map(unit => (
                <button
                  key={unit}
                  onClick={() => updatePreferences({ pressureUnit: unit })}
                  className={`py-2 px-2 rounded-xl font-bold border text-center transition-all ${
                    preferences.pressureUnit === unit
                      ? 'bg-sky-500/20 border-sky-500 text-sky-300 shadow-md'
                      : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  {unit}
                </button>
              ))}
            </div>
          </div>

          {/* Distance Unit */}
          <div className="flex flex-col gap-2">
            <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider font-mono flex items-center gap-2">
              <Compass className="w-4 h-4 text-emerald-400" /> Distance Unit
            </label>
            <div className="grid grid-cols-2 gap-2">
              {(['km', 'mi'] as DistanceUnit[]).map(unit => (
                <button
                  key={unit}
                  onClick={() => updatePreferences({ distanceUnit: unit })}
                  className={`py-2 px-3 rounded-xl font-bold border transition-all ${
                    preferences.distanceUnit === unit
                      ? 'bg-sky-500/20 border-sky-500 text-sky-300 shadow-md'
                      : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  {unit === 'km' ? 'Kilometers (km)' : 'Miles (mi)'}
                </button>
              ))}
            </div>
          </div>

          {/* Theme Selector */}
          <div className="flex flex-col gap-2">
            <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider font-mono">
              Theme Mode
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(['dark', 'light', 'high-contrast'] as ThemeMode[]).map(t => (
                <button
                  key={t}
                  onClick={() => updatePreferences({ theme: t })}
                  className={`py-2 px-2 rounded-xl font-bold border text-center uppercase tracking-wider text-[10px] transition-all ${
                    preferences.theme === t
                      ? 'bg-sky-500/20 border-sky-500 text-sky-300'
                      : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* Language Selector */}
          <div className="flex flex-col gap-2">
            <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider font-mono">
              Language
            </label>
            <select
              value={preferences.language}
              onChange={e => updatePreferences({ language: e.target.value as Language })}
              className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 text-xs outline-none focus:border-sky-500 font-mono"
            >
              <option value="en">English (US)</option>
              <option value="es">Español</option>
              <option value="fr">Français</option>
              <option value="hi">हिंदी (Hindi)</option>
            </select>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-800 bg-slate-950/80 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-sky-500 hover:bg-sky-400 text-slate-950 text-xs font-black rounded-xl shadow-lg transition-all"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
