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
  workMinutes: number;
  restMinutes: number;
}

export const POMODORO_PRESETS: PomodoroPreset[] = [
  { id: 'classic', workMinutes: 25, restMinutes: 5 },
  { id: 'deep', workMinutes: 50, restMinutes: 10 },
];

export function matchesPreset(state: PomodoroState, preset: PomodoroPreset): boolean {
  return state.workMinutes === preset.workMinutes && state.restMinutes === preset.restMinutes;
}

/** Wall-clock end time on a whole-second boundary for stable countdown display. */
export function endAtFromDuration(now: number, durationMs: number): number {
  const durationSec = Math.ceil(durationMs / 1000);
  return (Math.floor(now / 1000) + durationSec) * 1000;
}

/** Advance to the next phase. idle->work, work->rest, rest->work.
 *  Sets phaseEndsAt on a whole-second boundary. */
export function nextPhase(state: PomodoroState, now: number): PomodoroState {
  const newPhase = state.phase === 'work' ? 'rest' : 'work';
  const minutes = newPhase === 'work' ? state.workMinutes : state.restMinutes;
  return {
    ...state,
    phase: newPhase,
    phaseEndsAt: endAtFromDuration(now, minutes * 60_000),
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

/** Whole seconds for mm:ss display; rounds up partial seconds without +1s at start. */
export function displaySecondsFromMs(remainingMs: number): number {
  return Math.max(0, Math.floor((remainingMs + 999) / 1000));
}

export function isPaused(state: PomodoroState): boolean {
  return state.pausedRemainingMs != null;
}

/** True while a focus (work) phase is active, including when paused. */
export function isFocusBlockActive(state: PomodoroState): boolean {
  return state.phase === 'work';
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
    phaseEndsAt: endAtFromDuration(now, state.pausedRemainingMs),
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

/** Fresh idle state with the given (clamped) durations. Always resets to idle, so
 *  callers must guard that the timer is idle before applying. */
export function withDurations(workMinutes: number, restMinutes: number): PomodoroState {
  return {
    workMinutes: clampMinutes(workMinutes),
    restMinutes: clampMinutes(restMinutes),
    phase: 'idle',
    phaseEndsAt: null,
    pausedRemainingMs: null,
  };
}

/** mm:ss with both fields zero-padded, e.g. 63 -> "01:03". */
export function formatMmSs(totalSeconds: number): string {
  const m = String(Math.floor(totalSeconds / 60)).padStart(2, '0');
  const s = String(totalSeconds % 60).padStart(2, '0');
  return `${m}:${s}`;
}
