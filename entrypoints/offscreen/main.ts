import { OFFSCREEN_MESSAGE, type OffscreenMessage } from '@/lib/messages';

browser.runtime.onMessage.addListener((msg: OffscreenMessage) => {
  if (msg.type !== OFFSCREEN_MESSAGE.PLAY_SOUND) return;
  const url = browser.runtime.getURL(`/sounds/${msg.sound}.wav`);
  const audio = new Audio(url);
  void audio.play();
});
