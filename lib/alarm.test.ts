import { describe, it, expect } from 'vitest';
import {
  DEFAULT_ALARM,
  newAlarm,
  normalizeAlarm,
  fireKey,
  isAlarmDue,
  dueAlarms,
  nextOccurrence,
  MAX_ALARMS,
} from './alarm';
import type { AlarmItem } from './types';

// 2026-06-08 is a Monday.
const mon = (h: number, m = 0) => new Date(2026, 5, 8, h, m).getTime();
const tue = (h: number, m = 0) => new Date(2026, 5, 9, h, m).getTime();
const sat = (h: number, m = 0) => new Date(2026, 5, 13, h, m).getTime();

function weekly(over: Partial<AlarmItem> = {}): AlarmItem {
  return {
    id: 'a1',
    label: 'Stand up',
    time: '09:00',
    repeat: 'weekly',
    days: [1, 2, 3, 4, 5],
    date: null,
    enabled: true,
    lastFiredKey: null,
    ...over,
  };
}

function once(over: Partial<AlarmItem> = {}): AlarmItem {
  return {
    id: 'o1',
    label: 'Call',
    time: '09:00',
    repeat: 'once',
    days: [],
    date: '2026-06-08',
    enabled: true,
    lastFiredKey: null,
    ...over,
  };
}

describe('MAX_ALARMS', () => {
  it('caps at 20', () => {
    expect(MAX_ALARMS).toBe(20);
  });
});

describe('fireKey', () => {
  it('formats local date and minute', () => {
    expect(fireKey(mon(9, 5))).toBe('2026-06-08 09:05');
  });
});

describe('normalizeAlarm', () => {
  it('fills defaults for a partial record', () => {
    const a = normalizeAlarm({ id: 'x', time: '07:30' });
    expect(a.repeat).toBe('once');
    expect(a.days).toEqual([]);
    expect(a.enabled).toBe(true);
    expect(a.lastFiredKey).toBeNull();
  });
});

describe('newAlarm', () => {
  it('defaults to a one-time alarm dated today', () => {
    const a = newAlarm(mon(9, 0));
    expect(a.repeat).toBe('once');
    expect(a.date).toBe('2026-06-08');
    expect(a.enabled).toBe(true);
  });
});

describe('isAlarmDue - weekly', () => {
  it('fires on a matching weekday at the exact minute', () => {
    expect(isAlarmDue(weekly(), mon(9, 0))).toBe(true);
  });
  it('does not fire a minute early or late', () => {
    expect(isAlarmDue(weekly(), mon(8, 59))).toBe(false);
    expect(isAlarmDue(weekly(), mon(9, 1))).toBe(false);
  });
  it('does not fire on an excluded day', () => {
    expect(isAlarmDue(weekly(), sat(9, 0))).toBe(false);
  });
  it('does not fire when disabled', () => {
    expect(isAlarmDue(weekly({ enabled: false }), mon(9, 0))).toBe(false);
  });
  it('does not re-fire within the same minute (lastFiredKey)', () => {
    expect(isAlarmDue(weekly({ lastFiredKey: '2026-06-08 09:00' }), mon(9, 0))).toBe(false);
  });
});

describe('isAlarmDue - once', () => {
  it('fires on the exact date and minute', () => {
    expect(isAlarmDue(once(), mon(9, 0))).toBe(true);
  });
  it('does not fire on a different date', () => {
    expect(isAlarmDue(once(), tue(9, 0))).toBe(false);
  });
});

describe('dueAlarms', () => {
  it('returns only the due alarms', () => {
    const list = [weekly(), once({ date: '2026-06-09' })];
    expect(dueAlarms(list, mon(9, 0)).map((a) => a.id)).toEqual(['a1']);
  });
});

describe('nextOccurrence', () => {
  it('weekly: returns the same day later today', () => {
    expect(nextOccurrence(weekly(), mon(8, 0))).toBe(mon(9, 0));
  });
  it('weekly: rolls to the next matching weekday when today has passed', () => {
    expect(nextOccurrence(weekly(), mon(9, 30))).toBe(tue(9, 0));
  });
  it('weekly: skips to Monday from Saturday', () => {
    expect(nextOccurrence(weekly(), sat(9, 30))).toBe(new Date(2026, 5, 15, 9, 0).getTime());
  });
  it('once: returns the datetime when still in the future', () => {
    expect(nextOccurrence(once(), mon(8, 0))).toBe(mon(9, 0));
  });
  it('once: returns null when already passed', () => {
    expect(nextOccurrence(once(), mon(9, 30))).toBeNull();
  });
  it('returns null when disabled', () => {
    expect(nextOccurrence(weekly({ enabled: false }), mon(8, 0))).toBeNull();
  });
});
