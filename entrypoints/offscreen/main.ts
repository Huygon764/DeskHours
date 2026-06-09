import { OFFSCREEN_MESSAGE, type OffscreenMessage } from '@/lib/messages';

const GAP_BETWEEN_REPEATS_MS = 300;
const PLAY_TIMEOUT_MS = 8_000;

let cancelPlayback = false;
let currentAudio: HTMLAudioElement | null = null;

function clampRepeats(repeats: number | undefined): number {
  return Math.max(1, Math.min(10, Math.round(repeats ?? 1)));
}

function stopPlayback(): void {
  cancelPlayback = true;
  if (currentAudio) {
    currentAudio.pause();
    currentAudio.currentTime = 0;
    currentAudio = null;
  }
}

function playOnce(url: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const audio = new Audio(url);
    currentAudio = audio;
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      if (currentAudio === audio) currentAudio = null;
      resolve();
    };
    audio.onended = finish;
    audio.onerror = () => {
      if (settled) return;
      settled = true;
      if (currentAudio === audio) currentAudio = null;
      reject(new Error('Audio playback failed'));
    };
    void audio.play().catch(reject);
    setTimeout(finish, PLAY_TIMEOUT_MS);
  });
}

async function playRepeated(url: string, repeats: number): Promise<void> {
  cancelPlayback = false;
  for (let i = 0; i < repeats; i++) {
    if (cancelPlayback) return;
    await playOnce(url);
    if (cancelPlayback || i >= repeats - 1) return;
    await new Promise((resolve) => setTimeout(resolve, GAP_BETWEEN_REPEATS_MS));
  }
}

browser.runtime.onMessage.addListener((msg: OffscreenMessage) => {
  if (msg.type === OFFSCREEN_MESSAGE.STOP_SOUND) {
    stopPlayback();
    return;
  }
  if (msg.type !== OFFSCREEN_MESSAGE.PLAY_SOUND) return;
  const url = browser.runtime.getURL(`/sounds/${msg.sound}.wav`);
  return playRepeated(url, clampRepeats(msg.repeats));
});
