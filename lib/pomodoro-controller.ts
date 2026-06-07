import { pomodoroItem } from './storage';
import { nextPhase } from './pomodoro';
import { OFFSCREEN_MESSAGE, type OffscreenMessage } from './messages';

export const POMODORO_ALARM = 'pomodoro-phase-end';
const OFFSCREEN_URL = 'offscreen.html';

async function scheduleAlarm(at: number): Promise<void> {
  await browser.alarms.create(POMODORO_ALARM, { when: at });
}

/** idle -> work, persist, schedule the phase-end alarm. */
export async function startPomodoro(): Promise<void> {
  const current = await pomodoroItem.getValue();
  const started = nextPhase({ ...current, phase: 'idle' }, Date.now());
  await pomodoroItem.setValue(started);
  if (started.phaseEndsAt) await scheduleAlarm(started.phaseEndsAt);
}

/** Reset to idle, clear the alarm. */
export async function stopPomodoro(): Promise<void> {
  const current = await pomodoroItem.getValue();
  await pomodoroItem.setValue({ ...current, phase: 'idle', phaseEndsAt: null });
  await browser.alarms.clear(POMODORO_ALARM);
}

/** Called when the phase-end alarm fires: advance, alert, reschedule. */
export async function onPhaseAlarm(): Promise<void> {
  const current = await pomodoroItem.getValue();
  if (current.phase === 'idle') return;
  const advanced = nextPhase(current, Date.now());
  await pomodoroItem.setValue(advanced);
  await alert(advanced.phase === 'work' ? 'work-start' : 'rest-start');
  if (advanced.phaseEndsAt) await scheduleAlarm(advanced.phaseEndsAt);
}

async function alert(sound: 'work-start' | 'rest-start'): Promise<void> {
  await showNotification(sound);
  await playSound(sound);
}

async function showNotification(sound: 'work-start' | 'rest-start'): Promise<void> {
  const isWork = sound === 'work-start';
  await browser.notifications.create({
    type: 'basic',
    iconUrl: browser.runtime.getURL('/icon/128.png'),
    title: isWork ? 'Back to work' : 'Time to rest',
    message: isWork ? 'Work session started.' : 'Take a short break.',
  });
}

async function playSound(sound: 'work-start' | 'rest-start'): Promise<void> {
  if (!(await browser.offscreen.hasDocument())) {
    await browser.offscreen.createDocument({
      url: OFFSCREEN_URL,
      reasons: ['AUDIO_PLAYBACK'],
      justification: 'Play Pomodoro session-change alarm',
    });
  }
  const msg: OffscreenMessage = { type: OFFSCREEN_MESSAGE.PLAY_SOUND, sound };
  await browser.runtime.sendMessage(msg);
}
