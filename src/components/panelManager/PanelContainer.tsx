import React, { useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { DockPanel } from './DockPanel';

export interface PanelDefinition {
  id: string;
  title: string;
  icon: React.ReactNode;
  content: React.ReactNode;
  width?: string;
}

interface PanelContainerProps {
  panels: PanelDefinition[];
  onClosePanel: (id: string) => void;
}

export const PanelContainer: React.FC<PanelContainerProps> = ({
  panels,
  onClosePanel,
}) => {
  const [activeTabId, setActiveTabId] = useState<string>(panels[0]?.id || '');

  if (panels.length === 0) return null;

  return (
    <>
      {/* Desktop View (screens >= 768px): Side-by-Side Docking Container */}
      <div className="hidden md:flex flex-row items-start gap-4 pointer-events-none max-w-[calc(100vw-120px)] overflow-x-auto pb-4 custom-scrollbar">
        <AnimatePresence mode="popLayout">
          {panels.map(panel => (
            <DockPanel
              key={panel.id}
              id={panel.id}
              title={panel.title}
              icon={panel.icon}
              width={panel.width}
              onClose={() => onClosePanel(panel.id)}
            >
              {panel.content}
            </DockPanel>
          ))}
        </AnimatePresence>
      </div>

      {/* Mobile View (screens < 768px): Tabbed Accordion Container to avoid overflow */}
      <div className="flex md:hidden flex-col w-[92vw] max-w-sm glass-panel rounded-2xl border border-slate-700/60 shadow-2xl overflow-hidden pointer-events-auto">
        {/* Tab Switcher Header */}
        <div className="flex border-b border-slate-800 bg-slate-950/80 overflow-x-auto shrink-0">
          {panels.map(panel => {
            const isActive = (activeTabId || panels[0]?.id) === panel.id;
            return (
              <button
                key={panel.id}
                onClick={() => setActiveTabId(panel.id)}
                className={`flex items-center gap-1.5 px-3 py-2.5 text-xs font-bold transition-colors whitespace-nowrap border-b-2 ${
                  isActive
                    ? 'text-sky-400 border-sky-400 bg-sky-500/10'
                    : 'text-slate-400 border-transparent hover:text-slate-200'
                }`}
              >
                {panel.icon}
                <span>{panel.title}</span>
              </button>
            );
          })}
        </div>

        {/* Tab Content */}
        <div className="p-3 max-h-[60vh] overflow-y-auto custom-scrollbar">
          {panels.map(panel => {
            const isActive = (activeTabId || panels[0]?.id) === panel.id;
            if (!isActive) return null;
            return (
              <div key={panel.id} className="relative">
                <div className="flex justify-between items-center pb-2 mb-2 border-b border-slate-800">
                  <span className="text-xs font-mono font-bold text-slate-300 uppercase">{panel.title}</span>
                  <button
                    onClick={() => onClosePanel(panel.id)}
                    className="text-slate-400 hover:text-red-400 text-xs font-bold px-2 py-0.5 rounded bg-slate-800/60"
                  >
                    Close
                  </button>
                </div>
                {panel.content}
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
};
