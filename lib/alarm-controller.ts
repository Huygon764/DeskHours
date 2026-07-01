import { alarmsItem, ringingAlarmsItem } from './storage';
import { dueAlarms, fireKey, normalizeAlarm } from './alarm';
import { notify } from './notify';
import { playAlertSound, stopAlertSound, type AlertSound } from './alert-sound';
import { translate } from './i18n';

export const ALARM_ALERT_SOUND: AlertSound = 'rest-start';
export const ALARM_ALERT_REPEATS = 5;
export const ALARM_BADGE_COLOR = '#d92d20';

/** Fire every alarm due at `now`: notify (+ optional sound), then persist dedupe
 *  state. One-time alarms are disabled after firing but kept in the list. */
export async function checkAlarms(now: number): Promise<void> {
  const alarms = (await alarmsItem.getValue()).map(normalizeAlarm);
  const due = dueAlarms(alarms, now);
  if (due.length === 0) return;

  const key = fireKey(now);
  const fallbackLabel = await translate('alarmDefaultLabel');

  for (const a of due) {
    await notify({
      id: `alarm-${a.id}`,
      titleKey: 'alarmNotificationTitle',
      message: a.label.trim() || fallbackLabel,
    });
  }

  // Play once even if several alarms fire together, to avoid overlapping playback.
  void playAlertSound(ALARM_ALERT_SOUND, ALARM_ALERT_REPEATS);

  const dueIds = new Set(due.map((a) => a.id));
  const updated = alarms.map((a) => {
    if (!dueIds.has(a.id)) return a;
    const fired = { ...a, lastFiredKey: key };
    return a.repeat === 'once' ? { ...fired, enabled: false } : fired;
  });
  await alarmsItem.setValue(updated);

  const ringing = await ringingAlarmsItem.getValue();
  const merged = [...ringing];
  for (const a of due) {
    if (!merged.includes(a.id)) merged.push(a.id);
  }
  await ringingAlarmsItem.setValue(merged);
  await refreshAlarmBadge();
}

/** Sync the toolbar badge to the number of currently-ringing alarms. */
export async function refreshAlarmBadge(): Promise<void> {
  const count = (await ringingAlarmsItem.getValue()).length;
  await browser.action.setBadgeText({ text: count > 0 ? String(count) : '' });
  if (count > 0) {
    await browser.action.setBadgeBackgroundColor({ color: ALARM_BADGE_COLOR });
  }
}

/** Turn off one ringing alarm: drop it from the ringing list, silence the alert
 *  if nothing else is ringing, and refresh the badge. */
export async function dismissAlarm(id: string): Promise<void> {
  const ringing = await ringingAlarmsItem.getValue();
  const next = ringing.filter((r) => r !== id);
  await ringingAlarmsItem.setValue(next);
  if (next.length === 0) await stopAlertSound();
  await refreshAlarmBadge();
}
