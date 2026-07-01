/** A single weekly time window during which blocking is active. */
export interface ScheduleWindow {
  /** ISO weekday numbers, Mon=1 ... Sun=7. */
  days: number[];
  /** "HH:MM" 24h, inclusive start. */
  start: string;
  /** "HH:MM" 24h, exclusive end. */
  end: string;
}

export type BlockEntryKind = 'site' | 'keyword';

/** One blocked site, URL path pattern, or URL keyword. `domain` is plaintext for normal entries;
 *  for masked entries it holds the AES-GCM ciphertext and plaintext lives only in memory. */
export interface BlockEntry {
  id: string;
  /** Site/path pattern or URL keyword text (when `kind` is `keyword`).
   *  When `masked` is true this is the encrypted payload string instead. */
  domain: string;
  masked: boolean;
  /** `site` (default) blocks hosts/paths; `keyword` blocks URLs containing the text. */
  kind?: BlockEntryKind;
  /** When false the entry stays in the list but is not enforced. Defaults to true. */
  enabled?: boolean;
}

/** A temporary password-granted unblock for one pattern. */
export interface TempUnblock {
  pattern: string;
  /** epoch ms when the unblock expires. */
  expiresAt: number;
}

/** Stored material to verify the master password (no key is ever stored). */
export interface AuthRecord {
  /** base64 PBKDF2-HMAC-SHA256 output. */
  hash: string;
  /** base64 random salt for the verification hash. */
  salt: string;
  iterations: number;
  /** base64 salt, independent of `salt`, used to derive the AES masking key so the
   *  stored hash is never the key itself. Absent on legacy records (migrated on unlock). */
  encKeySalt: string;
}

/** AES-GCM encrypted payload, all base64. */
export interface EncryptedPayload {
  iv: string;
  ciphertext: string;
}

export type PomodoroPhase = 'idle' | 'work' | 'rest';

export interface PomodoroState {
  workMinutes: number;
  restMinutes: number;
  phase: PomodoroPhase;
  /** epoch ms when the current phase ends; null when idle or paused. */
  phaseEndsAt: number | null;
  /** ms left when paused; null while the countdown is running. */
  pausedRemainingMs: number | null;
}

export interface CountdownTimerState {
  /** Preset length in seconds while idle. */
  durationSeconds: number;
  /** True while counting down (including when paused). */
  active: boolean;
  /** True after the countdown ends until the user resets. */
  finished: boolean;
  /** epoch ms when the countdown ends; null when idle or paused. */
  endsAt: number | null;
  /** ms left when paused; null while the countdown is running. */
  pausedRemainingMs: number | null;
  soundEnabled: boolean;
}

/** A user-defined reminder that fires at a wall-clock time. */
export interface AlarmItem {
  id: string;
  /** Custom label shown in the notification. */
  label: string;
  /** "HH:MM" 24h, local time. */
  time: string;
  /** 'once' fires on `date`; 'weekly' fires on each weekday in `days`. */
  repeat: 'once' | 'weekly';
  /** ISO weekday numbers Mon=1..Sun=7. Used only when repeat='weekly'. */
  days: number[];
  /** "YYYY-MM-DD" local date. Used only when repeat='once'. */
  date: string | null;
  /** When false the alarm stays in the list but never fires. */
  enabled: boolean;
  /** "YYYY-MM-DD HH:MM" of the last fire; dedupes within a minute and across
   *  service-worker restarts. Null until first fire. */
  lastFiredKey: string | null;
}
