<script lang="ts">
  import { onMount } from 'svelte';
  import { scheduleItem } from '@/lib/storage';
  import { syncBlockerSafe } from '@/lib/messages';
  import type { ScheduleWindow } from '@/lib/types';
  import { cloneSchedule } from '@/lib/schedule';

  let { locked = false, onsaved = () => {} }: { locked?: boolean; onsaved?: () => void } = $props();

  let windows = $state<ScheduleWindow[]>([]);
  let loaded = $state(false);
  let saved = $state(false);
  let saveError = $state('');
  const DAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'] as const;
  const DAY_VALUES = [1, 2, 3, 4, 5, 6, 7] as const;

  onMount(async () => {
    try {
      windows = cloneSchedule(await scheduleItem.getValue());
    } catch (err) {
      console.error('load schedule failed:', err);
      saveError = 'Could not load schedule.';
    } finally {
      loaded = true;
    }
  });

  function addWindow() {
    windows = [...windows, { days: [1, 2, 3, 4, 5], start: '09:00', end: '12:00' }];
  }

  function removeWindow(i: number) {
    windows = windows.filter((_, idx) => idx !== i);
  }

  function toggleDay(i: number, day: number) {
    const w = windows[i];
    const days = w.days.includes(day) ? w.days.filter((d) => d !== day) : [...w.days, day];
    windows = windows.map((win, idx) => (idx === i ? { ...win, days } : win));
  }

  async function save() {
    saveError = '';
    saved = false;
    try {
      const snapshot = cloneSchedule(windows);
      await scheduleItem.setValue(snapshot);
      await syncBlockerSafe();
      onsaved();
      saved = true;
      setTimeout(() => (saved = false), 3000);
    } catch {
      saveError = 'Failed to save schedule. Try again.';
    }
  }
</script>

<section class="card schedule-card">
  <div class="card-header">
    <h2 class="text-headline-md">When to block</h2>
  </div>

  {#if !loaded}
    <p class="msg-muted">Loading…</p>
  {:else}
    {#each windows as w, i}
      <div class="window-block">
        <div class="day-pills">
          {#each DAY_VALUES as day, di}
            <button
              type="button"
              class="day-pill"
              class:selected={w.days.includes(day)}
              disabled={locked}
              onclick={() => toggleDay(i, day)}
              aria-label="Toggle day {day}"
            >
              {DAYS[di]}
            </button>
          {/each}
        </div>

        <div class="time-row">
          <div class="time-box">
            <input class="input-inline" type="time" bind:value={w.start} disabled={locked} />
            <span class="time-sep">—</span>
            <input class="input-inline" type="time" bind:value={w.end} disabled={locked} />
          </div>
          <button
            type="button"
            class="btn-icon"
            onclick={() => removeWindow(i)}
            disabled={locked}
            aria-label="Remove window"
            title="Remove window"
          >
            &#x2715;
          </button>
        </div>
      </div>
    {/each}

    <div class="actions">
      <button type="button" class="btn btn-outline" onclick={addWindow} disabled={locked}>+ Add window</button>
      <button type="button" class="btn btn-primary" onclick={save} disabled={locked}>Save schedule</button>
    </div>

    {#if saved}<p class="msg-success">Schedule saved.</p>{/if}
    {#if saveError}<p class="msg-error">{saveError}</p>{/if}
  {/if}
</section>

<style>
  .schedule-card {
    padding: 24px;
  }

  .card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 20px;
  }

  .card-header h2 {
    margin: 0;
  }

  .window-block + .window-block {
    margin-top: 20px;
    padding-top: 20px;
    border-top: 1px solid var(--border);
  }

  .time-row {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-top: 12px;
  }

  .time-box {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 12px;
    background: var(--surface-low);
    border: 1px solid var(--border-variant);
    border-radius: var(--radius-sm);
  }

  .time-sep {
    color: var(--text-muted);
  }

  .actions {
    display: flex;
    gap: 12px;
    margin-top: 24px;
  }

  .actions .btn {
    flex: 1;
  }
</style>
