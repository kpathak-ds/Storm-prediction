import React from 'react';
import { FileText, Download, X } from 'lucide-react';
import { ReportService } from '../../services/reportService';
import { cities } from '../../mockData';

interface ReportExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedLocationId: string | null;
}

export const ReportExportModal: React.FC<ReportExportModalProps> = ({
  isOpen,
  onClose,
  selectedLocationId,
}) => {
  if (!isOpen) return null;

  const city = cities.find(c => c.id === selectedLocationId) || cities[0];

  const handleExportPDF = () => {
    ReportService.generatePDFReport({
      title: 'AeroTempest Executive Weather Report',
      locationName: city ? `${city.name}, ${city.country}` : 'Bay of Bengal Region',
      metrics: {
        temp: city?.baseTemp ?? 28,
        feelsLike: (city?.baseTemp ?? 28) + 2,
        humidity: city?.baseHumidity ?? 65,
        pressure: city?.basePressure ?? 1012,
        windSpeed: city?.baseWindSpeed ?? 18,
        rainfall: 2.5,
        aqi: 48,
        riskLevel: 'LOW',
      },
      summaryNotes: [
        'Atmospheric stability index is currently within normal operating thresholds.',
        'No active severe cyclone or typhoon passage predicted over the next 24 hours.',
        'Air Quality Index remains good with particulate matter ($PM2.5 / PM10$) under recommended limits.',
      ],
    });
    onClose();
  };

  const handleExportCSV = () => {
    const dummyData = Array.from({ length: 24 }).map((_, i) => ({
      Hour: `+${i}h`,
      Location: city ? city.name : 'Regional Grid',
      Temperature_C: (city?.baseTemp ?? 25) + Math.round(Math.sin(i / 3) * 3),
      Humidity_Percent: Math.min(95, (city?.baseHumidity ?? 60) + i),
      WindSpeed_Kmh: Math.max(5, (city?.baseWindSpeed ?? 12) + Math.round(Math.cos(i) * 4)),
      Pressure_hPa: (city?.basePressure ?? 1012) - Math.round(i / 4),
      Rainfall_mm: (i % 6 === 0 ? 3.5 : 0.2).toFixed(1),
    }));

    ReportService.exportCSV(city ? city.name : 'Regional_Grid', dummyData);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-[#0b0e17] border border-slate-800 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col text-slate-100">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-emerald-400" />
            <h3 className="text-xs font-bold uppercase tracking-wide font-mono">
              Export Weather Intelligence Report
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 flex flex-col gap-4 text-xs">
          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-3 flex flex-col gap-1">
            <span className="text-[10px] text-slate-400 font-mono uppercase">Target Location</span>
            <span className="font-bold text-white text-sm">
              {city ? `${city.name}, ${city.state}, ${city.country}` : 'Indian Subcontinent Grid'}
            </span>
          </div>

          <p className="text-slate-300 leading-relaxed">
            Select export format to generate executive weather reports or download full tabular metrics.
          </p>

          <div className="grid grid-cols-2 gap-3 pt-2">
            <button
              onClick={handleExportPDF}
              className="flex items-center justify-center gap-2 p-3 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs transition-all shadow-lg shadow-purple-600/20"
            >
              <FileText className="w-4 h-4" />
              PDF Document
            </button>

            <button
              onClick={handleExportCSV}
              className="flex items-center justify-center gap-2 p-3 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-bold text-xs transition-all"
            >
              <Download className="w-4 h-4 text-emerald-400" />
              CSV Data Sheet
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
