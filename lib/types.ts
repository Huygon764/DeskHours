/** A single weekly time window during which blocking is active. */
export interface ScheduleWindow {
  /** ISO weekday numbers, Mon=1 ... Sun=7. */
  days: number[];
  /** "HH:MM" 24h, inclusive start. */
  start: string;
  /** "HH:MM" 24h, exclusive end. */
  end: string;
}

/** One blocked site. `domain` is plaintext for normal entries; for masked
 *  entries it holds the AES-GCM ciphertext and plaintext lives only in memory. */
export interface BlockEntry {
  id: string;
  /** Bare registrable domain, e.g. "facebook.com" (no scheme/www/path).
   *  When `masked` is true this is the encrypted payload string instead. */
  domain: string;
  masked: boolean;
}

/** A temporary password-granted unblock for one domain. */
export interface TempUnblock {
  domain: string;
  /** epoch ms when the unblock expires. */
  expiresAt: number;
}

/** Stored material to verify the master password (no key is ever stored). */
export interface AuthRecord {
  /** base64 PBKDF2-HMAC-SHA256 output. */
  hash: string;
  /** base64 random salt. */
  salt: string;
  iterations: number;
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
  /** epoch ms when the current phase ends; null when idle. */
  phaseEndsAt: number | null;
}
