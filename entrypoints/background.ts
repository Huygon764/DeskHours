import { syncBlocker, grantUnblock } from '@/lib/blocker-controller';
import { maybeRedirectBlockedTab, rememberNavigationTarget } from '@/lib/keyword-navigation';
import { peekPendingBlockUrl, clearPendingBlockUrl } from '@/lib/pending-block-url';
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
import { checkAlarms, refreshAlarmBadge, dismissAlarm } from '@/lib/alarm-controller';

const SCHEDULER_ALARM = 'blocker-scheduler';

function guardTab(tabId: number, url?: string): void {
  void maybeRedirectBlockedTab(tabId, url).catch((err) =>
    console.error('[deskhours] tab guard failed:', err),
  );
}

export default defineBackground(() => {
  void syncBlocker().catch((err) => console.error('[deskhours] initial sync failed:', err));
  void refreshAlarmBadge().catch((err) =>
    console.error('[deskhours] alarm badge init failed:', err),
  );

  browser.alarms.create(SCHEDULER_ALARM, { periodInMinutes: 1 });

  browser.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === SCHEDULER_ALARM) {
      void syncBlocker().catch((err) => console.error('[deskhours] scheduled sync failed:', err));
      void checkAlarms(Date.now()).catch((err) =>
        console.error('[deskhours] alarm check failed:', err),
      );
    }
    else if (alarm.name === POMODORO_ALARM) void onPhaseAlarm();
    else if (alarm.name === TIMER_ALARM) void onTimerAlarm();
  });

  browser.notifications.onClicked.addListener((notificationId) => {
    if (notificationId === TIMER_NOTIFICATION_ID) void onTimerNotificationClick();
    else if (notificationId.startsWith('alarm-')) {
      void dismissAlarm(notificationId.slice('alarm-'.length)).catch((err) =>
        console.error('[deskhours] alarm dismiss failed:', err),
      );
    }
  });

  browser.tabs.onUpdated.addListener((tabId, changeInfo) => {
    if (changeInfo.url) guardTab(tabId, changeInfo.url);
    else if (changeInfo.status === 'complete') guardTab(tabId);
  });

  browser.tabs.onActivated.addListener(({ tabId }) => {
    guardTab(tabId);
  });

  browser.tabs.onRemoved.addListener((tabId) => {
    clearPendingBlockUrl(tabId);
  });

  browser.webNavigation.onBeforeNavigate.addListener((details) => {
    if (details.frameId !== 0) return;
    rememberNavigationTarget(details.tabId, details.url);
  });

  // Native Chrome MV3 onMessage ignores a returned Promise: async branches must
  // `return true` and call sendResponse() later, sync branches respond inline.
  browser.runtime.onMessage.addListener((message: BgMessage, sender, sendResponse) => {
    // Keep the message channel (and the service worker) alive until the work
    // settles, then answer the sender; log every failure instead of swallowing it.
    const respond = (work: Promise<unknown>, label: string): true => {
      void work.then(
        () => sendResponse(null),
        (err) => {
          console.error(`[deskhours] ${label} failed:`, err);
          sendResponse(null);
        },
      );
      return true;
    };

    switch (message.type) {
      case BG_MESSAGE.SYNC_BLOCKER:
        return respond(syncBlocker(), message.type);
      case BG_MESSAGE.GRANT_UNBLOCK:
        return respond(
          unblockMinutesItem.getValue().then((m) => grantUnblock(message.pattern, m)),
          message.type,
        );
      case BG_MESSAGE.GET_PENDING_BLOCKED_URL: {
        const tabId = sender.tab?.id;
        sendResponse(tabId == null ? null : peekPendingBlockUrl(tabId));
        return;
      }
      case BG_MESSAGE.POMODORO_START:
        return respond(startPomodoro(), message.type);
      case BG_MESSAGE.POMODORO_STOP:
        return respond(stopPomodoro(), message.type);
      case BG_MESSAGE.POMODORO_PAUSE:
        return respond(pausePomodoro(), message.type);
      case BG_MESSAGE.POMODORO_RESUME:
        return respond(resumePomodoro(), message.type);
    }
  });
});
