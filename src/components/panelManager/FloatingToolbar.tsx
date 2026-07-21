import React from 'react';
import { Layers, FolderOpen, Brain, Map } from 'lucide-react';
import { ToolbarButton } from './ToolbarButton';

export interface FloatingToolbarProps {
  activePanels: {
    layers: boolean;
    geoPortal: boolean;
    aiDashboard: boolean;
    basemap: boolean;
  };
  onTogglePanel: (panelKey: 'layers' | 'geoPortal' | 'aiDashboard' | 'basemap') => void;
}

export const FloatingToolbar: React.FC<FloatingToolbarProps> = ({
  activePanels,
  onTogglePanel,
}) => {
  return (
    <nav
      aria-label="GIS Feature Toolbar"
      className="flex flex-col gap-2.5 bg-slate-950/75 backdrop-blur-xl border border-slate-800/80 p-2 rounded-2xl shadow-2xl pointer-events-auto"
    >
      {/* 1. Map Layers Control Button */}
      <ToolbarButton
        id="layers"
        label="Map Layers & Overlays"
        icon={<Layers className="w-5 h-5" />}
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
        label="AI Command & Storm Analytics"
        icon={<Brain className="w-5 h-5 text-purple-400" />}
        active={activePanels.aiDashboard}
        onClick={() => onTogglePanel('aiDashboard')}
        badge="AI"
      />

      <div className="w-full h-px bg-slate-800/80 my-0.5" />

      {/* 4. Basemap Selector Button */}
      <ToolbarButton
        id="basemap"
        label="Basemap & Satellite Selector"
        icon={<Map className="w-5 h-5 text-emerald-400" />}
        active={activePanels.basemap}
        onClick={() => onTogglePanel('basemap')}
      />
    </nav>
  );
};
