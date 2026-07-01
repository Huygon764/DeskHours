import { describe, it, expect, beforeEach, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import {
  checkAlarms,
  dismissAlarm,
  refreshAlarmBadge,
  ALARM_ALERT_SOUND,
  ALARM_ALERT_REPEATS,
  ALARM_BADGE_COLOR,
} from './alarm-controller';
import { alarmsItem, ringingAlarmsItem } from './storage';
import type { AlarmItem } from './types';
import { setupI18nMock, setupOffscreenMock } from './test-setup';

// 2026-06-08 09:00 local (Monday).
const MON_9 = new Date(2026, 5, 8, 9, 0).getTime();

function weekly(over: Partial<AlarmItem> = {}): AlarmItem {
  return {
    id: 'a1',
    label: 'Stand up',
    time: '09:00',
    repeat: 'weekly',
    days: [1, 2, 3, 4, 5],
    date: null,
    enabled: true,
    lastFiredKey: null,
    ...over,
  };
}

describe('checkAlarms', () => {
  beforeEach(() => {
    // fakeBrowser is a module-level singleton, so previous tests' vi.spyOn
    // wrappers (and their call history) would otherwise leak into this test.
    vi.restoreAllMocks();
    fakeBrowser.reset();
    setupI18nMock();
    setupOffscreenMock();
  });

  it('fires a notification with the label and plays the sound 5 times', async () => {
    const notifySpy = vi.spyOn(browser.notifications, 'create');
    const sendSpy = vi.spyOn(browser.runtime, 'sendMessage');
    await alarmsItem.setValue([weekly()]);

    await checkAlarms(MON_9);

    expect(notifySpy).toHaveBeenCalledTimes(1);
    const payload = notifySpy.mock.calls[0][1] as unknown as { message: string };
    expect(payload.message).toBe('Stand up');
    // Sound goes out via runtime.sendMessage to the offscreen doc.
    const soundMsg = sendSpy.mock.calls.map((c) => c[0]).find((m: any) => m.sound);
    expect(soundMsg).toMatchObject({ sound: ALARM_ALERT_SOUND, repeats: ALARM_ALERT_REPEATS });
  });

  it('stamps lastFiredKey so it will not re-fire in the same minute', async () => {
    await alarmsItem.setValue([weekly()]);
    await checkAlarms(MON_9);
    const [stored] = await alarmsItem.getValue();
    expect(stored.lastFiredKey).toBe('2026-06-08 09:00');

    // vi.spyOn on an already-spied method (setupOffscreenMock spied it in
    // beforeEach) returns the same mock, so it still holds the call from the
    // first checkAlarms above; clear it before asserting on the second call.
    const notifySpy = vi.spyOn(browser.notifications, 'create');
    notifySpy.mockClear();
    await checkAlarms(MON_9);
    expect(notifySpy).not.toHaveBeenCalled();
  });

  it('disables a one-time alarm after it fires but keeps it in the list', async () => {
    await alarmsItem.setValue([
      weekly({ id: 'o1', repeat: 'once', days: [], date: '2026-06-08' }),
    ]);
    await checkAlarms(MON_9);
    const [stored] = await alarmsItem.getValue();
    expect(stored.enabled).toBe(false);
    expect(stored.lastFiredKey).toBe('2026-06-08 09:00');
  });

  it('does nothing when no alarm is due', async () => {
    const notifySpy = vi.spyOn(browser.notifications, 'create');
    await alarmsItem.setValue([weekly({ time: '10:00' })]);
    await checkAlarms(MON_9);
    expect(notifySpy).not.toHaveBeenCalled();
  });

  it('records fired alarm ids as ringing and sets the badge count', async () => {
    const badgeSpy = vi.spyOn(browser.action, 'setBadgeText');
    await alarmsItem.setValue([weekly()]);

    await checkAlarms(MON_9);

    expect(await ringingAlarmsItem.getValue()).toEqual(['a1']);
    expect(badgeSpy).toHaveBeenCalledWith({ text: '1' });
  });

  it('does not duplicate an id already ringing', async () => {
    await ringingAlarmsItem.setValue(['a1']);
    await alarmsItem.setValue([weekly()]);

    await checkAlarms(MON_9);

    expect(await ringingAlarmsItem.getValue()).toEqual(['a1']);
  });
});

describe('dismissAlarm', () => {
  beforeEach(() => {
    // Same spy-leakage concern as the checkAlarms block above: vi.spyOn on an
    // already-spied method returns the same mock, so call history from a
    // previous test in this block would otherwise leak into the next one.
    vi.restoreAllMocks();
    fakeBrowser.reset();
    setupI18nMock();
    setupOffscreenMock();
  });

  it('removes the id, stops the sound, and clears the badge when none remain', async () => {
    const badgeSpy = vi.spyOn(browser.action, 'setBadgeText');
    const sendSpy = vi.spyOn(browser.runtime, 'sendMessage');
    await ringingAlarmsItem.setValue(['a1']);

    await dismissAlarm('a1');

    expect(await ringingAlarmsItem.getValue()).toEqual([]);
    const stopMsg = sendSpy.mock.calls.map((c) => c[0]).find((m: any) => m.type === 'STOP_SOUND');
    expect(stopMsg).toBeTruthy();
    expect(badgeSpy).toHaveBeenCalledWith({ text: '' });
  });

  it('keeps the sound when other alarms are still ringing', async () => {
    const sendSpy = vi.spyOn(browser.runtime, 'sendMessage');
    await ringingAlarmsItem.setValue(['a1', 'a2']);

    await dismissAlarm('a1');

    expect(await ringingAlarmsItem.getValue()).toEqual(['a2']);
    const stopMsg = sendSpy.mock.calls.map((c) => c[0]).find((m: any) => m.type === 'STOP_SOUND');
    expect(stopMsg).toBeUndefined();
  });
});

describe('refreshAlarmBadge', () => {
  beforeEach(() => {
    fakeBrowser.reset();
    setupI18nMock();
    setupOffscreenMock();
  });

  it('clears the badge text when nothing is ringing', async () => {
    const badgeSpy = vi.spyOn(browser.action, 'setBadgeText');
    await ringingAlarmsItem.setValue([]);
    await refreshAlarmBadge();
    expect(badgeSpy).toHaveBeenCalledWith({ text: '' });
  });
});
