import { useState, useRef, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react';
import { getClimatologicalForecastSync } from '../api/historicalData';
import { stormModel } from '../api/aiModel';

interface CustomDatePickerProps {
  value: string; // YYYY-MM-DD format
  onChange: (val: string) => void;
  min?: string;  // YYYY-MM-DD format
  max?: string;  // YYYY-MM-DD format
  placeholder?: string;
  className?: string;
}

const MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
];

const WEEK_DAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

export default function CustomDatePicker({ value, onChange, min, max, placeholder = 'Select date', className = '' }: CustomDatePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'days' | 'years'>('days');
  const containerRef = useRef<HTMLDivElement>(null);
  const yearListRef = useRef<HTMLDivElement>(null);

  const getDayRiskColor = (day: number, month: number) => {
    const record = getClimatologicalForecastSync(month + 1, day);
    if (!record) return null;
    const pred = stormModel.predict([
      record.temp,
      record.humidity,
      record.pressure,
      record.windSpeed,
      record.rainfall
    ]);
    if (pred.riskLevel === 'EXTREME') return 'bg-red-500';
    if (pred.riskLevel === 'HIGH') return 'bg-orange-500';
    if (pred.riskLevel === 'MEDIUM') return 'bg-yellow-500';
    return 'bg-emerald-500';
  };

  // Default view to selected date, or today
  const initialDate = value ? new Date(value) : new Date();
  const [viewYear, setViewYear] = useState(initialDate.getFullYear());
  const [viewMonth, setViewMonth] = useState(initialDate.getMonth()); // 0-11

  // Keep view in sync when value changes externally
  useEffect(() => {
    if (value) {
      const d = new Date(value);
      if (!isNaN(d.getTime())) {
        setViewYear(d.getFullYear());
        setViewMonth(d.getMonth());
      }
    }
  }, [value]);

  // Scroll active year into view when viewMode changes to 'years'
  useEffect(() => {
    if (viewMode === 'years' && yearListRef.current) {
      const activeBtn = yearListRef.current.querySelector('[data-active="true"]');
      if (activeBtn) {
        activeBtn.scrollIntoView({ block: 'center', behavior: 'auto' });
      }
    }
  }, [viewMode]);

  // Click outside handler
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setViewMode('days');
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const firstDayIndex = new Date(viewYear, viewMonth, 1).getDay(); // 0 = Sunday

  // Days from previous month for padding
  const prevMonthDaysCount = firstDayIndex;
  const daysInPrevMonth = new Date(viewYear, viewMonth, 0).getDate();

  const handlePrevMonth = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear(viewYear - 1);
    } else {
      setViewMonth(viewMonth - 1);
    }
  };

  const handleNextMonth = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear(viewYear + 1);
    } else {
      setViewMonth(viewMonth + 1);
    }
  };

  const handleSelectDay = (day: number, isCurrentMonth = true) => {
    let targetYear = viewYear;
    let targetMonth = viewMonth;

    if (!isCurrentMonth) {
      if (day > 15) {
        // Clicked prev month day
        if (viewMonth === 0) {
          targetMonth = 11;
          targetYear = viewYear - 1;
        } else {
          targetMonth = viewMonth - 1;
        }
      } else {
        // Clicked next month day
        if (viewMonth === 11) {
          targetMonth = 0;
          targetYear = viewYear + 1;
        } else {
          targetMonth = viewMonth + 1;
        }
      }
    }

    const pad = (n: number) => n.toString().padStart(2, '0');
    const dateString = `${targetYear}-${pad(targetMonth + 1)}-${pad(day)}`;

    // Validate min/max limits
    if (min && dateString < min) return;
    if (max && dateString > max) return;

    onChange(dateString);
    setIsOpen(false); // Instantly close the calendar popup
    setViewMode('days');
  };

  // Check if a specific date is active/selected
  const isSelected = (day: number) => {
    if (!value) return false;
    const d = new Date(value);
    return d.getFullYear() === viewYear && d.getMonth() === viewMonth && d.getDate() === day;
  };

  // Format date for display: DD/MM/YYYY
  const getDisplayDate = () => {
    if (!value) return placeholder;
    const parts = value.split('-');
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return value;
  };

  // Generate calendar days
  const cells: { day: number; currentMonth: boolean }[] = [];

  // Prev month padding cells
  for (let i = prevMonthDaysCount - 1; i >= 0; i--) {
    cells.push({ day: daysInPrevMonth - i, currentMonth: false });
  }

  // Current month cells
  for (let i = 1; i <= daysInMonth; i++) {
    cells.push({ day: i, currentMonth: true });
  }

  // Next month padding cells to complete the 6 rows (42 cells)
  const remaining = 42 - cells.length;
  for (let i = 1; i <= remaining; i++) {
    cells.push({ day: i, currentMonth: false });
  }

  return (
    <div ref={containerRef} className={`relative select-none ${className}`}>
      {/* Date Input Box */}
      <div 
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 bg-slate-900/50 border border-slate-700/60 rounded text-xs text-white px-2 py-1 outline-none hover:border-sky-500 cursor-pointer w-full transition-all font-mono"
      >
        <Calendar className="w-3.5 h-3.5 text-sky-400 shrink-0" />
        <span className="flex-1">{getDisplayDate()}</span>
      </div>

      {/* Calendar Dropdown UI */}
      {isOpen && (
        <div className="absolute top-[105%] left-0 z-50 bg-[#0f121d] border border-slate-700/80 rounded-xl shadow-2xl p-3 w-[230px] flex flex-col gap-2.5 animate-in fade-in slide-in-from-top-1 duration-150">
          
          {/* Calendar Header */}
          <div className="flex items-center justify-between px-1 gap-1">
            <div className="flex items-center gap-1">
              <select
                value={viewMonth}
                onChange={(e) => setViewMonth(parseInt(e.target.value, 10))}
                className="bg-slate-900 border border-slate-700/60 rounded text-[10px] text-white px-1 py-0.5 outline-none focus:border-sky-500 font-bold font-mono cursor-pointer"
              >
                {MONTH_NAMES.map((name, idx) => (
                  <option key={name} value={idx}>{name}</option>
                ))}
              </select>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setViewMode(viewMode === 'days' ? 'years' : 'days');
                }}
                className={`bg-slate-900 hover:bg-slate-800 border rounded text-[10px] text-white px-2 py-0.5 outline-none font-bold font-mono transition-all ${
                  viewMode === 'years' ? 'border-sky-500 text-sky-400' : 'border-slate-700/60'
                }`}
              >
                {viewYear}
              </button>
            </div>
            
            <div className="flex items-center gap-0.5">
              <button 
                onClick={handlePrevMonth}
                className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <button 
                onClick={handleNextMonth}
                className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {viewMode === 'days' ? (
            <>
              {/* Weekday Labels */}
              <div className="grid grid-cols-7 text-center text-[10px] font-black text-slate-500 font-mono">
                {WEEK_DAYS.map(day => (
                  <span key={day} className="w-7 py-0.5">{day}</span>
                ))}
              </div>

              {/* Days Grid */}
              <div className="grid grid-cols-7 gap-y-0.5 gap-x-0.5">
                {cells.map((cell, idx) => {
                  const pad = (n: number) => n.toString().padStart(2, '0');
                  let cellYear = viewYear;
                  let cellMonth = viewMonth;
                  if (!cell.currentMonth) {
                    if (cell.day > 15) {
                      cellMonth = viewMonth === 0 ? 11 : viewMonth - 1;
                      cellYear = viewMonth === 0 ? viewYear - 1 : viewYear;
                    } else {
                      cellMonth = viewMonth === 11 ? 0 : viewMonth + 1;
                      cellYear = viewMonth === 11 ? viewYear + 1 : viewYear;
                    }
                  }
                  const cellDateStr = `${cellYear}-${pad(cellMonth + 1)}-${pad(cell.day)}`;
                  
                  const isBeforeMin = min && cellDateStr < min;
                  const isAfterMax = max && cellDateStr > max;
                  const isDisabled = isBeforeMin || isAfterMax;

                  const active = cell.currentMonth && isSelected(cell.day);

                  const dotColor = getDayRiskColor(cell.day, cellMonth);

                  return (
                    <button
                      key={idx}
                      disabled={!!isDisabled}
                      onClick={() => handleSelectDay(cell.day, cell.currentMonth)}
                      className={`w-7 h-7 flex flex-col items-center justify-center rounded text-[10px] font-bold font-mono transition-all relative ${
                        active 
                          ? 'bg-sky-500 text-slate-950 font-black shadow-lg shadow-sky-500/20' 
                          : !cell.currentMonth 
                            ? 'text-slate-700 hover:text-slate-500 hover:bg-slate-800/10' 
                            : isDisabled
                              ? 'text-slate-800 cursor-not-allowed line-through'
                              : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                      }`}
                      title={dotColor ? 'CSV-Trained Storm Risk Indicator' : undefined}
                    >
                      <span className={dotColor ? 'mt-[-3px]' : ''}>{cell.day}</span>
                      {dotColor && (
                        <span className={`w-1 h-1 rounded-full absolute bottom-1 ${dotColor}`} />
                      )}
                    </button>
                  );
                })}
              </div>
            </>
          ) : (
            /* Custom Year Selection Grid */
            <div 
              ref={yearListRef} 
              className="max-h-[175px] overflow-y-auto grid grid-cols-4 gap-1 p-1 scrollbar-thin"
            >
              {Array.from({ length: 71 }, (_, i) => 1980 + i).map((y) => {
                const isSelectedYear = y === viewYear;
                return (
                  <button
                    key={y}
                    data-active={isSelectedYear ? 'true' : 'false'}
                    onClick={() => {
                      setViewYear(y);
                      setViewMode('days');
                    }}
                    className={`py-1.5 rounded text-[10px] font-bold font-mono transition-all ${
                      isSelectedYear
                        ? 'bg-sky-500 text-slate-950 font-black shadow-md shadow-sky-500/20'
                        : 'text-slate-300 hover:bg-slate-850 hover:text-white bg-slate-900/30'
                    }`}
                  >
                    {y}
                  </button>
                );
              })}
            </div>
          )}

        </div>
      )}
    </div>
  );
}
