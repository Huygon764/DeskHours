import { alarmsItem } from './storage';
import { dueAlarms, fireKey, normalizeAlarm } from './alarm';
import { notify } from './notify';
import { playAlertSound, type AlertSound } from './alert-sound';
import { translate } from './i18n';

export const ALARM_ALERT_SOUND: AlertSound = 'rest-start';
export const ALARM_ALERT_REPEATS = 5;

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
}
