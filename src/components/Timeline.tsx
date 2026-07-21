import { useEffect, useState } from 'react';
import { Play, Pause, ChevronLeft, ChevronRight } from 'lucide-react';
import { stormTrack } from '../mockData';

interface TimelineProps {
  timeOffset: number;
  onChangeTimeOffset: (offset: number) => void;
}

export default function Timeline({ timeOffset, onChangeTimeOffset }: TimelineProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1); // 1x, 2x, 4x

  // Timeline markers corresponding to stormTrack points
  const timelineSteps = stormTrack.map(s => ({
    offset: s.timeOffset,
    label: s.label
  })).sort((a, b) => a.offset - b.offset);

  // Playback timer
  useEffect(() => {
    let interval: any;
    if (isPlaying) {
      interval = setInterval(() => {
        const currentIndex = timelineSteps.findIndex(s => s.offset === timeOffset);
        let nextOffset = timelineSteps[0].offset;
        if (currentIndex !== -1 && currentIndex < timelineSteps.length - 1) {
          nextOffset = timelineSteps[currentIndex + 1].offset;
        }
        onChangeTimeOffset(nextOffset);
      }, 2500 / playbackSpeed);
    }
    return () => clearInterval(interval);
  }, [isPlaying, playbackSpeed, timelineSteps, timeOffset, onChangeTimeOffset]);

  const handlePrevStep = () => {
    const currentIndex = timelineSteps.findIndex(s => s.offset === timeOffset);
    if (currentIndex > 0) {
      onChangeTimeOffset(timelineSteps[currentIndex - 1].offset);
    } else {
      onChangeTimeOffset(timelineSteps[timelineSteps.length - 1].offset);
    }
  };

  const handleNextStep = () => {
    const currentIndex = timelineSteps.findIndex(s => s.offset === timeOffset);
    if (currentIndex < timelineSteps.length - 1) {
      onChangeTimeOffset(timelineSteps[currentIndex + 1].offset);
    } else {
      onChangeTimeOffset(timelineSteps[0].offset);
    }
  };

  const getPositionPercentage = (offset: number) => {
    const min = timelineSteps[0].offset;
    const max = timelineSteps[timelineSteps.length - 1].offset;
    // Map -24 to 24 range to 0% to 100%
    return ((offset - min) / (max - min)) * 100;
  };

  const activeStep = timelineSteps.find(s => s.offset === timeOffset) || { label: `+${timeOffset}h` };

  return (
    <div className="glass-panel w-full rounded-2xl p-4 shadow-2xl border border-slate-700/40 text-slate-100 flex flex-col md:flex-row items-center gap-5">
      {/* Controls: Play/Pause/Prev/Next */}
      <div className="flex items-center gap-2">
        <button
          onClick={handlePrevStep}
          className="p-2 rounded-lg bg-slate-800/60 border border-slate-700 hover:bg-slate-700/60 text-slate-300 hover:text-white transition-all"
          title="Previous Step"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        <button
          onClick={() => setIsPlaying(!isPlaying)}
          className={`p-3 rounded-full border transition-all duration-300 flex items-center justify-center ${
            isPlaying 
              ? 'bg-sky-500 hover:bg-sky-600 border-sky-400 text-slate-950 scale-105 shadow-lg shadow-sky-500/20' 
              : 'bg-slate-800 border-slate-700 text-sky-400 hover:text-sky-300 hover:bg-slate-700'
          }`}
          title={isPlaying ? "Pause Simulation" : "Play Simulation"}
        >
          {isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current ml-0.5" />}
        </button>

        <button
          onClick={handleNextStep}
          className="p-2 rounded-lg bg-slate-800/60 border border-slate-700 hover:bg-slate-700/60 text-slate-300 hover:text-white transition-all"
          title="Next Step"
        >
          <ChevronRight className="w-4 h-4" />
        </button>

        {/* Speed Multiplier */}
        <button
          onClick={() => setPlaybackSpeed(prev => prev === 1 ? 2 : prev === 2 ? 4 : 1)}
          className="ml-1 px-2.5 py-1.5 rounded-lg bg-slate-800/60 border border-slate-700 text-[10px] font-bold text-sky-400 hover:bg-slate-700/60 transition-all font-mono min-w-[42px]"
          title="Adjust Playback Speed"
        >
          {playbackSpeed}x
        </button>
      </div>

      {/* Main Slider Track */}
      <div className="flex-1 w-full flex flex-col gap-2.5">
        <div className="relative h-2.5 bg-slate-800/80 rounded-full border border-slate-700/30">
          
          {/* Custom colored storm risk background track inside the slider! */}
          <div 
            className="absolute top-0 bottom-0 left-[50%] right-0 bg-gradient-to-r from-yellow-500/20 via-orange-500/25 to-red-600/35 rounded-r-full"
            style={{ width: '50%' }}
          />

          {/* Active progress bar */}
          <div 
            className="absolute top-0 bottom-0 left-0 bg-sky-500/30 rounded-full transition-all duration-300"
            style={{ width: `${getPositionPercentage(timeOffset)}%` }}
          />

          {/* Markers */}
          {timelineSteps.map((step) => {
            const pct = getPositionPercentage(step.offset);
            const isCurrent = step.offset === timeOffset;
            return (
              <div 
                key={step.offset} 
                className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 cursor-pointer flex flex-col items-center"
                style={{ left: `${pct}%` }}
                onClick={() => {
                  onChangeTimeOffset(step.offset);
                  setIsPlaying(false);
                }}
              >
                <div className={`w-2.5 h-2.5 rounded-full border border-slate-950 transition-all duration-200 ${
                  isCurrent 
                    ? 'bg-sky-400 scale-125 ring-2 ring-sky-500/40' 
                    : step.offset === 0
                      ? 'bg-slate-200 border-white'
                      : 'bg-slate-600 hover:bg-slate-400'
                }`} />
              </div>
            );
          })}
        </div>

        {/* Labels under track */}
        <div className="relative h-7 text-[9px] text-slate-400 font-medium font-mono mt-1">
          {timelineSteps.map((step, index) => {
            const pct = getPositionPercentage(step.offset);
            const isCurrent = step.offset === timeOffset;
            return (
              <button
                key={step.offset}
                onClick={() => {
                  onChangeTimeOffset(step.offset);
                  setIsPlaying(false);
                }}
                className={`absolute -translate-x-1/2 hover:text-slate-200 transition-colors uppercase whitespace-nowrap ${
                  isCurrent ? 'text-sky-400 font-bold scale-105 z-10' : ''
                }`}
                style={{ 
                  left: `${pct}%`,
                  top: index % 2 === 0 ? '0px' : '14px'
                }}
              >
                {step.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Info bubble */}
      <div className="flex items-center gap-3 px-4 py-2 bg-slate-950/40 border border-slate-800 rounded-xl min-w-[210px] justify-between">
        <div className="flex flex-col">
          <span className="text-[10px] text-slate-500 uppercase tracking-widest font-mono">Simulation Hour</span>
          <span className="text-sm font-extrabold text-sky-300 font-mono tracking-wide">{activeStep.label}</span>
        </div>
        <div className="h-8 w-px bg-slate-800" />
        <div className="flex flex-col items-end">
          <span className="text-[10px] text-slate-500 uppercase tracking-widest font-mono">Central Pressure</span>
          <span className="text-sm font-extrabold text-purple-400 font-mono">
            {stormTrack.find(s => s.timeOffset === timeOffset)?.pressure || 925} hPa
          </span>
        </div>
      </div>
    </div>
  );
}
