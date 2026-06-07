import { defineWebExtConfig } from 'wxt';

/** Copy to web-ext.config.ts and adjust paths for your machine. */
export default defineWebExtConfig({
  binaries: {
    // macOS Brave (Chromium-based)
    chrome: '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser',
    // Linux example:
    // chrome: '/usr/bin/brave-browser',
    // Windows example:
    // chrome: 'C:\\Program Files\\BraveSoftware\\Brave-Browser\\Application\\brave.exe',
  },
});
