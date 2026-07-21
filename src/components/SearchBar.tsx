import { useState, useRef, useEffect } from 'react';
import { Search, MapPin, Navigation, Info } from 'lucide-react';
import { cities } from '../mockData';

interface SearchBarProps {
  onSearchSelect: (item: any) => void;
}

export default function SearchBar({ onSearchSelect }: SearchBarProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filter cities and fetch global locations as query changes
  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }

    const q = query.toLowerCase().trim();

    // Check if query is latitude/longitude coordinate pair
    const coordRegex = /^[-+]?([1-9]?\d(\.\d+)?|90(\.0+)?)\s*[, ]\s*[-+]?(180(\.0+)?|((1[0-7]\d)|([1-9]?\d))(\.\d+)?)$/;
    if (coordRegex.test(query)) {
      const parts = query.split(/[\s,]+/).map(Number);
      if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
        setResults([
          {
            type: 'coordinate',
            name: `Coordinate: ${parts[0].toFixed(3)}°N, ${parts[1].toFixed(3)}°E`,
            lat: parts[0],
            lng: parts[1],
            zoom: 8.5
          }
        ]);
        return;
      }
    }

    const fetchGlobalSearch = async () => {
      try {
        const response = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=5`);
        const data = await response.json();
        
        let geocodeResults: any[] = [];
        if (data.results) {
          geocodeResults = data.results.map((item: any) => ({
            type: 'city',
            id: `global-${item.id}`,
            name: `${item.name}, ${item.admin1 || ''}`,
            country: item.country || '',
            lat: item.latitude,
            lng: item.longitude,
            zoom: 8.0,
            originalName: item.name,
            originalState: item.admin1 || item.country || ''
          }));
        }

        // Also search existing predefined cities
        const matchedCities = cities
          .filter(city => 
            city.name.toLowerCase().includes(q) || 
            city.state.toLowerCase().includes(q) ||
            city.country.toLowerCase().includes(q)
          )
          .map(city => ({
            type: 'city',
            id: city.id,
            name: `${city.name}, ${city.state}`,
            country: city.country,
            lat: city.coord.lat,
            lng: city.coord.lng,
            zoom: 7.5,
            originalName: city.name,
            originalState: city.state
          }));

        // Combine local and global, avoiding exact duplicates by ID or name
        const combined = [...matchedCities];
        for (const gc of geocodeResults) {
          if (!combined.find(c => c.originalName.toLowerCase() === gc.originalName.toLowerCase())) {
            combined.push(gc);
          }
        }
        setResults(combined);
      } catch (err) {
        console.error("Geocoding API error", err);
      }
    };

    // Debounce the fetch slightly
    const timer = setTimeout(() => {
      fetchGlobalSearch();
    }, 400);

    return () => clearTimeout(timer);
  }, [query]);

  const handleSelect = (item: any) => {
    onSearchSelect(item);
    setQuery(item.type === 'coordinate' ? `${item.lat.toFixed(4)}, ${item.lng.toFixed(4)}` : item.name);
    setShowDropdown(false);
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (results.length > 0) {
      handleSelect(results[0]);
    }
  };

  return (
    <div className="relative w-full max-w-sm" ref={dropdownRef}>
      <form onSubmit={handleFormSubmit} className="relative z-30">
        <div className="glass-panel rounded-xl shadow-xl border border-slate-700/40 flex items-center px-3.5 py-2.5 gap-2.5">
          <Search className="w-4 h-4 text-slate-400 shrink-0" />
          <input
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setShowDropdown(true);
            }}
            onFocus={() => setShowDropdown(true)}
            placeholder="Search City, District, or Lat, Lng..."
            className="bg-transparent border-none outline-none text-xs text-slate-100 placeholder-slate-400 w-full font-medium"
          />
          {query && (
            <button
              type="button"
              onClick={() => {
                setQuery('');
                setResults([]);
              }}
              className="text-[10px] text-slate-500 hover:text-slate-300 font-bold px-1.5 py-0.5 rounded bg-slate-800"
            >
              Clear
            </button>
          )}
        </div>
      </form>

      {/* Dropdown Results */}
      {showDropdown && (results.length > 0 || query.trim().length > 0) && (
        <div className="absolute top-[52px] left-0 right-0 bg-[#0c0e17] rounded-xl shadow-2xl border border-slate-700/50 p-2 z-50 max-h-60 overflow-y-auto animate-in fade-in slide-in-from-top-4 duration-150">
          {results.length > 0 ? (
            <div className="flex flex-col gap-1">
              {results.map((item, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSelect(item)}
                  className="flex items-center gap-3 w-full px-3 py-2 rounded-lg text-left hover:bg-slate-800/80 transition-colors"
                >
                  {item.type === 'coordinate' ? (
                    <Navigation className="w-4 h-4 text-sky-400 shrink-0 rotate-45" />
                  ) : (
                    <MapPin className="w-4 h-4 text-emerald-400 shrink-0" />
                  )}
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-slate-200">{item.name}</span>
                    {item.country && (
                      <span className="text-[10px] text-slate-400 font-semibold">{item.country}</span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="flex items-start gap-2.5 p-3 text-slate-400">
              <Info className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
              <div className="flex flex-col gap-1">
                <span className="text-xs font-semibold">No locations found</span>
                <span className="text-[10px] text-slate-500 leading-normal">
                  Try typing "Taipei", "Manila", "Okinawa", or exact coordinate pairs like "22.62, 120.30".
                </span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
