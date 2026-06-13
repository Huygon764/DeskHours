import { syncBlocker, grantUnblock } from '@/lib/blocker-controller';
import { maybeRedirectBlockedTab, rememberNavigationTarget } from '@/lib/keyword-navigation';
import { peekPendingBlockUrl } from '@/lib/pending-block-url';
import {
  onPhaseAlarm,
  pausePomodoro,
  resumePomodoro,
  startPomodoro,
  stopPomodoro,
  POMODORO_ALARM,
} from '@/lib/pomodoro-controller';
import {
  onTimerAlarm,
  onTimerNotificationClick,
  TIMER_ALARM,
  TIMER_NOTIFICATION_ID,
} from '@/lib/timer-controller';
import { unblockMinutesItem } from '@/lib/storage';
import { BG_MESSAGE, type BgMessage } from '@/lib/messages';

const SCHEDULER_ALARM = 'blocker-scheduler';

function guardTab(tabId: number, url?: string): void {
  void maybeRedirectBlockedTab(tabId, url).catch((err) =>
    console.error('[deskhours] tab guard failed:', err),
  );
}

export default defineBackground(() => {
  void syncBlocker().catch((err) => console.error('[deskhours] initial sync failed:', err));

  browser.alarms.create(SCHEDULER_ALARM, { periodInMinutes: 1 });

  browser.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === SCHEDULER_ALARM) {
      void syncBlocker().catch((err) => console.error('[deskhours] scheduled sync failed:', err));
    }
    else if (alarm.name === POMODORO_ALARM) void onPhaseAlarm();
    else if (alarm.name === TIMER_ALARM) void onTimerAlarm();
  });

  browser.notifications.onClicked.addListener((notificationId) => {
    if (notificationId === TIMER_NOTIFICATION_ID) void onTimerNotificationClick();
  });

  browser.tabs.onUpdated.addListener((tabId, changeInfo) => {
    if (changeInfo.url) guardTab(tabId, changeInfo.url);
    else if (changeInfo.status === 'complete') guardTab(tabId);
  });

  browser.tabs.onActivated.addListener(({ tabId }) => {
    guardTab(tabId);
  });

  browser.webNavigation.onBeforeNavigate.addListener((details) => {
    if (details.frameId !== 0) return;
    rememberNavigationTarget(details.tabId, details.url);
  });

  browser.runtime.onMessage.addListener((message: BgMessage, sender) => {
    switch (message.type) {
      case BG_MESSAGE.SYNC_BLOCKER:
        return syncBlocker().catch((err) =>
          console.error(`[deskhours] ${BG_MESSAGE.SYNC_BLOCKER} failed:`, err),
        );
      case BG_MESSAGE.GRANT_UNBLOCK:
        return unblockMinutesItem.getValue().then((m) => grantUnblock(message.pattern, m));
      case BG_MESSAGE.GET_PENDING_BLOCKED_URL: {
        const tabId = sender.tab?.id;
        if (tabId == null) return null;
        return peekPendingBlockUrl(tabId);
      }
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
