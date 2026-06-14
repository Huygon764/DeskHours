import { describe, it, expect } from 'vitest';
import {
  BASE_WAIT_SECONDS,
  MAX_WAIT_SECONDS,
  todayUnblockCount,
  pruneToToday,
  waitSeconds,
} from './unblock-wait';

const NOW = new Date(2026, 5, 8, 14, 0).getTime(); // Mon 2026-06-08 14:00 local
const earlierToday = new Date(2026, 5, 8, 9, 30).getTime();
const alsoToday = new Date(2026, 5, 8, 23, 59).getTime();
const yesterday = new Date(2026, 5, 7, 23, 0).getTime();
const lastWeek = new Date(2026, 5, 1, 10, 0).getTime();

describe('todayUnblockCount', () => {
  it('counts only timestamps on the same local day as now', () => {
    expect(todayUnblockCount([earlierToday, alsoToday, yesterday, lastWeek], NOW)).toBe(2);
  });

  it('returns 0 for an empty history', () => {
    expect(todayUnblockCount([], NOW)).toBe(0);
  });

  it('ignores all prior-day timestamps (daily reset)', () => {
    expect(todayUnblockCount([yesterday, lastWeek], NOW)).toBe(0);
  });
});

describe('pruneToToday', () => {
  it('keeps today and drops earlier days', () => {
    expect(pruneToToday([earlierToday, yesterday, alsoToday, lastWeek], NOW)).toEqual([
      earlierToday,
      alsoToday,
    ]);
  });

  it('returns an empty array when nothing is from today', () => {
    expect(pruneToToday([yesterday, lastWeek], NOW)).toEqual([]);
  });
});

describe('waitSeconds', () => {
  it('doubles from the base per prior unblock', () => {
    expect(waitSeconds(0)).toBe(30);
    expect(waitSeconds(1)).toBe(60);
    expect(waitSeconds(2)).toBe(120);
    expect(waitSeconds(3)).toBe(240);
  });

  it('caps at the 5-minute maximum', () => {
    expect(waitSeconds(4)).toBe(MAX_WAIT_SECONDS);
    expect(waitSeconds(10)).toBe(MAX_WAIT_SECONDS);
  });

  it('treats negative or fractional counts as the floor', () => {
    expect(waitSeconds(-3)).toBe(BASE_WAIT_SECONDS);
    expect(waitSeconds(1.9)).toBe(60);
  });
});
