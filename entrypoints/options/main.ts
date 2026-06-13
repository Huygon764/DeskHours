import '@/assets/theme.css';
import { initTheme } from '@/lib/theme';
import { initI18n } from '@/lib/i18n';
import { mount } from 'svelte';
import App from './App.svelte';

// Preload theme + locale, but never let a failed preload block the UI: t() falls
// back to browser messages and theme.css ships default vars.
void Promise.all([initTheme(), initI18n()])
  .catch((err) => console.error('[deskhours] init failed:', err))
  .finally(() => {
    mount(App, { target: document.getElementById('app')! });
  });
