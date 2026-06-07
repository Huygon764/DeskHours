import type { ScheduleWindow } from './types';

export const DEFAULT_SCHEDULE: ScheduleWindow[] = [
  { days: [1, 2, 3, 4, 5], start: '09:00', end: '12:00' },
  { days: [1, 2, 3, 4, 5], start: '13:00', end: '16:00' },
];

/** Plain copy for storage — do not structuredClone Svelte $state proxies. */
export function cloneSchedule(windows: ScheduleWindow[]): ScheduleWindow[] {
  return windows.map((w) => ({
    days: [...w.days],
    start: w.start.slice(0, 5),
    end: w.end.slice(0, 5),
  }));
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
