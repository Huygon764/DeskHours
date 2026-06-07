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
  const DAYS = [['Mon', 1], ['Tue', 2], ['Wed', 3], ['Thu', 4], ['Fri', 5], ['Sat', 6], ['Sun', 7]] as const;

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

<section>
  <h2>Schedule</h2>
  {#if !loaded}
    <p>Loading…</p>
  {:else}
    {#each windows as w, i}
      <div class="row">
        {#each DAYS as [label, day]}
          <label
            ><input
              type="checkbox"
              checked={w.days.includes(day)}
              disabled={locked}
              onchange={() => toggleDay(i, day)}
            />{label}</label
          >
        {/each}
        <input type="time" bind:value={w.start} disabled={locked} />
        <input type="time" bind:value={w.end} disabled={locked} />
        <button onclick={() => removeWindow(i)} disabled={locked}>Remove</button>
      </div>
    {/each}
    <button onclick={addWindow} disabled={locked}>Add window</button>
    <button onclick={save} disabled={locked}>Save schedule</button>
    {#if saved}<p class="ok">Schedule saved.</p>{/if}
    {#if saveError}<p class="error">{saveError}</p>{/if}
  {/if}
</section>

<style>
  .row {
    display: flex;
    gap: 0.5rem;
    align-items: center;
    margin: 0.5rem 0;
    flex-wrap: wrap;
  }
  .ok { color: #1e7e34; margin-top: 0.5rem; font-weight: 600; }
  .error { color: #c0392b; margin-top: 0.5rem; }
</style>
