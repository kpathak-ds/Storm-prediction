import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Minimize2, Maximize2, X } from 'lucide-react';

interface DockPanelProps {
  id: string;
  title: string;
  icon?: React.ReactNode;
  onClose: () => void;
  children: React.ReactNode;
  width?: string; // e.g. "w-80" or "w-96"
}

export const DockPanel: React.FC<DockPanelProps> = ({
  title,
  icon,
  onClose,
  children,
  width = 'w-80 md:w-96',
}) => {
  const [isMinimized, setIsMinimized] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: -25, scale: 0.96 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: -25, scale: 0.96 }}
      transition={{ duration: 0.22, ease: 'easeOut' }}
      className={`relative flex flex-col glass-panel rounded-2xl border border-slate-700/60 shadow-2xl overflow-hidden pointer-events-auto shrink-0 transition-all duration-300 ${
        isExpanded ? 'w-[480px] max-w-[90vw]' : width
      } ${isMinimized ? 'h-14' : 'max-h-[calc(100vh-180px)]'}`}
    >
      {/* Panel Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800 bg-slate-950/70 select-none shrink-0">
        <div className="flex items-center gap-2.5 overflow-hidden">
          {icon && <span className="text-sky-400 shrink-0">{icon}</span>}
          <h2 className="text-xs font-bold text-slate-100 truncate tracking-wide uppercase font-mono">
            {title}
          </h2>
        </div>

        {/* Header Controls */}
        <div className="flex items-center gap-1.5 shrink-0">
          {/* Minimize / Restore */}
          <button
            onClick={() => setIsMinimized(!isMinimized)}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            title={isMinimized ? 'Restore Panel' : 'Minimize Panel'}
          >
            <Minimize2 className="w-3.5 h-3.5" />
          </button>

          {/* Expand Width Toggle */}
          {!isMinimized && (
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors hidden sm:block"
              title={isExpanded ? 'Normal Width' : 'Expand Width'}
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
          )}

          {/* Close Panel */}
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
            title="Close Panel"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Panel Body */}
      <AnimatePresence initial={false}>
        {!isMinimized && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="flex-1 overflow-y-auto overflow-x-hidden p-3 custom-scrollbar"
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};
