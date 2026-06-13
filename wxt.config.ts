import { defineConfig } from 'wxt';

export default defineConfig({
  modules: ['@wxt-dev/module-svelte'],
  manifest: {
    name: '__MSG_extName__',
    description: '__MSG_extDescription__',
    action: {
      default_title: '__MSG_extName__',
    },
    default_locale: 'en',
    permissions: [
      'storage',
      'alarms',
      'declarativeNetRequest',
      'declarativeNetRequestWithHostAccess',
      'downloads',
      'offscreen',
      'notifications',
      'tabs',
      'webNavigation',
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
