import { storage } from '#imports';
import type {
  AuthRecord,
  BlockEntry,
  CountdownTimerState,
  PomodoroState,
  ScheduleWindow,
  TempUnblock,
} from './types';
import { DEFAULT_SCHEDULE } from './schedule';
import { DEFAULT_POMODORO } from './pomodoro';
import { DEFAULT_TIMER } from './timer';

export const blocklistItem = storage.defineItem<BlockEntry[]>('local:blocklist', {
  fallback: [],
});

export const scheduleItem = storage.defineItem<ScheduleWindow[]>('local:schedule', {
  fallback: DEFAULT_SCHEDULE,
});

export const pomodoroItem = storage.defineItem<PomodoroState>('local:pomodoro', {
  fallback: DEFAULT_POMODORO,
});

export const timerItem = storage.defineItem<CountdownTimerState>('local:countdownTimer', {
  fallback: DEFAULT_TIMER,
});

export const tempUnblocksItem = storage.defineItem<TempUnblock[]>('local:tempUnblocks', {
  fallback: [],
});

export const authItem = storage.defineItem<AuthRecord | null>('local:auth', {
  fallback: null,
});

/** Default minutes a password-granted unblock lasts. */
export const unblockMinutesItem = storage.defineItem<number>('local:unblockMinutes', {
  fallback: 5,
});

/** Session-scoped: decrypted masked domains, cleared when the browser restarts. */
export const unmaskedDomainsItem = storage.defineItem<string[]>('session:unmaskedDomains', {
  fallback: [],
});
