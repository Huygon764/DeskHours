import { normalizeAlarm } from './alarm';
import { cloneBlocklist } from './blocklist';
import { cloneSchedule } from './schedule';
import { DEFAULT_POMODORO } from './pomodoro';
import { DEFAULT_TIMER, normalizeTimerState } from './timer';
import { POMODORO_ALARM } from './pomodoro-controller';
import { TIMER_ALARM } from './timer-controller';
import {
  alarmsItem,
  authItem,
  blocklistItem,
  localeItem,
  pomodoroItem,
  scheduleItem,
  tempUnblocksItem,
  themeItem,
  timerItem,
  unblockMinutesItem,
  unmaskedDomainsItem,
} from './storage';
import type { LocalePreference } from './locale';
import type { ThemePreference } from './theme';
import type {
  AlarmItem,
  AuthRecord,
  BlockEntry,
  BlockEntryKind,
  CountdownTimerState,
  PomodoroState,
  ScheduleWindow,
} from './types';

export const BACKUP_APP_ID = 'deskhours';
/** Pre-rebrand exports; still accepted on import. */
export const LEGACY_BACKUP_APP_ID = 'site-blocker';
export const BACKUP_SCHEMA_VERSION = 2;

export interface PomodoroPrefs {
  workMinutes: number;
  restMinutes: number;
}

export interface TimerPrefs {
  durationSeconds: number;
  soundEnabled: boolean;
}

export interface BackupData {
  blocklist: BlockEntry[];
  schedule: ScheduleWindow[];
  auth: AuthRecord | null;
  unblockMinutes: number;
  theme: ThemePreference;
  locale: LocalePreference;
  pomodoro: PomodoroPrefs;
  timer: TimerPrefs;
  alarms: AlarmItem[];
}

export interface BackupFile {
  schemaVersion: number;
  app: string;
  exportedAt: string;
  data: BackupData;
}

export interface BackupSummary {
  sites: number;
  keywords: number;
  hidden: number;
  scheduleWindows: number;
  hasPassword: boolean;
}

export class BackupError extends Error {
  constructor(
    message: string,
    readonly code:
      | 'invalid_json'
      | 'invalid_format'
      | 'unsupported_app'
      | 'newer_schema'
      | 'masked_without_auth'
      | 'invalid_data',
  ) {
    super(message);
    this.name = 'BackupError';
  }
}

const THEME_PREFS: ThemePreference[] = ['system', 'light', 'dark'];
const LOCALE_PREFS: LocalePreference[] = ['system', 'en', 'vi'];

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function isAuthRecord(v: unknown): v is AuthRecord {
  if (!isRecord(v)) return false;
  return (
    typeof v.hash === 'string' &&
    typeof v.salt === 'string' &&
    typeof v.iterations === 'number' &&
    Number.isFinite(v.iterations)
  );
}

function isBlockEntry(v: unknown): v is BlockEntry {
  if (!isRecord(v)) return false;
  const kind = v.kind;
  if (kind != null && kind !== 'site' && kind !== 'keyword') return false;
  if (v.enabled != null && typeof v.enabled !== 'boolean') return false;
  return (
    typeof v.id === 'string' &&
    typeof v.domain === 'string' &&
    typeof v.masked === 'boolean'
  );
}

function isScheduleWindow(v: unknown): v is ScheduleWindow {
  if (!isRecord(v)) return false;
  if (!Array.isArray(v.days) || !v.days.every((d) => typeof d === 'number')) return false;
  return typeof v.start === 'string' && typeof v.end === 'string';
}

function isPomodoroPrefs(v: unknown): v is PomodoroPrefs {
  if (!isRecord(v)) return false;
  return (
    Number.isFinite(v.workMinutes) &&
    Number.isFinite(v.restMinutes)
  );
}

function isTimerPrefs(v: unknown): v is TimerPrefs {
  if (!isRecord(v)) return false;
  return Number.isFinite(v.durationSeconds) && typeof v.soundEnabled === 'boolean';
}

