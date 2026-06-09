import { syncBlocker, grantUnblock } from '@/lib/blocker-controller';
import {
  onPhaseAlarm,
  pausePomodoro,
  resumePomodoro,
  startPomodoro,
  stopPomodoro,
  POMODORO_ALARM,
} from '@/lib/pomodoro-controller';
import { unblockMinutesItem } from '@/lib/storage';
import { BG_MESSAGE, type BgMessage } from '@/lib/messages';

const SCHEDULER_ALARM = 'blocker-scheduler';

export default defineBackground(() => {
  void syncBlocker();

  browser.alarms.create(SCHEDULER_ALARM, { periodInMinutes: 1 });

  browser.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === SCHEDULER_ALARM) void syncBlocker();
    else if (alarm.name === POMODORO_ALARM) void onPhaseAlarm();
  });

  browser.runtime.onMessage.addListener((message: BgMessage) => {
    switch (message.type) {
      case BG_MESSAGE.SYNC_BLOCKER:
        return syncBlocker().catch((err) =>
          console.error(`[site-blocker] ${BG_MESSAGE.SYNC_BLOCKER} failed:`, err),
        );
      case BG_MESSAGE.GRANT_UNBLOCK:
        return unblockMinutesItem.getValue().then((m) => grantUnblock(message.pattern, m));
      case BG_MESSAGE.POMODORO_START:
        return startPomodoro();
      case BG_MESSAGE.POMODORO_STOP:
        return stopPomodoro();
      case BG_MESSAGE.POMODORO_PAUSE:
        return pausePomodoro();
      case BG_MESSAGE.POMODORO_RESUME:
        return resumePomodoro();
    }
  });
});
