import '@/assets/theme.css';
import { initTheme } from '@/lib/theme';
import { mount } from 'svelte';
import App from './App.svelte';

void initTheme().then(() => {
  mount(App, { target: document.getElementById('app')! });
});
