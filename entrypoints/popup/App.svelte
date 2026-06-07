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

<main>
  <p>Blocking: <strong>{blockingNow ? 'ON (scheduled)' : 'off'}</strong></p>

  <section>
    <h2>Pomodoro</h2>
    {#if state && state.phase !== 'idle'}
      <p class="phase">{state.phase === 'work' ? 'Work' : 'Rest'}</p>
      <p class="time">{mmss}</p>
      <button onclick={() => sendBg({ type: BG_MESSAGE.POMODORO_STOP })}>Stop</button>
    {:else}
      <button onclick={() => sendBg({ type: BG_MESSAGE.POMODORO_START })}>Start</button>
    {/if}

    {#if state}
      <div class="durations" class:disabled={!idle}>
        <p class="label">{idle ? 'Durations (min)' : 'Stop timer to edit'}</p>
        <div class="row">
          <span>Work</span>
          <button onclick={() => bump('workMinutes', -1)} disabled={!idle}>−</button>
          <span class="value">{state.workMinutes}</span>
          <button onclick={() => bump('workMinutes', 1)} disabled={!idle}>+</button>
        </div>
        <div class="row">
          <span>Rest</span>
          <button onclick={() => bump('restMinutes', -1)} disabled={!idle}>−</button>
          <span class="value">{state.restMinutes}</span>
          <button onclick={() => bump('restMinutes', 1)} disabled={!idle}>+</button>
        </div>
        <button class="preset" onclick={() => setDurations(1, 1)} disabled={!idle}>Test: 1m / 1m</button>
        <button class="preset" onclick={() => setDurations(25, 5)} disabled={!idle}>Reset: 25m / 5m</button>
      </div>
    {/if}
  </section>

  <button onclick={openOptions}>Settings</button>
</main>

<style>
  main { width: 16rem; padding: 1rem; font-family: system-ui; }
  .phase { text-transform: uppercase; letter-spacing: 0.1em; color: #555; }
  .time { font-size: 2.5rem; font-variant-numeric: tabular-nums; margin: 0.25rem 0; }
  h2 { font-size: 1rem; margin: 0.5rem 0; }
  button { margin-top: 0.25rem; padding: 0.4rem 0.8rem; }
  .durations { margin-top: 0.75rem; font-size: 0.875rem; }
  .durations.disabled { opacity: 0.6; }
  .label { margin: 0 0 0.35rem; color: #555; }
  .row { display: flex; align-items: center; gap: 0.35rem; margin: 0.25rem 0; }
  .row span:first-child { width: 2.5rem; }
  .value { min-width: 1.5rem; text-align: center; font-variant-numeric: tabular-nums; }
  .row button { margin: 0; padding: 0.15rem 0.5rem; min-width: 1.75rem; }
  .preset { display: block; width: 100%; margin-top: 0.35rem; font-size: 0.8rem; }
</style>
