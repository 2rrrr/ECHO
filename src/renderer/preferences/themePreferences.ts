import type { AppThemeMode } from '../../shared/types/appSettings';
import { getAppBridge } from '../utils/echoBridge';
import { applyAppearancePreferences, readAppearancePreferences } from './appearancePreferences';

export type EffectiveTheme = 'light' | 'dark';

const storageKey = 'echo-next:appearance-theme';
const systemThemeQuery = '(prefers-color-scheme: dark)';
const validThemeModes: AppThemeMode[] = ['light', 'dark', 'system'];

export const defaultThemeMode: AppThemeMode = 'light';

export const normalizeThemeMode = (value: unknown): AppThemeMode =>
  validThemeModes.includes(value as AppThemeMode) ? (value as AppThemeMode) : defaultThemeMode;

export const readThemeMode = (): AppThemeMode => {
  try {
    return normalizeThemeMode(window.localStorage.getItem(storageKey));
  } catch {
    return defaultThemeMode;
  }
};

export const writeThemeMode = (mode: AppThemeMode): AppThemeMode => {
  const normalized = normalizeThemeMode(mode);

  try {
    window.localStorage.setItem(storageKey, normalized);
  } catch {
    return normalized;
  }

  return normalized;
};

export const resolveThemeMode = (mode: AppThemeMode): EffectiveTheme => {
  const normalized = normalizeThemeMode(mode);

  if (normalized === 'dark') {
    return 'dark';
  }

  if (normalized === 'system' && typeof window.matchMedia === 'function') {
    return window.matchMedia(systemThemeQuery).matches ? 'dark' : 'light';
  }

  return 'light';
};

export const applyThemeMode = (mode: AppThemeMode): EffectiveTheme => {
  const normalized = normalizeThemeMode(mode);
  const effectiveTheme = resolveThemeMode(normalized);
  const root = document.documentElement;

  root.dataset.themeMode = normalized;
  root.dataset.theme = effectiveTheme;
  root.style.colorScheme = effectiveTheme;
  applyAppearancePreferences(readAppearancePreferences());

  return effectiveTheme;
};

export const updateThemeMode = (mode: AppThemeMode): AppThemeMode => {
  const normalized = writeThemeMode(mode);
  applyThemeMode(normalized);
  return normalized;
};

export const loadPersistedThemeMode = async (): Promise<AppThemeMode> => {
  const appBridge = getAppBridge();

  if (!appBridge) {
    const localThemeMode = readThemeMode();
    applyThemeMode(localThemeMode);
    return localThemeMode;
  }

  const settings = await appBridge.getSettings();
  const themeMode = updateThemeMode(settings.appearanceTheme ?? defaultThemeMode);
  return themeMode;
};

export const watchSystemThemeMode = (getThemeMode: () => AppThemeMode = readThemeMode): (() => void) => {
  if (typeof window.matchMedia !== 'function') {
    return () => undefined;
  }

  const mediaQuery = window.matchMedia(systemThemeQuery);
  const handleChange = (): void => {
    applyThemeMode(getThemeMode());
  };

  if (typeof mediaQuery.addEventListener === 'function') {
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }

  mediaQuery.addListener(handleChange);
  return () => mediaQuery.removeListener(handleChange);
};
