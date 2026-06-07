import { describe, it, expect } from 'vitest';
import { isBlockingActive, DEFAULT_SCHEDULE } from './schedule';
import type { ScheduleWindow } from './types';

// 2026-06-08 is a Monday.
const mon = (h: number, m = 0) => new Date(2026, 5, 8, h, m).getTime();
const sat = (h: number, m = 0) => new Date(2026, 5, 13, h, m).getTime();

const sched: ScheduleWindow[] = [
  { days: [1, 2, 3, 4, 5], start: '09:00', end: '12:00' },
  { days: [1, 2, 3, 4, 5], start: '13:00', end: '16:00' },
];

describe('isBlockingActive', () => {
  it('is active inside a weekday morning window', () => {
    expect(isBlockingActive(sched, mon(10, 30))).toBe(true);
  });
  it('is inactive during lunch gap', () => {
    expect(isBlockingActive(sched, mon(12, 30))).toBe(false);
  });
  it('is active inside afternoon window', () => {
    expect(isBlockingActive(sched, mon(15, 59))).toBe(true);
  });
  it('treats start as inclusive and end as exclusive', () => {
    expect(isBlockingActive(sched, mon(9, 0))).toBe(true);
    expect(isBlockingActive(sched, mon(12, 0))).toBe(false);
  });
  it('is inactive on weekends', () => {
    expect(isBlockingActive(sched, sat(10))).toBe(false);
  });
  it('is inactive when schedule empty', () => {
    expect(isBlockingActive([], mon(10))).toBe(false);
  });
  it('default schedule blocks Mon 09:00-12:00 and 13:00-16:00', () => {
    expect(isBlockingActive(DEFAULT_SCHEDULE, mon(9, 30))).toBe(true);
    expect(isBlockingActive(DEFAULT_SCHEDULE, mon(12, 30))).toBe(false);
    expect(isBlockingActive(DEFAULT_SCHEDULE, mon(14, 0))).toBe(true);
    expect(isBlockingActive(DEFAULT_SCHEDULE, mon(16, 0))).toBe(false);
  });
});
