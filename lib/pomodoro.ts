import type { PomodoroState } from './types';

export const DEFAULT_POMODORO: PomodoroState = {
  workMinutes: 25,
  restMinutes: 5,
  phase: 'idle',
  phaseEndsAt: null,
};

/** Advance to the next phase. idle->work, work->rest, rest->work.
 *  Sets phaseEndsAt = now + duration of the new phase. */
export function nextPhase(state: PomodoroState, now: number): PomodoroState {
  const newPhase = state.phase === 'work' ? 'rest' : 'work';
  const minutes = newPhase === 'work' ? state.workMinutes : state.restMinutes;
  return { ...state, phase: newPhase, phaseEndsAt: now + minutes * 60_000 };
}

/** Milliseconds left in the current phase, clamped at 0; 0 when idle. */
export function remainingMs(state: PomodoroState, now: number): number {
  if (state.phase === 'idle' || state.phaseEndsAt == null) return 0;
  return Math.max(0, state.phaseEndsAt - now);
}

const MIN_MINUTES = 1;
const MAX_MINUTES = 120;

export function clampMinutes(minutes: number): number {
  return Math.min(MAX_MINUTES, Math.max(MIN_MINUTES, Math.round(minutes)));
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
  };
}
