<script lang="ts">
  import { pomodoroItem, scheduleItem, timerItem } from '@/lib/storage';
  import { isPaused, remainingMs, displaySecondsFromMs } from '@/lib/pomodoro';
  import { formatHhMmSs, isTimerFinished, isTimerRunning, timerRemainingMs } from '@/lib/timer';
  import { isSiteBlockingEnabled } from '@/lib/schedule';
  import type { CountdownTimerState, PomodoroState, ScheduleWindow } from '@/lib/types';
  import CurrentPage from './CurrentPage.svelte';
  import FocusPanel from './FocusPanel.svelte';
  import TimerPanel from './TimerPanel.svelte';
  import { t, watchLocale } from '@/lib/i18n';
  import AppLogo from '@/components/AppLogo.svelte';

  type PopupTab = 'block' | 'focus' | 'timer';

  let localeRevision = $state(0);

  let activeTab = $state<PopupTab>('block');
  let pomodoroState = $state<PomodoroState | null>(null);
  let countdownState = $state<CountdownTimerState | null>(null);
  let scheduleState = $state<ScheduleWindow[] | null>(null);
  let now = $state(Date.now());

  $effect(() => watchLocale(() => localeRevision++));

  $effect(() => {
    const unwatchPomodoro = pomodoroItem.watch((v) => {
      pomodoroState = v;
      now = Date.now();
    });
    const unwatchTimer = timerItem.watch((v) => {
      countdownState = v;
      now = Date.now();
    });
    const unwatchSchedule = scheduleItem.watch((v) => {
      scheduleState = v;
      now = Date.now();
    });
    void Promise.all([pomodoroItem.getValue(), timerItem.getValue(), scheduleItem.getValue()]).then(
      ([pomo, timer, schedule]) => {
        pomodoroState = pomo;
        countdownState = timer;
        scheduleState = schedule;
        if (pomo.phase !== 'idle') activeTab = 'focus';
      },
    );
    const id = setInterval(() => (now = Date.now()), 250);
    return () => {
      unwatchPomodoro();
      unwatchTimer();
      unwatchSchedule();
      clearInterval(id);
    };
  });

  const blockingNow = $derived.by(() => {
    void now;
    if (!pomodoroState || !scheduleState) return false;
    return isSiteBlockingEnabled(scheduleState, now, pomodoroState);
  });

  const focusRunning = $derived(pomodoroState != null && pomodoroState.phase !== 'idle');
  const countdownRunning = $derived(countdownState != null && isTimerRunning(countdownState));
  const countdownDone = $derived(countdownState != null && isTimerFinished(countdownState));
  const countdownLive = $derived(countdownRunning || countdownDone);

  const focusLabel = $derived.by(() => {
    void localeRevision;
    if (!pomodoroState || pomodoroState.phase === 'idle') return '';
    const total = displaySecondsFromMs(remainingMs(pomodoroState, now));
    const m = String(Math.floor(total / 60)).padStart(2, '0');
    const s = String(total % 60).padStart(2, '0');
    const phase = pomodoroState.phase === 'work' ? t('phaseFocus') : t('phaseRest');
    const suffix = isPaused(pomodoroState) ? t('pausedSuffix') : '';
    return `${phase} ${m}:${s}${suffix}`;
  });

  const countdownLabel = $derived.by(() => {
    void localeRevision;
    if (!countdownState || !isTimerRunning(countdownState)) return '';
    const suffix = countdownState.pausedRemainingMs != null ? t('pausedSuffix') : '';
    return `${t('tabTimer')} ${formatHhMmSs(displaySecondsFromMs(timerRemainingMs(countdownState, now)))}${suffix}`;
  });

  function openOptions() {
    browser.runtime.openOptionsPage();
  }
</script>

