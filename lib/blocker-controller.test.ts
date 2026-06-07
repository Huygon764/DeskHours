import { describe, it, expect, beforeEach, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { syncBlocker, pruneExpired } from './blocker-controller';
import { blocklistItem, tempUnblocksItem, unmaskedDomainsItem } from './storage';
import { getDynamicRulesForTest, setupDnrMock } from './test-setup';

const MON_1030 = new Date(2026, 5, 8, 10, 30).getTime();

describe('syncBlocker', () => {
  beforeEach(async () => {
    fakeBrowser.reset();
    setupDnrMock();
    vi.spyOn(Date, 'now').mockReturnValue(MON_1030);
    await blocklistItem.setValue([
      { id: '1', domain: 'facebook.com', masked: false },
      { id: '2', domain: 'youtube.com', masked: false },
    ]);
  });

  it('applies redirect rules for all blocked domains during an active window', async () => {
    await syncBlocker();
    const rules = getDynamicRulesForTest();
    expect(rules.map((r) => r.condition.requestDomains?.[0]).sort()).toEqual(['facebook.com', 'youtube.com']);
  });

  it('clears all rules outside an active window', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(new Date(2026, 5, 8, 12, 30).getTime());
    await syncBlocker();
    expect(getDynamicRulesForTest()).toEqual([]);
  });

  it('excludes a domain with an active temp unblock', async () => {
    await tempUnblocksItem.setValue([{ domain: 'facebook.com', expiresAt: MON_1030 + 60_000 }]);
    await syncBlocker();
    const rules = getDynamicRulesForTest();
    expect(rules.map((r) => r.condition.requestDomains?.[0])).toEqual(['youtube.com']);
  });

  it('ignores an expired temp unblock', async () => {
    await tempUnblocksItem.setValue([{ domain: 'facebook.com', expiresAt: MON_1030 - 1 }]);
    await syncBlocker();
    const rules = getDynamicRulesForTest();
    expect(rules.map((r) => r.condition.requestDomains?.[0]).sort()).toEqual(['facebook.com', 'youtube.com']);
  });

  it('blocks session-unmasked domains during an active window', async () => {
    await unmaskedDomainsItem.setValue(['reddit.com']);
    await syncBlocker();
    const rules = getDynamicRulesForTest();
    expect(rules.map((r) => r.condition.requestDomains?.[0])).toContain('reddit.com');
  });
});

describe('pruneExpired', () => {
  it('removes only expired temp unblocks', async () => {
    fakeBrowser.reset();
    setupDnrMock();
    vi.spyOn(Date, 'now').mockReturnValue(1000);
    await tempUnblocksItem.setValue([
      { domain: 'a.com', expiresAt: 500 },
      { domain: 'b.com', expiresAt: 5000 },
    ]);
    await pruneExpired();
    expect(await tempUnblocksItem.getValue()).toEqual([{ domain: 'b.com', expiresAt: 5000 }]);
  });
});
