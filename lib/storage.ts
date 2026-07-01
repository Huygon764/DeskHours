import { storage } from '#imports';
import type {
  AlarmItem,
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
import type { ThemePreference } from './theme';
import type { LocalePreference } from './locale';

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

export const alarmsItem = storage.defineItem<AlarmItem[]>('local:alarms', {
  fallback: [],
});

/** Ids of alarms that have fired and not yet been dismissed. Drives the icon
 *  badge and the popup ringing banner. Transient runtime state — never added to
 *  AlarmItem and never backed up. */
export const ringingAlarmsItem = storage.defineItem<string[]>('local:ringingAlarms', {
  fallback: [],
});

export const tempUnblocksItem = storage.defineItem<TempUnblock[]>('local:tempUnblocks', {
  fallback: [],
});

/** Epoch-ms of each successful unblock grant; drives the escalating wait. Pruned to
 *  the current local day so the wait resets at midnight. */
export const unblockTimestampsItem = storage.defineItem<number[]>('local:unblockTimestamps', {
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

/** UI color scheme preference; system follows OS dark mode. */
export const themeItem = storage.defineItem<ThemePreference>('local:theme', {
  fallback: 'system',
});

/** UI language; system follows the browser locale. */
export const localeItem = storage.defineItem<LocalePreference>('local:locale', {
  fallback: 'system',
});
