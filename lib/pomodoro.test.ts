import { describe, it, expect } from 'vitest';
import { nextPhase, remainingMs, DEFAULT_POMODORO, withDurations } from './pomodoro';
import type { PomodoroState } from './types';

const base: PomodoroState = { workMinutes: 25, restMinutes: 5, phase: 'idle', phaseEndsAt: null };

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
    const s = nextPhase({ ...base, workMinutes: 50, phase: 'idle' }, 0);
    expect(s.phaseEndsAt).toBe(50 * 60_000);
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

describe('DEFAULT_POMODORO', () => {
  it('is idle 25/5', () => {
    expect(DEFAULT_POMODORO).toEqual({ workMinutes: 25, restMinutes: 5, phase: 'idle', phaseEndsAt: null });
  });
});

describe('withDurations', () => {
  it('updates minutes and keeps idle', () => {
    const s = withDurations({ ...base, phase: 'work', phaseEndsAt: 999 }, 1, 2);
    expect(s).toEqual({ workMinutes: 1, restMinutes: 2, phase: 'idle', phaseEndsAt: null });
  });
  it('clamps to 1..120', () => {
    expect(withDurations(base, 0, 200).workMinutes).toBe(1);
    expect(withDurations(base, 0, 200).restMinutes).toBe(120);
  });
});
