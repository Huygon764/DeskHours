import { describe, it, expect, beforeEach, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { blocklistItem } from './storage';
import { matchingKeyword } from './keyword-navigation';
import { setupDnrMock } from './test-setup';

const MON_1030 = new Date(2026, 5, 8, 10, 30).getTime();

describe('matchingKeyword', () => {
  beforeEach(async () => {
    fakeBrowser.reset();
    setupDnrMock();
    vi.spyOn(Date, 'now').mockReturnValue(MON_1030);
    await blocklistItem.setValue([
      { id: '1', domain: 'shorts', masked: false, enabled: true, kind: 'keyword' },
    ]);
  });

  it('matches keyword in URL during an active schedule window', async () => {
    await expect(matchingKeyword('https://www.youtube.com/shorts/abc')).resolves.toBe('shorts');
  });

  it('returns null outside schedule', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(new Date(2026, 5, 8, 12, 30).getTime());
    await expect(matchingKeyword('https://www.youtube.com/shorts/abc')).resolves.toBeNull();
  });

  it('returns null when keyword entry is disabled', async () => {
    await blocklistItem.setValue([
      { id: '1', domain: 'shorts', masked: false, enabled: false, kind: 'keyword' },
    ]);
    await expect(matchingKeyword('https://www.youtube.com/shorts/abc')).resolves.toBeNull();
  });
});
