import { describe, it, expect } from 'vitest';
import {
  cloneSchedule,
  DEFAULT_SCHEDULE,
  isBlockingActive,
  matchingPresetId,
  SCHEDULE_PRESETS,
  schedulesEqual,
} from './schedule';
import type { ScheduleWindow } from './types';

// 2026-06-08 is a Monday.
const mon = (h: number, m = 0) => new Date(2026, 5, 8, h, m).getTime();
const sat = (h: number, m = 0) => new Date(2026, 5, 13, h, m).getTime();
const sun = (h: number, m = 0) => new Date(2026, 5, 14, h, m).getTime();

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
  it('default schedule blocks Mon 08:00-12:00 and 13:30-17:00', () => {
    expect(isBlockingActive(DEFAULT_SCHEDULE, mon(8, 30))).toBe(true);
    expect(isBlockingActive(DEFAULT_SCHEDULE, mon(12, 30))).toBe(false);
    expect(isBlockingActive(DEFAULT_SCHEDULE, mon(14, 0))).toBe(true);
    expect(isBlockingActive(DEFAULT_SCHEDULE, mon(17, 0))).toBe(false);
  });
});

describe('SCHEDULE_PRESETS', () => {
  it('office hours blocks during morning and afternoon', () => {
    const preset = SCHEDULE_PRESETS.find((p) => p.id === 'office-hours')!;
    expect(isBlockingActive(preset.windows, mon(10, 0))).toBe(true);
    expect(isBlockingActive(preset.windows, mon(12, 30))).toBe(false);
    expect(isBlockingActive(preset.windows, mon(16, 0))).toBe(true);
  });

  it('evenings blocks Mon-Fri 18-22 only', () => {
    const preset = SCHEDULE_PRESETS.find((p) => p.id === 'evenings')!;
    expect(isBlockingActive(preset.windows, mon(19, 0))).toBe(true);
    expect(isBlockingActive(preset.windows, mon(17, 0))).toBe(false);
    expect(isBlockingActive(preset.windows, sat(19, 0))).toBe(false);
  });

  it('weekends blocks Sat-Sun 8-22', () => {
    const preset = SCHEDULE_PRESETS.find((p) => p.id === 'weekends')!;
    expect(isBlockingActive(preset.windows, sat(10, 0))).toBe(true);
    expect(isBlockingActive(preset.windows, sun(21, 0))).toBe(true);
    expect(isBlockingActive(preset.windows, mon(10, 0))).toBe(false);
  });

  it('always on blocks any day', () => {
    const preset = SCHEDULE_PRESETS.find((p) => p.id === 'always-on')!;
    expect(isBlockingActive(preset.windows, mon(3, 0))).toBe(true);
    expect(isBlockingActive(preset.windows, sun(15, 0))).toBe(true);
  });
});

describe('schedulesEqual', () => {
  it('ignores day order within a window', () => {
    const a = [{ days: [5, 1, 3], start: '08:00', end: '12:00' }];
    const b = [{ days: [1, 3, 5], start: '08:00', end: '12:00' }];
    expect(schedulesEqual(a, b)).toBe(true);
  });

  it('matches cloned preset windows', () => {
    const preset = SCHEDULE_PRESETS[0];
    expect(schedulesEqual(cloneSchedule(preset.windows), preset.windows)).toBe(true);
    expect(matchingPresetId(cloneSchedule(preset.windows))).toBe('office-hours');
  });
});
