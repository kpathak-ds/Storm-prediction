import React, { createContext, useContext, useState, useEffect } from 'react';
import type { UserPreferences, FavoriteLocation, RecentLocation } from '../types/settings';

const DEFAULT_PREFERENCES: UserPreferences = {
  tempUnit: 'C',
  speedUnit: 'kmh',
  pressureUnit: 'hPa',
  distanceUnit: 'km',
  theme: 'dark',
  language: 'en',
  defaultCityId: 'mumbai',
  autoRefreshIntervalMinutes: 5,
  enableNotifications: true,
};

interface SettingsContextType {
  preferences: UserPreferences;
  updatePreferences: (newPrefs: Partial<UserPreferences>) => void;
  favorites: FavoriteLocation[];
  addFavorite: (fav: Omit<FavoriteLocation, 'addedAt'>) => void;
  removeFavorite: (id: string) => void;
  isFavorite: (id: string) => boolean;
  recents: RecentLocation[];
  addRecent: (recent: Omit<RecentLocation, 'viewedAt'>) => void;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

const PREFS_KEY = 'aerotempest_user_preferences';
const FAVS_KEY = 'aerotempest_favorites';
const RECENTS_KEY = 'aerotempest_recents';

export const SettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [preferences, setPreferences] = useState<UserPreferences>(() => {
    try {
      const saved = localStorage.getItem(PREFS_KEY);
      return saved ? { ...DEFAULT_PREFERENCES, ...JSON.parse(saved) } : DEFAULT_PREFERENCES;
    } catch {
      return DEFAULT_PREFERENCES;
    }
  });

  const [favorites, setFavorites] = useState<FavoriteLocation[]>(() => {
    try {
      const saved = localStorage.getItem(FAVS_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [recents, setRecents] = useState<RecentLocation[]>(() => {
    try {
      const saved = localStorage.getItem(RECENTS_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem(PREFS_KEY, JSON.stringify(preferences));
  }, [preferences]);

  useEffect(() => {
    localStorage.setItem(FAVS_KEY, JSON.stringify(favorites));
  }, [favorites]);

  useEffect(() => {
    localStorage.setItem(RECENTS_KEY, JSON.stringify(recents));
  }, [recents]);

  const updatePreferences = (newPrefs: Partial<UserPreferences>) => {
    setPreferences(prev => ({ ...prev, ...newPrefs }));
  };

  const addFavorite = (fav: Omit<FavoriteLocation, 'addedAt'>) => {
    setFavorites(prev => {
      if (prev.some(f => f.id === fav.id)) return prev;
      return [...prev, { ...fav, addedAt: new Date().toISOString() }];
    });
  };

  const removeFavorite = (id: string) => {
    setFavorites(prev => prev.filter(f => f.id !== id));
  };

  const isFavorite = (id: string) => favorites.some(f => f.id === id);

  const addRecent = (recent: Omit<RecentLocation, 'viewedAt'>) => {
    setRecents(prev => {
      const filtered = prev.filter(r => r.id !== recent.id);
      return [{ ...recent, viewedAt: new Date().toISOString() }, ...filtered].slice(0, 10);
    });
  };

  return (
    <SettingsContext.Provider
      value={{
        preferences,
        updatePreferences,
        favorites,
        addFavorite,
        removeFavorite,
        isFavorite,
        recents,
        addRecent,
      }}
    >
      {children}
    </SettingsContext.Provider>
  );
};

export const useSettings = () => {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
};