function entryKind(e: BlockEntry): BlockEntryKind {
  return e.kind ?? 'site';
}

export function summarizeBackupData(data: BackupData): BackupSummary {
  let sites = 0;
  let keywords = 0;
  let hidden = 0;
  for (const e of data.blocklist) {
    if (e.masked) {
      hidden++;
      continue;
    }
    if (entryKind(e) === 'keyword') keywords++;
    else sites++;
  }
  return {
    sites,
    keywords,
    hidden,
    scheduleWindows: data.schedule.length,
    hasPassword: data.auth != null,
  };
}

export function validateBackupData(raw: unknown): BackupData {
  if (!isRecord(raw)) throw new BackupError('Backup data is not an object', 'invalid_data');

  const blocklist = raw.blocklist;
  const schedule = raw.schedule;
  if (!Array.isArray(blocklist) || !blocklist.every(isBlockEntry)) {
    throw new BackupError('Invalid blocklist in backup', 'invalid_data');
  }
  if (!Array.isArray(schedule) || !schedule.every(isScheduleWindow)) {
    throw new BackupError('Invalid schedule in backup', 'invalid_data');
  }

  const auth = raw.auth;
  if (auth != null && !isAuthRecord(auth)) {
    throw new BackupError('Invalid password record in backup', 'invalid_data');
  }

  if (typeof raw.unblockMinutes !== 'number' || !Number.isFinite(raw.unblockMinutes)) {
    throw new BackupError('Invalid unblock minutes in backup', 'invalid_data');
  }

  const theme = raw.theme;
  if (typeof theme !== 'string' || !THEME_PREFS.includes(theme as ThemePreference)) {
    throw new BackupError('Invalid theme in backup', 'invalid_data');
  }

  const locale = raw.locale;
  if (typeof locale !== 'string' || !LOCALE_PREFS.includes(locale as LocalePreference)) {
    throw new BackupError('Invalid locale in backup', 'invalid_data');
  }

  if (!isPomodoroPrefs(raw.pomodoro)) {
    throw new BackupError('Invalid pomodoro settings in backup', 'invalid_data');
  }
  if (!isTimerPrefs(raw.timer)) {
    throw new BackupError('Invalid timer settings in backup', 'invalid_data');
  }

  const alarms = Array.isArray(raw.alarms) ? (raw.alarms as Partial<AlarmItem>[]).map(normalizeAlarm) : [];

  const hasMasked = blocklist.some((e) => e.masked);
  if (hasMasked && auth == null) {
    throw new BackupError('Backup contains hidden entries but no password record', 'masked_without_auth');
  }

  return {
    blocklist: cloneBlocklist(blocklist as BlockEntry[]),
    schedule: cloneSchedule(schedule as ScheduleWindow[]),
    auth: auth as AuthRecord | null,
    unblockMinutes: raw.unblockMinutes,
    theme: theme as ThemePreference,
    locale: locale as LocalePreference,
    pomodoro: raw.pomodoro as PomodoroPrefs,
    timer: raw.timer as TimerPrefs,
    alarms,
  };
}

/** Bring an older backup payload up to the current schema before validation.
 *  v2 added `alarms`; older payloads are backfilled with an empty list. */
function migrateBackup(schemaVersion: number, data: unknown): unknown {
  if (schemaVersion < 1) {
    throw new BackupError('Unsupported backup schema version', 'invalid_format');
  }
  if (schemaVersion < 2 && isRecord(data) && !('alarms' in data)) {
    return { ...data, alarms: [] };
  }
  return data;
}

