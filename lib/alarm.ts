import type { AlarmItem } from './types';
import { isoWeekday } from './schedule';

export const MAX_ALARMS = 20;

export const DEFAULT_ALARM: Omit<AlarmItem, 'id' | 'date'> = {
  label: '',
  time: '09:00',
  repeat: 'once',
  days: [],
  enabled: true,
  lastFiredKey: null,
};

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/** Local "YYYY-MM-DD" for a Date. */
export function localDateKey(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/** Local "HH:MM" for a Date. */
export function localTimeKey(d: Date): string {
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

/** "YYYY-MM-DD HH:MM" for the current minute in local time. */
export function fireKey(now: number): string {
  const d = new Date(now);
  return `${localDateKey(d)} ${localTimeKey(d)}`;
}

/** A fresh one-time alarm dated for the current local day. */
export function newAlarm(now: number): AlarmItem {
  const d = new Date(now);
  return {
    id: crypto.randomUUID(),
    ...DEFAULT_ALARM,
    date: localDateKey(d),
  };
}

/** Backfill/validate a stored alarm record. */
export function normalizeAlarm(raw: Partial<AlarmItem>): AlarmItem {
  const repeat: AlarmItem['repeat'] = raw.repeat === 'weekly' ? 'weekly' : 'once';
  return {
    id: String(raw.id ?? ''),
    label: typeof raw.label === 'string' ? raw.label : '',
    time: typeof raw.time === 'string' ? raw.time : DEFAULT_ALARM.time,
    repeat,
    days: Array.isArray(raw.days) ? raw.days.filter((n) => n >= 1 && n <= 7) : [],
    date: typeof raw.date === 'string' ? raw.date : null,
    enabled: raw.enabled ?? true,
    lastFiredKey: typeof raw.lastFiredKey === 'string' ? raw.lastFiredKey : null,
  };
}

function parseHhMm(time: string): { h: number; m: number } | null {
  const match = /^(\d{2}):(\d{2})$/.exec(time);
  if (!match) return null;
  const h = Number(match[1]);
  const m = Number(match[2]);
  if (h > 23 || m > 59) return null;
  return { h, m };
}

/** True when the alarm should fire at the given instant. */
export function isAlarmDue(alarm: AlarmItem, now: number): boolean {
  if (!alarm.enabled) return false;
  const d = new Date(now);
  if (localTimeKey(d) !== alarm.time) return false;
  if (alarm.lastFiredKey === fireKey(now)) return false;
  if (alarm.repeat === 'weekly') {
    return alarm.days.includes(isoWeekday(d));
  }
  return alarm.date != null && alarm.date === localDateKey(d);
}

export function dueAlarms(alarms: AlarmItem[], now: number): AlarmItem[] {
  return alarms.filter((a) => isAlarmDue(a, now));
}

/** Epoch ms of the next time this alarm will fire, or null if it never will. */
export function nextOccurrence(alarm: AlarmItem, now: number): number | null {
  if (!alarm.enabled) return null;
  const hm = parseHhMm(alarm.time);
  if (!hm) return null;
  const base = new Date(now);

  if (alarm.repeat === 'once') {
    if (!alarm.date) return null;
    const [y, mo, day] = alarm.date.split('-').map(Number);
    const at = new Date(y, mo - 1, day, hm.h, hm.m, 0, 0).getTime();
    return at > now ? at : null;
  }

  for (let offset = 0; offset <= 7; offset++) {
    const cand = new Date(
      base.getFullYear(),
      base.getMonth(),
      base.getDate() + offset,
      hm.h,
      hm.m,
      0,
      0,
    );
    if (cand.getTime() > now && alarm.days.includes(isoWeekday(cand))) {
      return cand.getTime();
    }
  }
  return null;
}
