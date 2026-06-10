import { endAtFromDuration } from './pomodoro';
import { timerItem } from './storage';
import {
  isTimerPaused,
  normalizeTimerState,
  resumeTimerState,
  timerRemainingMs,
} from './timer';
import { playAlertSound, stopAlertSound } from './alert-sound';
import { translate } from './i18n';

export const TIMER_ALARM = 'countdown-timer-end';
export const TIMER_NOTIFICATION_ID = 'timer-finished';
const ALERT_SOUND = 'rest-start' as const;
const ALERT_REPEATS = 5;

async function scheduleAlarm(at: number): Promise<void> {
  await browser.alarms.create(TIMER_ALARM, { when: at });
}

async function readTimer() {
  return normalizeTimerState(await timerItem.getValue());
}

/** Start the countdown from the current duration preset. */
export async function startTimer(): Promise<void> {
  let current = await readTimer();
  if (current.active && !isTimerPaused(current)) return;
  if (current.finished) {
    await stopAlertSound();
    current = { ...current, finished: false };
  }
  const durationMs = current.durationSeconds * 1000;
  if (durationMs <= 0) return;
  const now = Date.now();
  const endsAt = endAtFromDuration(now, durationMs);
  await timerItem.setValue({
    ...current,
    active: true,
    finished: false,
    endsAt,
    pausedRemainingMs: null,
  });
  await scheduleAlarm(endsAt);
}

/** Stop alert playback without leaving the finished screen. */
export async function stopTimerAlert(): Promise<void> {
  await stopAlertSound();
  await browser.notifications.clear(TIMER_NOTIFICATION_ID);
}

/** Stop alert playback and return to idle setup. */
export async function resetTimer(): Promise<void> {
  await stopTimerAlert();
  const current = await readTimer();
  await timerItem.setValue({
    ...current,
    active: false,
    finished: false,
    endsAt: null,
    pausedRemainingMs: null,
  });
  await browser.alarms.clear(TIMER_ALARM);
}

/** Pause and keep remaining time. */
export async function pauseTimer(): Promise<void> {
  const current = await readTimer();
  if (!current.active || isTimerPaused(current)) return;
  const now = Date.now();
  await timerItem.setValue({
    ...current,
    endsAt: null,
    pausedRemainingMs: timerRemainingMs(current, now),
  });
  await browser.alarms.clear(TIMER_ALARM);
}

/** Resume from stored remaining time. */
export async function resumeTimer(): Promise<void> {
  const current = await readTimer();
  if (!isTimerPaused(current)) return;
  const resumed = resumeTimerState(current, Date.now());
  await timerItem.setValue(resumed);
  if (resumed.endsAt) await scheduleAlarm(resumed.endsAt);
}

export async function setTimerSoundEnabled(enabled: boolean): Promise<void> {
  const current = await readTimer();
  await timerItem.setValue({ ...current, soundEnabled: enabled });
}

/** Called when the countdown alarm fires. */
export async function onTimerAlarm(): Promise<void> {
  const current = await readTimer();
  if (!current.active || current.pausedRemainingMs != null) return;
  await timerItem.setValue({
    ...current,
    active: false,
    finished: true,
    endsAt: null,
    pausedRemainingMs: null,
  });
  await showNotification();
  if (current.soundEnabled) void playAlertSound(ALERT_SOUND, ALERT_REPEATS);
}

/** Notification click: silence the repeating alert. */
export async function onTimerNotificationClick(): Promise<void> {
  await stopTimerAlert();
}

async function showNotification(): Promise<void> {
  await browser.notifications.create(TIMER_NOTIFICATION_ID, {
    type: 'basic',
    iconUrl: browser.runtime.getURL('/icon/128.png'),
    title: await translate('timerNotificationTitle'),
    message: await translate('timerNotificationMessage'),
  });
}
