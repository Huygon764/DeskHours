import { describe, it, expect, beforeEach, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { syncBlocker, pruneExpired } from './blocker-controller';
import { blocklistItem, pomodoroItem, tempUnblocksItem, unmaskedDomainsItem } from './storage';
import { DEFAULT_POMODORO } from './pomodoro';
import { getDynamicRulesForTest, setupDnrMock } from './test-setup';

const MON_1030 = new Date(2026, 5, 8, 10, 30).getTime();

describe('syncBlocker', () => {
  beforeEach(async () => {
    fakeBrowser.reset();
    setupDnrMock();
    vi.spyOn(Date, 'now').mockReturnValue(MON_1030);
    await blocklistItem.setValue([
      { id: '1', domain: 'facebook.com', masked: false, enabled: true },
      { id: '2', domain: 'youtube.com', masked: false, enabled: true },
    ]);
  });

  it('applies redirect rules for all blocked domains during an active window', async () => {
    await syncBlocker();
    const rules = getDynamicRulesForTest();
    expect(rules.map((r) => r.condition.regexFilter)).toEqual([
      '^https?://([^/]*\\.)?facebook\\.com(/.*)?$',
      '^https?://([^/]*\\.)?youtube\\.com(/.*)?$',
    ]);
  });

  it('clears all rules outside an active window', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(new Date(2026, 5, 8, 12, 30).getTime());
    await syncBlocker();
    expect(getDynamicRulesForTest()).toEqual([]);
  });

  it('applies rules during focus work outside schedule', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(new Date(2026, 5, 8, 12, 30).getTime());
    await pomodoroItem.setValue({
      ...DEFAULT_POMODORO,
      phase: 'work',
      phaseEndsAt: Date.now() + 25 * 60_000,
    });
    await syncBlocker();
    const rules = getDynamicRulesForTest();
    expect(rules.map((r) => r.condition.regexFilter)).toEqual([
      '^https?://([^/]*\\.)?facebook\\.com(/.*)?$',
      '^https?://([^/]*\\.)?youtube\\.com(/.*)?$',
    ]);
  });

  it('clears rules during focus rest outside schedule', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(new Date(2026, 5, 8, 12, 30).getTime());
    await pomodoroItem.setValue({
      ...DEFAULT_POMODORO,
      phase: 'rest',
      phaseEndsAt: Date.now() + 5 * 60_000,
    });
    await syncBlocker();
    expect(getDynamicRulesForTest()).toEqual([]);
  });

  it('excludes a pattern with an active temp unblock', async () => {
    await tempUnblocksItem.setValue([{ pattern: 'facebook.com', expiresAt: MON_1030 + 60_000 }]);
    await syncBlocker();
    const rules = getDynamicRulesForTest();
    expect(rules.map((r) => r.condition.regexFilter)).toEqual(['^https?://([^/]*\\.)?youtube\\.com(/.*)?$']);
  });

  it('ignores an expired temp unblock', async () => {
    await tempUnblocksItem.setValue([{ pattern: 'facebook.com', expiresAt: MON_1030 - 1 }]);
    await syncBlocker();
    const rules = getDynamicRulesForTest();
    expect(rules.map((r) => r.condition.regexFilter)).toEqual([
      '^https?://([^/]*\\.)?facebook\\.com(/.*)?$',
      '^https?://([^/]*\\.)?youtube\\.com(/.*)?$',
    ]);
  });

  it('recomputes cached patterns after a blocklist change + resync', async () => {
    await syncBlocker();
    expect(getDynamicRulesForTest()).toHaveLength(2);
    await blocklistItem.setValue([{ id: '1', domain: 'facebook.com', masked: false, enabled: true }]);
    await syncBlocker();
    expect(getDynamicRulesForTest()).toHaveLength(1);
  });

  it('skips disabled blocklist entries', async () => {
    await blocklistItem.setValue([
      { id: '1', domain: 'facebook.com', masked: false, enabled: false },
      { id: '2', domain: 'youtube.com', masked: false, enabled: true },
    ]);
    await syncBlocker();
    const rules = getDynamicRulesForTest();
    expect(rules.map((r) => r.condition.regexFilter)).toEqual(['^https?://([^/]*\\.)?youtube\\.com(/.*)?$']);
  });

  it('applies path rules for path patterns', async () => {
    await blocklistItem.setValue([{ id: '1', domain: 'youtube.com/shorts/*', masked: false, enabled: true }]);
    await syncBlocker();
    const rules = getDynamicRulesForTest();
    expect(rules[0].condition.regexFilter).toBe('^https?://([^/]*\\.)?youtube\\.com/shorts(/.*)?$');
  });

  it('applies keyword regex rules', async () => {
    await blocklistItem.setValue([
      { id: '1', domain: 'shorts', masked: false, enabled: true, kind: 'keyword' },
    ]);
    await syncBlocker();
    const rules = getDynamicRulesForTest();
    expect(rules[0].condition.regexFilter).toBe('^.*shorts.*$');
  });

  it('blocks session-unmasked patterns during an active window', async () => {
    await unmaskedDomainsItem.setValue(['reddit.com']);
    await syncBlocker();
    const rules = getDynamicRulesForTest();
    expect(rules.some((r) => r.condition.regexFilter === '^https?://([^/]*\\.)?reddit\\.com(/.*)?$')).toBe(true);
  });

  it('blocks plaintext hidden sites without session unmask', async () => {
    await blocklistItem.setValue([{ id: '1', domain: 'reddit.com', masked: true, enabled: true }]);
    await syncBlocker();
    const rules = getDynamicRulesForTest();
    expect(rules.some((r) => r.condition.regexFilter === '^https?://([^/]*\\.)?reddit\\.com(/.*)?$')).toBe(true);
  });

  it('blocks plaintext hidden keywords without session unmask', async () => {
    await blocklistItem.setValue([
      { id: '1', domain: 'gambling', masked: true, enabled: true, kind: 'keyword' },
    ]);
    await syncBlocker();
    const rules = getDynamicRulesForTest();
    expect(rules[0].condition.regexFilter).toBe('^.*gambling.*$');
  });
});

describe('pruneExpired', () => {
  it('removes only expired temp unblocks', async () => {
    fakeBrowser.reset();
    setupDnrMock();
    vi.spyOn(Date, 'now').mockReturnValue(1000);
    await tempUnblocksItem.setValue([
      { pattern: 'a.com', expiresAt: 500 },
      { pattern: 'b.com', expiresAt: 5000 },
    ]);
    await pruneExpired();
    expect(await tempUnblocksItem.getValue()).toEqual([{ pattern: 'b.com', expiresAt: 5000 }]);
  });
});

describe('grantUnblock', () => {
  beforeEach(async () => {
    fakeBrowser.reset();
    setupDnrMock();
    vi.spyOn(Date, 'now').mockReturnValue(MON_1030);
    await blocklistItem.setValue([{ id: '1', domain: 'facebook.com', masked: false, enabled: true }]);
  });

  it('removes the unblocked pattern from DNR rules', async () => {
    const { grantUnblock } = await import('./blocker-controller');
    await syncBlocker();
    expect(getDynamicRulesForTest()).toHaveLength(1);
    await grantUnblock('facebook.com', 5);
    expect(getDynamicRulesForTest()).toEqual([]);
    expect(await tempUnblocksItem.getValue()).toEqual([
      { pattern: 'facebook.com', expiresAt: MON_1030 + 5 * 60_000 },
    ]);
  });
});
