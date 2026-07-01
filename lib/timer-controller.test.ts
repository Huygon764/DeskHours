import { describe, it, expect, beforeEach, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import {
  startTimer,
  resetTimer,
  pauseTimer,
  resumeTimer,
  onTimerAlarm,
  onTimerNotificationClick,
  stopTimerAlert,
  TIMER_ALARM,
} from './timer-controller';
import { timerItem } from './storage';
import { setupOffscreenMock, setupI18nMock } from './test-setup';

describe('timer controller', () => {
  beforeEach(() => {
    fakeBrowser.reset();
    setupI18nMock();
    setupOffscreenMock();
    vi.spyOn(Date, 'now').mockReturnValue(1_000_000);
  });

  it('start creates alarm at endsAt', async () => {
    await startTimer();
    const state = await timerItem.getValue();
    expect(state.active).toBe(true);
    expect(state.endsAt).toBe(1_000_000 + 5 * 60_000);
    const alarm = await fakeBrowser.alarms.get(TIMER_ALARM);
    expect(alarm?.scheduledTime).toBe(state.endsAt);
  });

  it('pause stores remaining time and clears alarm', async () => {
    await startTimer();
    vi.spyOn(Date, 'now').mockReturnValue(1_000_000 + 2 * 60_000);
    await pauseTimer();
    const state = await timerItem.getValue();
    expect(state.pausedRemainingMs).toBe(3 * 60_000);
    expect(state.endsAt).toBeNull();
    expect(await fakeBrowser.alarms.get(TIMER_ALARM)).toBeFalsy();
  });

  it('resume restores countdown and reschedules alarm', async () => {
    await startTimer();
    vi.spyOn(Date, 'now').mockReturnValue(1_000_000 + 2 * 60_000);
    await pauseTimer();
    vi.spyOn(Date, 'now').mockReturnValue(2_000_000);
    await resumeTimer();
    const state = await timerItem.getValue();
    expect(state.endsAt).toBe(2_000_000 + 3 * 60_000);
    const alarm = await fakeBrowser.alarms.get(TIMER_ALARM);
    expect(alarm?.scheduledTime).toBe(state.endsAt);
  });

  it('reset returns to idle and clears alarm', async () => {
    await startTimer();
    await resetTimer();
    const state = await timerItem.getValue();
    expect(state.active).toBe(false);
    expect(state.finished).toBe(false);
    expect(state.endsAt).toBeNull();
    expect(await fakeBrowser.alarms.get(TIMER_ALARM)).toBeFalsy();
  });

  it('alarm enters finished state and notifies', async () => {
    await startTimer();
    await onTimerAlarm();
    const state = await timerItem.getValue();
    expect(state.active).toBe(false);
    expect(state.finished).toBe(true);
    expect(browser.notifications.create).toHaveBeenCalled();
    expect(browser.runtime.sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({ sound: 'rest-start', repeats: 5 }),
    );
  });

  it('stopTimerAlert sends stop message to offscreen', async () => {
    await startTimer();
    await onTimerAlarm();
    vi.mocked(browser.runtime.sendMessage).mockClear();
    await stopTimerAlert();
    expect(browser.runtime.sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'STOP_SOUND' }),
    );
  });

  it('notification click stops alert', async () => {
    await startTimer();
    await onTimerAlarm();
    vi.mocked(browser.runtime.sendMessage).mockClear();
    await onTimerNotificationClick();
    expect(browser.runtime.sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'STOP_SOUND' }),
    );
  });

  it('alarm always plays sound even when soundEnabled is false', async () => {
    const current = await timerItem.getValue();
    await timerItem.setValue({ ...current, soundEnabled: false });
    await startTimer();
    await onTimerAlarm();
    expect(browser.notifications.create).toHaveBeenCalled();
    expect(browser.runtime.sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({ sound: 'rest-start', repeats: 5 }),
    );
  });
});
