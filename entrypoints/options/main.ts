import '@/assets/theme.css';
import { initTheme } from '@/lib/theme';
import { initI18n } from '@/lib/i18n';
import { mount } from 'svelte';
import App from './App.svelte';

void Promise.all([initTheme(), initI18n()]).then(() => {
  mount(App, { target: document.getElementById('app')! });
});
