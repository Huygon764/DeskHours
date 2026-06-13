/** Background worker message type literals. */
export const BG_MESSAGE = {
  SYNC_BLOCKER: 'SYNC_BLOCKER',
  GRANT_UNBLOCK: 'GRANT_UNBLOCK',
  GET_PENDING_BLOCKED_URL: 'GET_PENDING_BLOCKED_URL',
  POMODORO_START: 'POMODORO_START',
  POMODORO_STOP: 'POMODORO_STOP',
  POMODORO_PAUSE: 'POMODORO_PAUSE',
  POMODORO_RESUME: 'POMODORO_RESUME',
} as const;

/** Offscreen document message type literals. */
export const OFFSCREEN_MESSAGE = {
  PLAY_SOUND: 'PLAY_SOUND',
  STOP_SOUND: 'STOP_SOUND',
} as const;

/** Messages sent TO the background worker. */
export type BgMessage =
  | { type: typeof BG_MESSAGE.SYNC_BLOCKER }
  | { type: typeof BG_MESSAGE.GRANT_UNBLOCK; pattern: string }
  | { type: typeof BG_MESSAGE.GET_PENDING_BLOCKED_URL }
  | { type: typeof BG_MESSAGE.POMODORO_START }
  | { type: typeof BG_MESSAGE.POMODORO_STOP }
  | { type: typeof BG_MESSAGE.POMODORO_PAUSE }
  | { type: typeof BG_MESSAGE.POMODORO_RESUME };

/** Messages sent TO the offscreen document. */
export type OffscreenMessage =
  | {
      type: typeof OFFSCREEN_MESSAGE.PLAY_SOUND;
      sound: 'work-start' | 'rest-start';
      /** How many times to play the sound in sequence. Defaults to 1. */
      repeats?: number;
    }
  | { type: typeof OFFSCREEN_MESSAGE.STOP_SOUND };

export async function sendBg(msg: BgMessage): Promise<void> {
  await browser.runtime.sendMessage(msg);
}

const BG_RETRIES = 4;
const BG_RETRY_MS = 150;

async function sendBgWithRetry(msg: BgMessage): Promise<boolean> {
  for (let attempt = 0; attempt < BG_RETRIES; attempt++) {
    try {
      await sendBg(msg);
      return true;
    } catch {
      if (attempt < BG_RETRIES - 1) {
        await new Promise((r) => setTimeout(r, BG_RETRY_MS));
      }
    }
  }
  return false;
}

/** Ask the background worker to refresh DNR rules. Retries if the SW was asleep. */
export async function syncBlockerSafe(): Promise<boolean> {
  return sendBgWithRetry({ type: BG_MESSAGE.SYNC_BLOCKER });
}

/** Grant a temp unblock via the background worker. Retries if the SW was asleep. */
export async function grantUnblockSafe(pattern: string): Promise<boolean> {
  return sendBgWithRetry({ type: BG_MESSAGE.GRANT_UNBLOCK, pattern });
}

/** Read the blocked destination URL captured before DNR redirect. */
export async function getPendingBlockedUrlSafe(): Promise<string | null> {
  for (let attempt = 0; attempt < 10; attempt++) {
    try {
      const url = await browser.runtime.sendMessage({ type: BG_MESSAGE.GET_PENDING_BLOCKED_URL });
      if (typeof url === 'string' && url.length > 0) return url;
    } catch {
      /* retry while background stores pending URL */
    }
    if (attempt < 9) {
      await new Promise((r) => setTimeout(r, 50));
    }
  }
  return null;
}
