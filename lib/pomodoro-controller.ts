import { pomodoroItem } from './storage';
import { isPaused, nextPhase, remainingMs, resumeState } from './pomodoro';
import { playAlertSound } from './alert-sound';

export const POMODORO_ALARM = 'pomodoro-phase-end';

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
  await pomodoroItem.setValue({
    ...current,
    phase: 'idle',
    phaseEndsAt: null,
    pausedRemainingMs: null,
  });
  await browser.alarms.clear(POMODORO_ALARM);
}

/** Pause the current phase and keep remaining time. */
export async function pausePomodoro(): Promise<void> {
  const current = await pomodoroItem.getValue();
  if (current.phase === 'idle' || isPaused(current)) return;
  const now = Date.now();
  await pomodoroItem.setValue({
    ...current,
    phaseEndsAt: null,
    pausedRemainingMs: remainingMs(current, now),
  });
  await browser.alarms.clear(POMODORO_ALARM);
}

/** Resume a paused phase from stored remaining time. */
export async function resumePomodoro(): Promise<void> {
  const current = await pomodoroItem.getValue();
  if (!isPaused(current)) return;
  const resumed = resumeState(current, Date.now());
  await pomodoroItem.setValue(resumed);
  if (resumed.phaseEndsAt) await scheduleAlarm(resumed.phaseEndsAt);
}

/** Called when the phase-end alarm fires: advance, alert, reschedule. */
export async function onPhaseAlarm(): Promise<void> {
  const current = await pomodoroItem.getValue();
  if (current.phase === 'idle' || current.pausedRemainingMs != null) return;
  const advanced = nextPhase(current, Date.now());
  await pomodoroItem.setValue(advanced);
  await alert(advanced.phase === 'work' ? 'work-start' : 'rest-start');
  if (advanced.phaseEndsAt) await scheduleAlarm(advanced.phaseEndsAt);
}

async function alert(sound: 'work-start' | 'rest-start'): Promise<void> {
  await showNotification(sound);
  await playAlertSound(sound);
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

