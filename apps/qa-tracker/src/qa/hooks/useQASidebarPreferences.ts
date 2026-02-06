import { useState, useCallback } from 'react';

export interface QASidebarPreferences {
  isCollapsed: boolean;
  widthPercent: 20 | 30 | 40;
}

const STORAGE_KEY = 'qa-sidebar-preferences';

const defaultPreferences: QASidebarPreferences = {
  isCollapsed: false,
  widthPercent: 20,
};

function loadPreferences(): QASidebarPreferences {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      return { ...defaultPreferences, ...parsed };
    }
  } catch {
    // Ignore localStorage errors
  }
  return defaultPreferences;
}

function savePreferences(prefs: QASidebarPreferences): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // Ignore localStorage errors
  }
}

export function useQASidebarPreferences() {
  const [preferences, setPreferences] = useState<QASidebarPreferences>(loadPreferences);

  const update = useCallback((partial: Partial<QASidebarPreferences>) => {
    setPreferences((prev) => {
      const next = { ...prev, ...partial };
      savePreferences(next);
      return next;
    });
  }, []);

  const setCollapsed = useCallback((isCollapsed: boolean) => update({ isCollapsed }), [update]);
  const setWidthPercent = useCallback((widthPercent: 20 | 30 | 40) => update({ widthPercent }), [update]);

  return { preferences, setCollapsed, setWidthPercent };
}
