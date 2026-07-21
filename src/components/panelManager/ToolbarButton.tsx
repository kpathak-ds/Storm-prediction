import React from 'react';
import { motion } from 'framer-motion';

interface ToolbarButtonProps {
  id: string;
  label: string;
  icon: React.ReactNode;
  active: boolean;
  onClick: () => void;
  badge?: number | string;
}

export const ToolbarButton: React.FC<ToolbarButtonProps> = ({
  label,
  icon,
  active,
  onClick,
  badge,
}) => {
  return (
    <div className="relative group flex items-center">
      <motion.button
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.94 }}
        onClick={onClick}
        aria-label={label}
        className={`relative p-3 rounded-xl glass-panel shadow-lg border transition-all duration-200 flex items-center justify-center ${
          active
            ? 'bg-slate-900 border-sky-500/60 text-sky-400 shadow-sky-500/20 shadow-md ring-1 ring-sky-500/30'
            : 'text-slate-300 border-slate-700/50 hover:text-white hover:bg-slate-800/80 hover:border-slate-600'
        }`}
      >
        {/* Active side indicator glow bar */}
        {active && (
          <motion.span
            layoutId="activeIndicator"
            className="absolute left-0 top-2 bottom-2 w-1 bg-sky-400 rounded-r-full shadow-[0_0_8px_rgba(56,189,248,0.8)]"
          />
        )}

        {/* Icon */}
        <span className="w-5 h-5 flex items-center justify-center">
          {icon}
        </span>

        {/* Optional Badge */}
        {badge !== undefined && (
          <span className="absolute -top-1 -right-1 bg-purple-600 text-white text-[9px] font-extrabold px-1.5 py-0.5 rounded-full border border-purple-400/40 shadow-sm animate-pulse">
            {badge}
          </span>
        )}
      </motion.button>

      {/* Floating Tooltip (Appears on Hover) */}
      <div className="absolute left-full ml-3 px-2.5 py-1.5 bg-slate-950/90 border border-slate-800 text-slate-200 text-xs font-semibold rounded-lg shadow-xl whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-all duration-150 transform -translate-x-1 group-hover:translate-x-0 z-50 flex items-center gap-1.5">
        <span>{label}</span>
      </div>
    </div>
  );
};
