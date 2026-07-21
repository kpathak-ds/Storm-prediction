import React from 'react';
import { Layers, FolderOpen, Brain, Map, Columns, FileText, Bell } from 'lucide-react';
import { ToolbarButton } from './ToolbarButton';

export interface FloatingToolbarProps {
  activePanels: {
    layers: boolean;
    geoPortal: boolean;
    aiDashboard: boolean;
    basemap: boolean;
  };
  onTogglePanel: (panelKey: 'layers' | 'geoPortal' | 'aiDashboard' | 'basemap') => void;
  onOpenComparison: () => void;
  onOpenReportModal: () => void;
  onOpenAlerts: () => void;
  alertCount?: number;
}

export const FloatingToolbar: React.FC<FloatingToolbarProps> = ({
  activePanels,
  onTogglePanel,
  onOpenComparison,
  onOpenReportModal,
  onOpenAlerts,
  alertCount = 0,
}) => {
  return (
    <nav
      aria-label="GIS Feature Toolbar"
      className="flex flex-col gap-2 bg-slate-950/75 backdrop-blur-xl border border-slate-800/80 p-2 rounded-2xl shadow-2xl pointer-events-auto"
    >
      {/* 1. Map Layers Control Button */}
      <ToolbarButton
        id="layers"
        label="Map Layers & Overlays"
        icon={<Layers className="w-5 h-5 text-sky-400" />}
        active={activePanels.layers}
        onClick={() => onTogglePanel('layers')}
      />

      {/* 2. COJAG Data / File Explorer Button */}
      <ToolbarButton
        id="geoPortal"
        label="Data & File Explorer (GeoPortal)"
        icon={<FolderOpen className="w-5 h-5 text-amber-400" />}
        active={activePanels.geoPortal}
        onClick={() => onTogglePanel('geoPortal')}
      />

      {/* 3. AI Command & Analytics Center Button */}
      <ToolbarButton
        id="aiDashboard"
        label="AI Command & Analytics"
        icon={<Brain className="w-5 h-5 text-purple-400" />}
        active={activePanels.aiDashboard}
        onClick={() => onTogglePanel('aiDashboard')}
        badge="AI"
      />

      {/* 4. Basemap & Satellite Selector Button */}
      <ToolbarButton
        id="basemap"
        label="Basemap & Satellite Imagery"
        icon={<Map className="w-5 h-5 text-emerald-400" />}
        active={activePanels.basemap}
        onClick={() => onTogglePanel('basemap')}
      />

      <div className="w-full h-px bg-slate-800/80 my-0.5" />

      {/* 5. Weather Comparison Modal Trigger */}
      <ToolbarButton
        id="comparison"
        label="Multi-Location Comparison"
        icon={<Columns className="w-5 h-5 text-cyan-400" />}
        active={false}
        onClick={onOpenComparison}
      />

      {/* 6. PDF/CSV Report Generation Trigger */}
      <ToolbarButton
        id="report"
        label="Export Weather Report (PDF/CSV)"
        icon={<FileText className="w-5 h-5 text-teal-400" />}
        active={false}
        onClick={onOpenReportModal}
      />

      {/* 7. Severe Weather Alert Center Trigger */}
      <ToolbarButton
        id="alerts"
        label="Hazard Warnings & Alerts"
        icon={<Bell className="w-5 h-5 text-red-400" />}
        active={false}
        onClick={onOpenAlerts}
        badge={alertCount > 0 ? alertCount : undefined}
      />
    </nav>
  );
};
