import { isFocusBlockActive } from './pomodoro';
import type { PomodoroState, ScheduleWindow } from './types';

const WEEKDAYS = [1, 2, 3, 4, 5];
const WEEKENDS = [6, 7];
const ALL_DAYS = [1, 2, 3, 4, 5, 6, 7];

export interface SchedulePreset {
  id: string;
  windows: ScheduleWindow[];
}

export const SCHEDULE_PRESETS: SchedulePreset[] = [
  {
    id: 'office-hours',
    windows: [
      { days: [...WEEKDAYS], start: '08:00', end: '12:00' },
      { days: [...WEEKDAYS], start: '13:30', end: '17:00' },
    ],
  },
  {
    id: 'full-workday',
    windows: [{ days: [...WEEKDAYS], start: '08:00', end: '17:00' }],
  },
  {
    id: 'evenings',
    windows: [{ days: [...WEEKDAYS], start: '18:00', end: '22:00' }],
  },
  {
    id: 'weekends',
    windows: [{ days: [...WEEKENDS], start: '08:00', end: '22:00' }],
  },
  {
    id: 'all-day-weekdays',
    windows: [{ days: [...WEEKDAYS], start: '00:00', end: '23:59' }],
  },
  {
    id: 'always-on',
    windows: [{ days: [...ALL_DAYS], start: '00:00', end: '23:59' }],
  },
];

/** Plain copy for storage — do not structuredClone Svelte $state proxies. */
export function cloneSchedule(windows: ScheduleWindow[]): ScheduleWindow[] {
  return windows.map((w) => ({
    days: [...w.days],
    start: w.start.slice(0, 5),
    end: w.end.slice(0, 5),
  }));
}

export const DEFAULT_SCHEDULE: ScheduleWindow[] = cloneSchedule(SCHEDULE_PRESETS[0].windows);

function normalizeWindow(w: ScheduleWindow): string {
  const days = [...w.days].sort((a, b) => a - b).join(',');
  return `${days}|${w.start.slice(0, 5)}|${w.end.slice(0, 5)}`;
}

/** True when two schedules match after normalizing day order and times. */
export function schedulesEqual(a: ScheduleWindow[], b: ScheduleWindow[]): boolean {
  if (a.length !== b.length) return false;
  const left = a.map(normalizeWindow).sort();
  const right = b.map(normalizeWindow).sort();
  return left.every((v, i) => v === right[i]);
}

/** Preset id when `windows` matches a built-in preset, else null. */
export function matchingPresetId(windows: ScheduleWindow[]): string | null {
  for (const preset of SCHEDULE_PRESETS) {
    if (schedulesEqual(windows, preset.windows)) return preset.id;
  }
  return null;
}

/** Minutes since midnight for "HH:MM". */
function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

/** ISO weekday: Mon=1 ... Sun=7 (JS getDay() is Sun=0). */
function isoWeekday(d: Date): number {
  const js = d.getDay();
  return js === 0 ? 7 : js;
}

/** True if `at` falls inside any window. Start inclusive, end exclusive. */
export function isBlockingActive(schedule: ScheduleWindow[], at: number): boolean {
  const d = new Date(at);
  const day = isoWeekday(d);
  const minutes = d.getHours() * 60 + d.getMinutes();
  return schedule.some(
    (w) =>
      w.days.includes(day) &&
      minutes >= toMinutes(w.start) &&
      minutes < toMinutes(w.end),
  );
}

/** True when the blocklist should be enforced (schedule window or focus work phase). */
export function isSiteBlockingEnabled(
  schedule: ScheduleWindow[],
  at: number,
  pomodoro: PomodoroState,
): boolean {
  return isBlockingActive(schedule, at) || isFocusBlockActive(pomodoro);
}
