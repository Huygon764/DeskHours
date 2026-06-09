import { describe, it, expect } from 'vitest';
import {
  nextPhase,
  remainingMs,
  pauseState,
  resumeState,
  isPaused,
  DEFAULT_POMODORO,
  displaySecondsFromMs,
  endAtFromDuration,
  POMODORO_PRESETS,
  matchesPreset,
  parseMinutesInput,
  withDurations,
} from './pomodoro';
import type { PomodoroState } from './types';

const base: PomodoroState = {
  workMinutes: 25,
  restMinutes: 5,
  phase: 'idle',
  phaseEndsAt: null,
  pausedRemainingMs: null,
};

describe('nextPhase', () => {
  it('idle -> work, sets phaseEndsAt 25min ahead', () => {
    const now = 1_000_000;
    const s = nextPhase(base, now);
    expect(s.phase).toBe('work');
    expect(s.phaseEndsAt).toBe(now + 25 * 60_000);
  });
  it('work -> rest, 5min ahead', () => {
    const now = 2_000_000;
    const s = nextPhase({ ...base, phase: 'work' }, now);
    expect(s.phase).toBe('rest');
    expect(s.phaseEndsAt).toBe(now + 5 * 60_000);
  });
  it('rest -> work, 25min ahead', () => {
    const now = 3_000_000;
    const s = nextPhase({ ...base, phase: 'rest' }, now);
    expect(s.phase).toBe('work');
    expect(s.phaseEndsAt).toBe(now + 25 * 60_000);
  });
  it('respects custom durations', () => {
    const s = nextPhase({ ...base, workMinutes: 50, phase: 'idle' }, 50);
    expect(s.phaseEndsAt).toBe(50 * 60_000);
  });

  it('aligns phaseEndsAt when now is mid-second', () => {
    const s = nextPhase(base, 1_000_050);
    expect(s.phaseEndsAt).toBe(2_500_000);
    expect(displaySecondsFromMs(s.phaseEndsAt - 1_000_050)).toBe(25 * 60);
  });
});

describe('endAtFromDuration', () => {
  it('aligns end time to whole seconds', () => {
    expect(endAtFromDuration(1_000_050, 25 * 60_000)).toBe(2_500_000);
    expect(endAtFromDuration(1_000_000, 25 * 60_000)).toBe(2_500_000);
  });
});

describe('displaySecondsFromMs', () => {
  it('shows full duration at start without rounding up', () => {
    expect(displaySecondsFromMs(25 * 60_000)).toBe(25 * 60);
    expect(displaySecondsFromMs(25 * 60_000 - 1)).toBe(25 * 60);
  });

  it('ticks down at second boundaries', () => {
    expect(displaySecondsFromMs(25 * 60_000 - 1000)).toBe(25 * 60 - 1);
    expect(displaySecondsFromMs(1000)).toBe(1);
    expect(displaySecondsFromMs(999)).toBe(1);
    expect(displaySecondsFromMs(0)).toBe(0);
  });
});

describe('remainingMs', () => {
  it('returns ms until phaseEndsAt, clamped at 0', () => {
    expect(remainingMs({ ...base, phase: 'work', phaseEndsAt: 5000 }, 1000)).toBe(4000);
    expect(remainingMs({ ...base, phase: 'work', phaseEndsAt: 1000 }, 5000)).toBe(0);
  });
  it('returns 0 when idle', () => {
    expect(remainingMs(base, 1000)).toBe(0);
  });
});

describe('pauseState / resumeState', () => {
  it('stores remaining time and clears phaseEndsAt', () => {
    const running = { ...base, phase: 'work' as const, phaseEndsAt: 10_000 };
    const paused = pauseState(running, 4000);
    expect(paused.pausedRemainingMs).toBe(6000);
    expect(paused.phaseEndsAt).toBeNull();
    expect(isPaused(paused)).toBe(true);
  });

  it('resumes from stored remaining time', () => {
    const paused = {
      ...base,
      phase: 'work' as const,
      phaseEndsAt: null,
      pausedRemainingMs: 6000,
    };
    const resumed = resumeState(paused, 50_000);
    expect(resumed.phaseEndsAt).toBe(56_000);
    expect(resumed.pausedRemainingMs).toBeNull();
  });

  it('returns frozen remaining while paused', () => {
    const paused = {
      ...base,
      phase: 'rest' as const,
      phaseEndsAt: null,
      pausedRemainingMs: 90_000,
    };
    expect(remainingMs(paused, 999_999)).toBe(90_000);
  });
});

describe('DEFAULT_POMODORO', () => {
  it('is idle 25/5', () => {
    expect(DEFAULT_POMODORO).toEqual({
      workMinutes: 25,
      restMinutes: 5,
      phase: 'idle',
      phaseEndsAt: null,
      pausedRemainingMs: null,
    });
  });
});

describe('POMODORO_PRESETS', () => {
  it('includes classic 25/5 and deep 50/10', () => {
    expect(POMODORO_PRESETS).toEqual([
      { id: 'classic', label: 'Classic', workMinutes: 25, restMinutes: 5 },
      { id: 'deep', label: 'Deep', workMinutes: 50, restMinutes: 10 },
    ]);
  });

  it('matchesPreset compares work and rest minutes', () => {
    const deep = POMODORO_PRESETS[1];
    expect(matchesPreset({ ...base, workMinutes: 50, restMinutes: 10 }, deep)).toBe(true);
    expect(matchesPreset(base, deep)).toBe(false);
  });
});

describe('parseMinutesInput', () => {
  it('parses digits and clamps to 1..120', () => {
    expect(parseMinutesInput('50', 25)).toBe(50);
    expect(parseMinutesInput('999', 25)).toBe(120);
    expect(parseMinutesInput('0', 25)).toBe(1);
  });

  it('returns fallback for empty or invalid input', () => {
    expect(parseMinutesInput('', 25)).toBe(25);
    expect(parseMinutesInput('abc', 5)).toBe(5);
  });
});

describe('withDurations', () => {
  it('updates minutes and keeps idle', () => {
    const s = withDurations({ ...base, phase: 'work', phaseEndsAt: 999 }, 1, 2);
    expect(s).toEqual({
      workMinutes: 1,
      restMinutes: 2,
      phase: 'idle',
      phaseEndsAt: null,
      pausedRemainingMs: null,
    });
  });
  it('clamps to 1..120', () => {
    expect(withDurations(base, 0, 200).workMinutes).toBe(1);
    expect(withDurations(base, 0, 200).restMinutes).toBe(120);
  });
});
