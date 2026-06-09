/** Background worker message type literals. */
export const BG_MESSAGE = {
  SYNC_BLOCKER: 'SYNC_BLOCKER',
  GRANT_UNBLOCK: 'GRANT_UNBLOCK',
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

const SYNC_RETRIES = 4;
const SYNC_RETRY_MS = 150;

/** Ask the background worker to refresh DNR rules. Retries if the SW was asleep. */
export async function syncBlockerSafe(): Promise<boolean> {
  for (let attempt = 0; attempt < SYNC_RETRIES; attempt++) {
    try {
      await sendBg({ type: BG_MESSAGE.SYNC_BLOCKER });
      return true;
    } catch {
      if (attempt < SYNC_RETRIES - 1) {
        await new Promise((r) => setTimeout(r, SYNC_RETRY_MS));
      }
    }
  }
  return false;
}
