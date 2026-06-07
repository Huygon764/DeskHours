import { describe, it, expect, beforeEach, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { startPomodoro, stopPomodoro, onPhaseAlarm, POMODORO_ALARM } from './pomodoro-controller';
import { pomodoroItem } from './storage';
import { setupOffscreenMock } from './test-setup';

describe('pomodoro controller', () => {
  beforeEach(() => {
    fakeBrowser.reset();
    setupOffscreenMock();
    vi.spyOn(Date, 'now').mockReturnValue(1_000_000);
  });

  it('start moves idle->work and creates a one-shot alarm at phaseEndsAt', async () => {
    await startPomodoro();
    const state = await pomodoroItem.getValue();
    expect(state.phase).toBe('work');
    expect(state.phaseEndsAt).toBe(1_000_000 + 25 * 60_000);
    const alarm = await fakeBrowser.alarms.get(POMODORO_ALARM);
    expect(alarm?.scheduledTime).toBe(state.phaseEndsAt);
  });

  it('phase alarm advances work->rest and reschedules', async () => {
    await startPomodoro();
    vi.spyOn(Date, 'now').mockReturnValue(2_000_000);
    await onPhaseAlarm();
    const state = await pomodoroItem.getValue();
    expect(state.phase).toBe('rest');
    expect(state.phaseEndsAt).toBe(2_000_000 + 5 * 60_000);
    const alarm = await fakeBrowser.alarms.get(POMODORO_ALARM);
    expect(alarm?.scheduledTime).toBe(state.phaseEndsAt);
  });

  it('stop clears the alarm and returns to idle', async () => {
    await startPomodoro();
    await stopPomodoro();
    const state = await pomodoroItem.getValue();
    expect(state.phase).toBe('idle');
    expect(state.phaseEndsAt).toBeNull();
    expect(await fakeBrowser.alarms.get(POMODORO_ALARM)).toBeFalsy();
  });
});