<div class="popup">
  {#key localeRevision}
  <header class="popup-header">
    <div class="brand">
      <AppLogo size={22} />
      <span class="brand-name">{t('appName')}</span>
    </div>
    {#if blockingNow}
      <span class="badge badge-on">{t('blockingOn')}</span>
    {:else}
      <span class="badge badge-off">{t('blockingOff')}</span>
    {/if}
  </header>

  <nav class="popup-tabs" aria-label={t('ariaPopupSections')}>
    <button
      type="button"
      class="tab"
      class:active={activeTab === 'block'}
      onclick={() => (activeTab = 'block')}
    >
      {t('tabBlock')}
    </button>
    <button
      type="button"
      class="tab"
      class:active={activeTab === 'focus'}
      onclick={() => (activeTab = 'focus')}
    >
      {t('tabFocus')}
      {#if focusRunning}<span class="tab-live" aria-hidden="true"></span>{/if}
    </button>
    <button
      type="button"
      class="tab"
      class:active={activeTab === 'timer'}
      onclick={() => (activeTab = 'timer')}
    >
      {t('tabTimer')}
      {#if countdownLive}<span class="tab-live" aria-hidden="true"></span>{/if}
    </button>
  </nav>

  <div class="popup-body">
    {#if activeTab === 'block'}
      <CurrentPage {blockingNow} />
    {:else if activeTab === 'focus'}
      <FocusPanel />
    {:else}
      <TimerPanel />
    {/if}
  </div>

  {#if activeTab === 'block' && (focusRunning || countdownLive)}
    <div class="timer-hints">
      {#if focusRunning}
        <div class="timer-hint">
          <span class="text-label">{focusLabel}</span>
          <button type="button" class="link-btn" onclick={() => (activeTab = 'focus')}>{t('openFocus')}</button>
        </div>
      {/if}
      {#if countdownDone}
        <div class="timer-hint">
          <span class="text-label">{t('timerTimesUp')}</span>
          <button type="button" class="link-btn" onclick={() => (activeTab = 'timer')}>{t('openTimer')}</button>
        </div>
      {:else if countdownRunning}
        <div class="timer-hint">
          <span class="text-label">{countdownLabel}</span>
          <button type="button" class="link-btn" onclick={() => (activeTab = 'timer')}>{t('openTimer')}</button>
        </div>
      {/if}
    </div>
  {/if}

  <footer class="popup-footer">
    <button type="button" class="link-btn" onclick={openOptions}>{t('openSettings')}</button>
  </footer>
  {/key}
</div>

<style>
  .popup {
    width: 320px;
    background: var(--surface);
    border: 1px solid var(--border-variant);
    border-radius: var(--radius);
    box-shadow: var(--shadow-card);
    overflow: hidden;
  }

  .popup-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 20px;
    border-bottom: 1px solid var(--border-variant);
  }

  .brand {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .brand-name {
    font-size: 16px;
    font-weight: 700;
    color: var(--text-strong);
  }

  .popup-tabs {
    display: flex;
    padding: 0 12px;
    border-bottom: 1px solid var(--border-variant);
  }

  .popup-tabs .tab {
    flex: 1;
    text-align: center;
    position: relative;
    padding-left: 4px;
    padding-right: 4px;
  }

  .tab-live {
    position: absolute;
    top: 10px;
    right: 8px;
    width: 6px;
    height: 6px;
    border-radius: 999px;
    background: var(--amber);
  }

  .popup-body {
    padding: 20px;
  }

  .timer-hints {
    border-top: 1px solid var(--border-variant);
    background: var(--surface-low);
  }

  .timer-hint {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 10px 20px;
  }

  .timer-hint + .timer-hint {
    border-top: 1px solid var(--border-variant);
  }

  .timer-hint .link-btn {
    flex-shrink: 0;
    font-size: 12px;
  }

  .popup-footer {
    padding: 12px 20px 16px;
    text-align: center;
    border-top: 1px solid var(--border-variant);
  }

  .timer-hints + .popup-footer {
    border-top: none;
    padding-top: 8px;
  }
</style>
