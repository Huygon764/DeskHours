import { describe, it, expect, beforeEach } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { blocklistItem, scheduleItem, pomodoroItem, tempUnblocksItem, authItem } from './storage';
import { DEFAULT_SCHEDULE } from './schedule';
import { DEFAULT_POMODORO } from './pomodoro';

describe('storage items', () => {
  beforeEach(() => fakeBrowser.reset());

  it('blocklist defaults to empty array', async () => {
    expect(await blocklistItem.getValue()).toEqual([]);
  });
  it('schedule defaults to DEFAULT_SCHEDULE', async () => {
    expect(await scheduleItem.getValue()).toEqual(DEFAULT_SCHEDULE);
  });
  it('pomodoro defaults to DEFAULT_POMODORO', async () => {
    expect(await pomodoroItem.getValue()).toEqual(DEFAULT_POMODORO);
  });
  it('tempUnblocks defaults to empty array', async () => {
    expect(await tempUnblocksItem.getValue()).toEqual([]);
  });
  it('auth defaults to null', async () => {
    expect(await authItem.getValue()).toBeNull();
  });
  it('round-trips a blocklist write', async () => {
    await blocklistItem.setValue([{ id: 'a', domain: 'facebook.com', masked: false }]);
    expect(await blocklistItem.getValue()).toEqual([{ id: 'a', domain: 'facebook.com', masked: false }]);
  });
});
