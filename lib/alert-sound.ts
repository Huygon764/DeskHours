import { OFFSCREEN_MESSAGE, type OffscreenMessage } from './messages';

const OFFSCREEN_URL = 'offscreen.html';
const OFFSCREEN_WARMUP_MS = 150;
const PLAY_RETRIES = 6;
const PLAY_RETRY_MS = 100;

export type AlertSound = 'work-start' | 'rest-start';

async function ensureOffscreenAudio(): Promise<void> {
  if (await browser.offscreen.hasDocument()) return;
  await browser.offscreen.createDocument({
    url: OFFSCREEN_URL,
    reasons: ['AUDIO_PLAYBACK'],
    justification: 'Play timer and focus alarm sounds',
  });
  await new Promise((resolve) => setTimeout(resolve, OFFSCREEN_WARMUP_MS));
}

/** Play a bundled alert wav via the offscreen audio document. */
export async function playAlertSound(sound: AlertSound, repeats = 1): Promise<void> {
  await ensureOffscreenAudio();
  const msg: OffscreenMessage = {
    type: OFFSCREEN_MESSAGE.PLAY_SOUND,
    sound,
    repeats: Math.max(1, Math.min(10, Math.round(repeats))),
  };
  let lastError: unknown;
  for (let attempt = 0; attempt < PLAY_RETRIES; attempt++) {
    try {
      await browser.runtime.sendMessage(msg);
      return;
    } catch (err) {
      lastError = err;
      await new Promise((resolve) => setTimeout(resolve, PLAY_RETRY_MS));
    }
  }
  console.error('[site-blocker] playAlertSound failed after retries:', lastError);
}

/** Stop any in-progress offscreen alert playback. */
export async function stopAlertSound(): Promise<void> {
  if (!(await browser.offscreen.hasDocument())) return;
  const msg: OffscreenMessage = { type: OFFSCREEN_MESSAGE.STOP_SOUND };
  try {
    await browser.runtime.sendMessage(msg);
  } catch {
    // Offscreen may already be closing.
  }
}
