import { AlertTriangle, ShieldAlert, Info, X } from 'lucide-react';
import type { SevereAlert } from '../../services/alertService';

interface AlertNotificationCenterProps {
  alerts: SevereAlert[];
  isOpen: boolean;
  onClose: () => void;
}

export const AlertNotificationCenter: React.FC<AlertNotificationCenterProps> = ({
  alerts,
  isOpen,
  onClose,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed top-16 right-5 z-50 w-96 max-w-[90vw] bg-slate-950/90 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden backdrop-blur-xl animate-in slide-in-from-top duration-200">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800 bg-slate-900/60">
        <div className="flex items-center gap-2">
          <ShieldAlert className="w-5 h-5 text-red-400 animate-pulse" />
          <h3 className="text-xs font-bold text-slate-100 uppercase tracking-wide font-mono">
            Active Hazard Warnings ({alerts.length})
          </h3>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Alert List */}
      <div className="p-3 flex flex-col gap-2.5 max-h-[60vh] overflow-y-auto custom-scrollbar">
        {alerts.length === 0 ? (
          <div className="p-4 text-center text-xs text-slate-400 font-mono flex flex-col items-center gap-2">
            <Info className="w-6 h-6 text-emerald-400" />
            <span>No critical weather warnings active for this target area.</span>
          </div>
        ) : (
          alerts.map(alert => (
            <div
              key={alert.id}
              className={`p-3 rounded-xl border flex flex-col gap-1 text-xs transition-all ${
                alert.severity === 'CRITICAL'
                  ? 'bg-red-500/10 border-red-500/30 text-red-300'
                  : alert.severity === 'WARNING'
                  ? 'bg-orange-500/10 border-orange-500/30 text-orange-300'
                  : 'bg-yellow-500/10 border-yellow-500/30 text-yellow-300'
              }`}
            >
              <div className="flex items-center justify-between font-bold">
                <span className="flex items-center gap-1.5 font-mono">
                  {alert.severity === 'CRITICAL' ? (
                    <ShieldAlert className="w-4 h-4 text-red-400 shrink-0" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-orange-400 shrink-0" />
                  )}
                  {alert.title}
                </span>
                <span className="text-[9px] px-2 py-0.5 rounded-full border uppercase font-mono bg-slate-900/80">
                  {alert.severity}
                </span>
              </div>
              <p className="text-[11px] leading-relaxed opacity-90">{alert.description}</p>
              <span className="text-[9px] text-slate-400 font-mono self-end">
                {new Date(alert.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
