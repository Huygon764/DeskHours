import { vi } from 'vitest';
import type { RedirectRule } from './dnr-rules';

let dynamicRules: RedirectRule[] = [];

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
