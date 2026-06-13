import { OFFSCREEN_MESSAGE, type OffscreenMessage, clampRepeats } from '@/lib/messages';

const GAP_BETWEEN_REPEATS_MS = 300;
const PLAY_TIMEOUT_MS = 8_000;

// A monotonic token identifies the active playback run. Starting a new run or
// stopping bumps it, so any older loop sees a mismatch and bows out — this keeps
// exactly one audio stream alive even if PLAY_SOUND messages overlap.
let playGeneration = 0;
let currentAudio: HTMLAudioElement | null = null;
let settleCurrent: (() => void) | null = null;

function stopPlayback(): void {
  playGeneration++;
  if (currentAudio) {
    currentAudio.pause();
    currentAudio.currentTime = 0;
    currentAudio = null;
  }
  // Settle the in-flight playOnce immediately instead of waiting for the timeout.
  settleCurrent?.();
  settleCurrent = null;
}

function playOnce(url: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const audio = new Audio(url);
    currentAudio = audio;
    let settled = false;
    let timeout: ReturnType<typeof setTimeout>;
    const done = (action: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      if (currentAudio === audio) currentAudio = null;
      if (settleCurrent === finish) settleCurrent = null;
      action();
    };
    const finish = () => done(resolve);
    settleCurrent = finish;
    audio.onended = finish;
    audio.onerror = () => done(() => reject(new Error('Audio playback failed')));
    void audio.play().catch((err) => done(() => reject(err)));
    timeout = setTimeout(finish, PLAY_TIMEOUT_MS);
  });
}

async function playRepeated(url: string, repeats: number): Promise<void> {
  stopPlayback(); // cancel any prior run and claim a fresh generation
  const gen = playGeneration;
  for (let i = 0; i < repeats; i++) {
    if (gen !== playGeneration) return; // superseded by a newer play/stop
    await playOnce(url);
    if (gen !== playGeneration || i >= repeats - 1) return;
    await new Promise((resolve) => setTimeout(resolve, GAP_BETWEEN_REPEATS_MS));
  }
}

browser.runtime.onMessage.addListener((msg: OffscreenMessage) => {
  if (msg.type === OFFSCREEN_MESSAGE.STOP_SOUND) {
    stopPlayback();
    return;
  }
  if (msg.type !== OFFSCREEN_MESSAGE.PLAY_SOUND) return;
  // Ack on delivery: run playback detached so the sender's sendMessage resolves
  // immediately rather than waiting out the full repeat sequence.
  const url = browser.runtime.getURL(`/sounds/${msg.sound}.wav`);
  void playRepeated(url, clampRepeats(msg.repeats)).catch((err) =>
    console.error('[deskhours] offscreen playback failed:', err),
  );
});
