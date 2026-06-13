import { themeItem } from './storage';

export type ThemePreference = 'system' | 'light' | 'dark';
export type ResolvedTheme = 'light' | 'dark';

const MEDIA = '(prefers-color-scheme: dark)';

export function resolveTheme(preference: ThemePreference): ResolvedTheme {
  if (preference === 'system') {
    return window.matchMedia(MEDIA).matches ? 'dark' : 'light';
  }
  return preference;
}

export function applyTheme(resolved: ResolvedTheme): void {
  document.documentElement.dataset.theme = resolved;
}

/** Load preference, apply theme, and react to system changes when preference is system. */
export async function initTheme(): Promise<void> {
  let preference = await themeItem.getValue();
  applyTheme(resolveTheme(preference));
  window.matchMedia(MEDIA).addEventListener('change', () => {
    if (preference === 'system') applyTheme(resolveTheme('system'));
  });
  themeItem.watch((pref) => {
    preference = pref;
    applyTheme(resolveTheme(pref));
  });
}
