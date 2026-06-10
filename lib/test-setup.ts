import { vi } from 'vitest';
import type { RedirectRule } from './dnr-rules';
import enMessages from '../public/_locales/en/messages.json';

let dynamicRules: RedirectRule[] = [];

function translateMessage(name: string, substitutions?: string | string[]): string {
  const entry = enMessages[name as keyof typeof enMessages];
  if (!entry?.message) return name;
  let msg = entry.message;
  const subs = substitutions == null ? [] : Array.isArray(substitutions) ? substitutions : [substitutions];
  subs.forEach((sub, i) => {
    msg = msg.replace(`$${i + 1}$`, sub);
  });
  return msg;
}

/** Stub chrome.i18n for tests; call after fakeBrowser.reset(). */
export function setupI18nMock(): void {
  vi.spyOn(browser.i18n, 'getMessage').mockImplementation(translateMessage);
}

/** In-memory DNR mock; call after fakeBrowser.reset() in each test file. */
export function setupDnrMock(): void {
  dynamicRules = [];
  vi.spyOn(browser.declarativeNetRequest, 'getDynamicRules').mockImplementation(async () =>
    dynamicRules.map((r) => ({ ...r })),
  );
  vi.spyOn(browser.declarativeNetRequest, 'updateDynamicRules').mockImplementation(
    async ({ removeRuleIds, addRules }) => {
      if (removeRuleIds?.length) {
        dynamicRules = dynamicRules.filter((r) => !removeRuleIds.includes(r.id));
      }
      if (addRules?.length) {
        dynamicRules.push(...(addRules as RedirectRule[]));
      }
    },
  );
}

export function getDynamicRulesForTest(): RedirectRule[] {
  return dynamicRules.map((r) => ({ ...r }));
}

/** Stub offscreen + notifications for pomodoro controller tests. */
export function setupOffscreenMock(): void {
  Object.defineProperty(browser, 'offscreen', {
    configurable: true,
    value: {
      hasDocument: vi.fn().mockResolvedValue(true),
      createDocument: vi.fn().mockResolvedValue(undefined),
    },
  });
  vi.spyOn(browser.notifications, 'create').mockImplementation(async () => 'test-notification');
  vi.spyOn(browser.runtime, 'sendMessage').mockResolvedValue(undefined);
}
