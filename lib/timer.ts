import { endAtFromDuration } from './pomodoro';
import type { CountdownTimerState } from './types';

export const DEFAULT_TIMER: CountdownTimerState = {
  durationSeconds: 5 * 60,
  active: false,
  finished: false,
  endsAt: null,
  pausedRemainingMs: null,
  soundEnabled: true,
};

const MIN_SECONDS = 1;
const MAX_SECONDS = 24 * 60 * 60;

export function clampDurationSeconds(seconds: number): number {
  return Math.min(MAX_SECONDS, Math.max(MIN_SECONDS, Math.round(seconds)));
}

/** Backfill durationSeconds from legacy durationMinutes storage. */
export function normalizeTimerState(
  state: Partial<CountdownTimerState> & { durationMinutes?: number },
): CountdownTimerState {
  const legacyMinutes = state.durationMinutes;
  const durationSeconds = clampDurationSeconds(
    state.durationSeconds ??
      (legacyMinutes != null ? legacyMinutes * 60 : DEFAULT_TIMER.durationSeconds),
  );
  return {
    durationSeconds,
    active: state.active ?? DEFAULT_TIMER.active,
    finished: state.finished ?? DEFAULT_TIMER.finished,
    endsAt: state.endsAt ?? DEFAULT_TIMER.endsAt,
    pausedRemainingMs: state.pausedRemainingMs ?? DEFAULT_TIMER.pausedRemainingMs,
    soundEnabled: state.soundEnabled ?? DEFAULT_TIMER.soundEnabled,
  };
}

export type TimerTimeParts = { hours: string; minutes: string; seconds: string };

export function splitHhMmSs(totalSeconds: number): TimerTimeParts {
  const total = Math.max(0, Math.round(totalSeconds));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return {
    hours: String(h).padStart(2, '0'),
    minutes: String(m).padStart(2, '0'),
    seconds: String(s).padStart(2, '0'),
  };
}

export function formatHhMmSs(totalSeconds: number): string {
  const { hours, minutes, seconds } = splitHhMmSs(totalSeconds);
  return `${hours}:${minutes}:${seconds}`;
}

/** @deprecated Use formatHhMmSs */
export function formatMmSs(totalSeconds: number): string {
  return formatHhMmSs(totalSeconds);
}

export function parseHhMmSs(hours: string, minutes: string, seconds: string): number | null {
  const h = hours.padStart(2, '0');
  const m = minutes.padStart(2, '0');
  const s = seconds.padStart(2, '0');
  if (!/^\d{2}$/.test(h) || !/^\d{2}$/.test(m) || !/^\d{2}$/.test(s)) return null;
  const hi = Number(h);
  const mi = Number(m);
  const si = Number(s);
  if (mi > 59 || si > 59) return null;
  return clampDurationSeconds(hi * 3600 + mi * 60 + si);
}

/** @deprecated Use parseHhMmSs */
export function parseMmSs(minutes: string, seconds: string): number | null {
  return parseHhMmSs('00', minutes, seconds);
}

export function isTimerPaused(state: CountdownTimerState): boolean {
  return state.pausedRemainingMs != null;
}

export function isTimerRunning(state: CountdownTimerState): boolean {
  return state.active;
}

export function isTimerFinished(state: CountdownTimerState): boolean {
  return state.finished;
}

export function isTimerIdle(state: CountdownTimerState): boolean {
  return !state.active && !state.finished;
}

/** Milliseconds left on the countdown; 0 when idle. */
export function timerRemainingMs(state: CountdownTimerState, now: number): number {
  if (!state.active) return 0;
  if (state.pausedRemainingMs != null) return state.pausedRemainingMs;
  if (state.endsAt == null) return 0;
  return Math.max(0, state.endsAt - now);
}

export function withDurationSeconds(
  state: CountdownTimerState,
  durationSeconds: number,
): CountdownTimerState {
  if (!isTimerIdle(state)) return state;
  return { ...state, durationSeconds: clampDurationSeconds(durationSeconds) };
}

export function addDurationSeconds(
  state: CountdownTimerState,
  deltaSeconds: number,
): CountdownTimerState {
  return withDurationSeconds(state, state.durationSeconds + deltaSeconds);
}

export function resumeTimerState(state: CountdownTimerState, now: number): CountdownTimerState {
  if (!isTimerPaused(state) || state.pausedRemainingMs == null) return state;
  return {
    ...state,
    endsAt: endAtFromDuration(now, state.pausedRemainingMs),
    pausedRemainingMs: null,
  };
}
