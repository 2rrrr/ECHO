// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { applyThemeMode, readThemeMode, updateThemeMode, watchSystemThemeMode } from './themePreferences';

afterEach(() => {
  window.localStorage.clear();
  delete document.documentElement.dataset.theme;
  delete document.documentElement.dataset.themeMode;
  document.documentElement.style.colorScheme = '';
  vi.restoreAllMocks();
});

describe('theme preferences', () => {
  it('applies and caches explicit theme modes', () => {
    updateThemeMode('dark');

    expect(readThemeMode()).toBe('dark');
    expect(document.documentElement.dataset.themeMode).toBe('dark');
    expect(document.documentElement.dataset.theme).toBe('dark');

    updateThemeMode('light');

    expect(readThemeMode()).toBe('light');
    expect(document.documentElement.dataset.themeMode).toBe('light');
    expect(document.documentElement.dataset.theme).toBe('light');
  });

  it('resolves system theme mode from matchMedia and updates on system changes', () => {
    let matches = false;
    const changeListeners: Array<() => void> = [];
    const mediaQuery = {
      get matches() {
        return matches;
      },
      media: '(prefers-color-scheme: dark)',
      onchange: null,
      addEventListener: vi.fn((_event: 'change', listener: () => void) => {
        changeListeners.push(listener);
      }),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    } as unknown as MediaQueryList;

    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: vi.fn(() => mediaQuery),
    });

    updateThemeMode('system');
    expect(document.documentElement.dataset.themeMode).toBe('system');
    expect(document.documentElement.dataset.theme).toBe('light');

    const stopWatching = watchSystemThemeMode(() => 'system');
    matches = true;
    expect(changeListeners).toHaveLength(1);
    changeListeners[0]();

    expect(document.documentElement.dataset.themeMode).toBe('system');
    expect(document.documentElement.dataset.theme).toBe('dark');

    stopWatching();
    expect(mediaQuery.removeEventListener).toHaveBeenCalledWith('change', expect.any(Function));
  });

  it('falls back to light for invalid theme values', () => {
    applyThemeMode('sepia' as never);

    expect(document.documentElement.dataset.themeMode).toBe('light');
    expect(document.documentElement.dataset.theme).toBe('light');
  });
});
