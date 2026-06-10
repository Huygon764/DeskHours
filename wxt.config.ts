import { defineConfig } from 'wxt';

export default defineConfig({
  modules: ['@wxt-dev/module-svelte'],
  manifest: {
    name: 'Site Blocker',
    description: 'Block distracting sites on a schedule, with a Pomodoro timer',
    default_locale: 'en',
    permissions: [
      'storage',
      'alarms',
      'declarativeNetRequest',
      'declarativeNetRequestWithHostAccess',
      'offscreen',
      'notifications',
      'tabs',
    ],
    host_permissions: ['<all_urls>'],
    web_accessible_resources: [
      {
        resources: ['blocked.html'],
        matches: ['<all_urls>'],
        use_dynamic_url: true,
      },
    ],
  },
});
