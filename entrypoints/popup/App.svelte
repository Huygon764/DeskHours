<script lang="ts">
  import { pomodoroItem, scheduleItem } from '@/lib/storage';
  import { remainingMs, withDurations } from '@/lib/pomodoro';
  import { isBlockingActive } from '@/lib/schedule';
  import { BG_MESSAGE, sendBg } from '@/lib/messages';
  import type { PomodoroState } from '@/lib/types';

  let state = $state<PomodoroState | null>(null);
  let now = $state(Date.now());
  let blockingNow = $state(false);

  $effect(() => {
    const unwatch = pomodoroItem.watch((v) => (state = v));
    void pomodoroItem.getValue().then((v) => (state = v));
    void scheduleItem.getValue().then((s) => (blockingNow = isBlockingActive(s, Date.now())));
    const id = setInterval(() => (now = Date.now()), 1000);
    return () => {
      unwatch();
      clearInterval(id);
    };
  });

  const remaining = $derived(state ? remainingMs(state, now) : 0);
  const mmss = $derived.by(() => {
    const total = Math.ceil(remaining / 1000);
    const m = String(Math.floor(total / 60)).padStart(2, '0');
    const s = String(total % 60).padStart(2, '0');
    return `${m}:${s}`;
  });

  const idle = $derived(state?.phase === 'idle');
  const running = $derived(state != null && state.phase !== 'idle');

  async function setDurations(workMinutes: number, restMinutes: number) {
    const current = await pomodoroItem.getValue();
    if (current.phase !== 'idle') return;
    await pomodoroItem.setValue(withDurations(current, workMinutes, restMinutes));
  }

  async function bump(field: 'workMinutes' | 'restMinutes', delta: number) {
    if (!state || !idle) return;
    const next = state[field] + delta;
    await setDurations(
      field === 'workMinutes' ? next : state.workMinutes,
      field === 'restMinutes' ? next : state.restMinutes,
    );
  }

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

  <div class="popup-body">
    {#if !state}
      <p class="msg-muted loading">Loading…</p>
    {:else if idle}
      <div class="timer-section">
        <div class="text-timer idle-preview">{String(state.workMinutes).padStart(2, '0')}:00</div>
        <button class="btn btn-primary btn-block" onclick={() => sendBg({ type: BG_MESSAGE.POMODORO_START })}>
          Start focus
        </button>
      </div>

      <div class="duration-grid">
        <div class="duration-col">
          <span class="text-label">Work</span>
          <div class="stepper">
            <button class="stepper-btn" onclick={() => bump('workMinutes', -1)} disabled={!idle} aria-label="Decrease work">−</button>
            <span class="stepper-value">{state.workMinutes}</span>
            <button class="stepper-btn" onclick={() => bump('workMinutes', 1)} disabled={!idle} aria-label="Increase work">+</button>
          </div>
        </div>
        <div class="duration-col">
          <span class="text-label">Rest</span>
          <div class="stepper">
            <button class="stepper-btn" onclick={() => bump('restMinutes', -1)} disabled={!idle} aria-label="Decrease rest">−</button>
            <span class="stepper-value">{state.restMinutes}</span>
            <button class="stepper-btn" onclick={() => bump('restMinutes', 1)} disabled={!idle} aria-label="Increase rest">+</button>
          </div>
        </div>
      </div>

      <div class="presets">
        <button class="btn btn-outline btn-sm preset" onclick={() => setDurations(1, 1)} disabled={!idle}>Test: 1m / 1m</button>
        <button class="btn btn-outline btn-sm preset" onclick={() => setDurations(25, 5)} disabled={!idle}>Reset: 25m / 5m</button>
      </div>
    {:else if running}
      <div class="timer-section">
        <p class="phase-label">{state.phase === 'work' ? 'Work' : 'Rest'}</p>
        <div class="text-timer">{mmss}</div>
      </div>
    {/if}
  </div>

  {#if running && state}
    <div class="running-bar">
      <div class="running-meta">
        <span class="text-label">{state.phase === 'work' ? 'Work session' : 'Rest break'}</span>
        <span class="text-timer-sm">{mmss}</span>
      </div>
      <button class="btn btn-danger-outline btn-block" onclick={() => sendBg({ type: BG_MESSAGE.POMODORO_STOP })}>
        Stop focus
      </button>
    </div>
  {/if}

  <footer class="popup-footer">
    <button class="link-btn" onclick={openOptions}>Open settings →</button>
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

  .popup-body {
    padding: 20px;
  }

  .timer-section {
    text-align: center;
    margin-bottom: 24px;
  }

  .idle-preview {
    margin-bottom: 16px;
  }

  .phase-label {
    margin: 0 0 8px;
    font-size: 12px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: var(--text-muted);
  }

  .duration-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16px;
    margin-bottom: 16px;
  }

  .duration-col {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .presets {
    display: flex;
    gap: 8px;
  }

  .preset {
    flex: 1;
  }

  .running-bar {
    padding: 16px 20px;
    background: var(--surface-low);
    border-top: 1px solid var(--border-variant);
  }

  .running-meta {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 8px;
  }

  .popup-footer {
    padding: 12px 20px 16px;
    text-align: center;
  }
</style>
