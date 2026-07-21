import { useState } from 'react';
import CustomDatePicker from './CustomDatePicker';

interface DateSelectorProps {
  onDateChange: (date1: string, date2: string | null) => void;
}

export default function DateSelector({ onDateChange }: DateSelectorProps) {
  // Default to today
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);

  const handleFetch = () => {
    onDateChange(date, null);
  };

  return (
    <div className="glass-panel rounded-xl shadow-xl border border-slate-700/40 p-2.5 flex flex-col gap-2 pointer-events-auto">
      <div className="w-full">
        <CustomDatePicker 
          value={date} 
          onChange={setDate}
        />
      </div>
      
      <button 
        onClick={handleFetch}
        className="text-[10px] font-bold py-1.5 px-2 rounded w-full transition-colors flex items-center justify-center gap-1.5 bg-sky-500/10 text-sky-400 hover:bg-sky-500/20 border border-sky-500/20"
      >
        <span>view historic data</span>
      </button>
    </div>
  );
}