export function parseBackupJson(text: string): BackupFile {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new BackupError('File is not valid JSON', 'invalid_json');
  }

  if (!isRecord(parsed)) throw new BackupError('Backup file is not an object', 'invalid_format');

  const app = parsed.app;
  if (app !== BACKUP_APP_ID && app !== LEGACY_BACKUP_APP_ID) {
    throw new BackupError(`Not a ${BACKUP_APP_ID} backup file`, 'unsupported_app');
  }

  const schemaVersion = parsed.schemaVersion;
  if (typeof schemaVersion !== 'number' || !Number.isInteger(schemaVersion)) {
    throw new BackupError('Missing backup schema version', 'invalid_format');
  }
  if (schemaVersion > BACKUP_SCHEMA_VERSION) {
    throw new BackupError('Backup was made with a newer extension version', 'newer_schema');
  }

  if (typeof parsed.exportedAt !== 'string') {
    throw new BackupError('Missing export timestamp', 'invalid_format');
  }

  const data = validateBackupData(migrateBackup(schemaVersion, parsed.data));
  return {
    schemaVersion,
    app: BACKUP_APP_ID,
    exportedAt: parsed.exportedAt,
    data,
  };
}

function pomodoroFromPrefs(prefs: PomodoroPrefs): PomodoroState {
  return {
    ...DEFAULT_POMODORO,
    workMinutes: prefs.workMinutes,
    restMinutes: prefs.restMinutes,
  };
}

function timerFromPrefs(prefs: TimerPrefs): CountdownTimerState {
  return normalizeTimerState({
    ...DEFAULT_TIMER,
    durationSeconds: prefs.durationSeconds,
    soundEnabled: prefs.soundEnabled,
    active: false,
    finished: false,
    endsAt: null,
    pausedRemainingMs: null,
  });
}

export async function buildBackupFile(): Promise<BackupFile> {
  const [blocklist, schedule, auth, unblockMinutes, theme, locale, pomodoro, timer, alarms] =
    await Promise.all([
      blocklistItem.getValue(),
      scheduleItem.getValue(),
      authItem.getValue(),
      unblockMinutesItem.getValue(),
      themeItem.getValue(),
      localeItem.getValue(),
      pomodoroItem.getValue(),
      timerItem.getValue(),
      alarmsItem.getValue(),
    ]);

  const normalizedTimer = normalizeTimerState(timer);

  return {
    schemaVersion: BACKUP_SCHEMA_VERSION,
    app: BACKUP_APP_ID,
    exportedAt: new Date().toISOString(),
    data: {
      blocklist: cloneBlocklist(blocklist),
      schedule: cloneSchedule(schedule),
      auth,
      unblockMinutes,
      theme,
      locale,
      pomodoro: {
        workMinutes: pomodoro.workMinutes,
        restMinutes: pomodoro.restMinutes,
      },
      timer: {
        durationSeconds: normalizedTimer.durationSeconds,
        soundEnabled: normalizedTimer.soundEnabled,
      },
      alarms: alarms.map(normalizeAlarm),
    },
  };
}

export function backupFileToJson(file: BackupFile): string {
  return JSON.stringify(file, null, 2);
}

export function backupDownloadName(exportedAt: string): string {
  const day = exportedAt.slice(0, 10);
  return `deskhours-backup-${day}.json`;
}

async function clearActiveTimers(): Promise<void> {
  await Promise.all([
    browser.alarms.clear(POMODORO_ALARM),
    browser.alarms.clear(TIMER_ALARM),
  ]);
}

/** Replace local settings from a validated backup. Clears session state and active timers. */
export async function applyBackupData(data: BackupData): Promise<void> {
  await Promise.all([
    blocklistItem.setValue(data.blocklist),
    scheduleItem.setValue(data.schedule),
    authItem.setValue(data.auth),
    unblockMinutesItem.setValue(data.unblockMinutes),
    themeItem.setValue(data.theme),
    localeItem.setValue(data.locale),
    pomodoroItem.setValue(pomodoroFromPrefs(data.pomodoro)),
    timerItem.setValue(timerFromPrefs(data.timer)),
    alarmsItem.setValue(data.alarms.map(normalizeAlarm)),
    tempUnblocksItem.setValue([]),
    unmaskedDomainsItem.setValue([]),
    clearActiveTimers(),
  ]);
}
