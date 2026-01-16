import { UserSettings, DEFAULT_SETTINGS } from '@/types/settings';

const SETTINGS_KEY = 'steam-agent-settings';

export function saveSettings(settings: UserSettings): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  }
}

export function loadSettings(): UserSettings {
  if (typeof window === 'undefined') {
    return DEFAULT_SETTINGS;
  }
  
  try {
    const stored = localStorage.getItem(SETTINGS_KEY);
    if (!stored) {
      return DEFAULT_SETTINGS;
    }
    const parsed = JSON.parse(stored) as Partial<UserSettings>;
    return { ...DEFAULT_SETTINGS, ...parsed, includeImages: true };
  } catch (error) {
    console.error('Error loading settings:', error);
    return DEFAULT_SETTINGS;
  }
}

export function resetSettings(): UserSettings {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(SETTINGS_KEY);
  }
  return DEFAULT_SETTINGS;
}
