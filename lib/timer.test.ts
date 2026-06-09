import { describe, it, expect } from 'vitest';
import {
  DEFAULT_TIMER,
  addDurationSeconds,
  clampDurationSeconds,
  formatHhMmSs,
  formatMmSs,
  isTimerPaused,
  normalizeTimerState,
  parseHhMmSs,
  parseMmSs,
  splitHhMmSs,
  resumeTimerState,
  timerRemainingMs,
  withDurationSeconds,
} from './timer';
import type { CountdownTimerState } from './types';

const base: CountdownTimerState = { ...DEFAULT_TIMER };
const MAX_SECONDS = 24 * 60 * 60;

describe('timerRemainingMs', () => {
  it('returns ms until endsAt while running', () => {
    expect(
      timerRemainingMs({ ...base, active: true, endsAt: 5000 }, 1000),
    ).toBe(4000);
  });

  it('returns frozen remaining while paused', () => {
    expect(
      timerRemainingMs(
        { ...base, active: true, endsAt: null, pausedRemainingMs: 90_000 },
        999_999,
      ),
    ).toBe(90_000);
  });

  it('returns 0 when idle', () => {
    expect(timerRemainingMs(base, 1000)).toBe(0);
  });
});

describe('withDurationSeconds / addDurationSeconds', () => {
  it('updates seconds only while idle', () => {
    expect(withDurationSeconds(base, 90).durationSeconds).toBe(90);
    expect(withDurationSeconds({ ...base, active: true }, 90).durationSeconds).toBe(300);
    expect(withDurationSeconds({ ...base, finished: true }, 90).durationSeconds).toBe(300);
  });

  it('adds seconds with clamping', () => {
    expect(addDurationSeconds(base, 30).durationSeconds).toBe(330);
    expect(
      addDurationSeconds({ ...base, durationSeconds: MAX_SECONDS - 1 }, 5).durationSeconds,
    ).toBe(MAX_SECONDS);
  });
});

describe('formatHhMmSs / parseHhMmSs', () => {
  it('formats and splits hh:mm:ss', () => {
    expect(formatHhMmSs(125)).toBe('00:02:05');
    expect(splitHhMmSs(36_610)).toEqual({ hours: '10', minutes: '10', seconds: '10' });
  });

  it('parses hh:mm:ss', () => {
    expect(parseHhMmSs('00', '02', '05')).toBe(125);
    expect(parseHhMmSs('10', '10', '10')).toBe(36_610);
    expect(parseHhMmSs('00', '02', '60')).toBeNull();
  });

  it('keeps legacy mm:ss helpers working', () => {
    expect(formatMmSs(125)).toBe('00:02:05');
    expect(parseMmSs('02', '05')).toBe(125);
  });
});

describe('normalizeTimerState', () => {
  it('migrates legacy durationMinutes', () => {
    expect(normalizeTimerState({ durationMinutes: 3 }).durationSeconds).toBe(180);
  });
});

describe('resumeTimerState', () => {
  it('restores endsAt from paused remaining', () => {
    const paused = {
      ...base,
      active: true,
      endsAt: null,
      pausedRemainingMs: 12_000,
    };
    const resumed = resumeTimerState(paused, 50_000);
    expect(resumed.endsAt).toBe(62_000);
    expect(isTimerPaused(resumed)).toBe(false);
  });
});

describe('clampDurationSeconds', () => {
  it('clamps to 1..86400', () => {
    expect(clampDurationSeconds(0)).toBe(1);
    expect(clampDurationSeconds(100_000)).toBe(86_400);
  });
});
