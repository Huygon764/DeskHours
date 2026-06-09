<script lang="ts">
  import { pomodoroItem, scheduleItem } from '@/lib/storage';
  import { isPaused, remainingMs } from '@/lib/pomodoro';
  import { isBlockingActive } from '@/lib/schedule';
  import type { PomodoroState } from '@/lib/types';
  import CurrentPage from './CurrentPage.svelte';
  import FocusPanel from './FocusPanel.svelte';

  type PopupTab = 'block' | 'focus';

  let activeTab = $state<PopupTab>('block');
  let pomodoroState = $state<PomodoroState | null>(null);
  let now = $state(Date.now());
  let blockingNow = $state(false);

  $effect(() => {
    const unwatchPomodoro = pomodoroItem.watch((v) => (pomodoroState = v));
    void pomodoroItem.getValue().then((v) => (pomodoroState = v));
    void scheduleItem.getValue().then((s) => (blockingNow = isBlockingActive(s, Date.now())));
    const id = setInterval(() => (now = Date.now()), 1000);
    return () => {
      unwatchPomodoro();
      clearInterval(id);
    };
  });

  const timerRunning = $derived(pomodoroState != null && pomodoroState.phase !== 'idle');
  const timerLabel = $derived.by(() => {
    if (!pomodoroState || pomodoroState.phase === 'idle') return '';
    const total = Math.ceil(remainingMs(pomodoroState, now) / 1000);
    const m = String(Math.floor(total / 60)).padStart(2, '0');
    const s = String(total % 60).padStart(2, '0');
    const phase = pomodoroState.phase === 'work' ? 'Work' : 'Rest';
    const suffix = isPaused(pomodoroState) ? ' (paused)' : '';
    return `${phase} ${m}:${s}${suffix}`;
  });

  function openOptions() {
    browser.runtime.openOptionsPage();
  }
</script>

<div class="popup">
  <header class="popup-header">
    <div class="brand">
      <span class="shield" aria-hidden="true">&#x1F6E1;</span>
      <span class="brand-name">Site Blocker</span>
    </div>
    {#if blockingNow}
      <span class="badge badge-on">Blocking on</span>
    {:else}
      <span class="badge badge-off">Blocking off</span>
    {/if}
  </header>

  <nav class="popup-tabs" aria-label="Popup sections">
    <button
      type="button"
      class="tab"
      class:active={activeTab === 'block'}
      onclick={() => (activeTab = 'block')}
    >
      Block
    </button>
    <button
      type="button"
      class="tab"
      class:active={activeTab === 'focus'}
      onclick={() => (activeTab = 'focus')}
    >
      Focus
      {#if timerRunning}<span class="tab-live" aria-hidden="true"></span>{/if}
    </button>
  </nav>

  <div class="popup-body">
    {#if activeTab === 'block'}
      <CurrentPage {blockingNow} />
    {:else}
      <FocusPanel />
    {/if}
  </div>

  {#if timerRunning && activeTab === 'block'}
    <div class="timer-hint">
      <span class="text-label">{timerLabel}</span>
      <button type="button" class="link-btn" onclick={() => (activeTab = 'focus')}>Open Focus →</button>
    </div>
  {/if}

  <footer class="popup-footer">
    <button type="button" class="link-btn" onclick={openOptions}>Open settings →</button>
  </footer>
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

  .shield {
    font-size: 18px;
    line-height: 1;
  }

  .brand-name {
    font-size: 16px;
    font-weight: 700;
    color: var(--text-strong);
  }

  .popup-tabs {
    display: flex;
    padding: 0 20px;
    border-bottom: 1px solid var(--border-variant);
  }

  .popup-tabs .tab {
    flex: 1;
    text-align: center;
    position: relative;
  }

  .tab-live {
    position: absolute;
    top: 10px;
    right: calc(50% - 28px);
    width: 6px;
    height: 6px;
    border-radius: 999px;
    background: var(--amber);
  }

  .popup-body {
    padding: 20px;
  }

  .timer-hint {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 10px 20px;
    background: var(--surface-low);
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

  .timer-hint + .popup-footer {
    border-top: none;
    padding-top: 8px;
  }
</style>
