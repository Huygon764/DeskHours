import type { PomodoroState } from './types';

export const DEFAULT_POMODORO: PomodoroState = {
  workMinutes: 25,
  restMinutes: 5,
  phase: 'idle',
  phaseEndsAt: null,
  pausedRemainingMs: null,
};

export interface PomodoroPreset {
  id: 'classic' | 'deep';
  label: string;
  workMinutes: number;
  restMinutes: number;
}

export const POMODORO_PRESETS: PomodoroPreset[] = [
  { id: 'classic', label: 'Classic', workMinutes: 25, restMinutes: 5 },
  { id: 'deep', label: 'Deep', workMinutes: 50, restMinutes: 10 },
];

export function matchesPreset(state: PomodoroState, preset: PomodoroPreset): boolean {
  return state.workMinutes === preset.workMinutes && state.restMinutes === preset.restMinutes;
}

/** Advance to the next phase. idle->work, work->rest, rest->work.
 *  Sets phaseEndsAt = now + duration of the new phase. */
export function nextPhase(state: PomodoroState, now: number): PomodoroState {
  const newPhase = state.phase === 'work' ? 'rest' : 'work';
  const minutes = newPhase === 'work' ? state.workMinutes : state.restMinutes;
  return {
    ...state,
    phase: newPhase,
    phaseEndsAt: now + minutes * 60_000,
    pausedRemainingMs: null,
  };
}

/** Milliseconds left in the current phase, clamped at 0; 0 when idle. */
export function remainingMs(state: PomodoroState, now: number): number {
  if (state.phase === 'idle') return 0;
  if (state.pausedRemainingMs != null) return state.pausedRemainingMs;
  if (state.phaseEndsAt == null) return 0;
  return Math.max(0, state.phaseEndsAt - now);
}

export function isPaused(state: PomodoroState): boolean {
  return state.pausedRemainingMs != null;
}

/** Freeze the countdown and store time left. */
export function pauseState(state: PomodoroState, now: number): PomodoroState {
  if (state.phase === 'idle' || isPaused(state)) return state;
  return {
    ...state,
    phaseEndsAt: null,
    pausedRemainingMs: remainingMs(state, now),
  };
}

/** Resume a paused phase from stored time left. */
export function resumeState(state: PomodoroState, now: number): PomodoroState {
  if (!isPaused(state) || state.pausedRemainingMs == null) return state;
  return {
    ...state,
    phaseEndsAt: now + state.pausedRemainingMs,
    pausedRemainingMs: null,
  };
}

const MIN_MINUTES = 1;
const MAX_MINUTES = 120;

export function clampMinutes(minutes: number): number {
  return Math.min(MAX_MINUTES, Math.max(MIN_MINUTES, Math.round(minutes)));
}

export function parseMinutesInput(raw: string, fallback: number): number {
  const digits = raw.replace(/\D/g, '');
  if (digits === '') return fallback;
  const parsed = Number.parseInt(digits, 10);
  if (Number.isNaN(parsed)) return fallback;
  return clampMinutes(parsed);
}

/** Update durations; only allowed while idle (resets phase). */
export function withDurations(
  state: PomodoroState,
  workMinutes: number,
  restMinutes: number,
): PomodoroState {
  return {
    workMinutes: clampMinutes(workMinutes),
    restMinutes: clampMinutes(restMinutes),
    phase: 'idle',
    phaseEndsAt: null,
    pausedRemainingMs: null,
  };
}
