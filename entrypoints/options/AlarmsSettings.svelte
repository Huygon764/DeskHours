<script lang="ts">
  import { alarmsItem } from '@/lib/storage';
  import { newAlarm, normalizeAlarm, MAX_ALARMS } from '@/lib/alarm';
  import type { AlarmItem } from '@/lib/types';
  import { t } from '@/lib/i18n';
  import Toggle from '@/components/Toggle.svelte';

  let alarms = $state<AlarmItem[]>([]);
  let loaded = $state(false);

  const DAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'] as const;
  const DAY_VALUES = [1, 2, 3, 4, 5, 6, 7] as const;

  const atCap = $derived(alarms.length >= MAX_ALARMS);

  // Seed from storage and stay live: the background disables one-time alarms
  // after they fire, so the list must reflect external writes, not just a
  // one-time load. Local mutations persist and echo back through this watch.
  $effect(() => {
    const apply = (raw: AlarmItem[]) => {
      alarms = raw.map(normalizeAlarm);
      loaded = true;
    };
    const unwatch = alarmsItem.watch(apply);
    void alarmsItem.getValue().then(apply, (err) => {
      console.error('load alarms failed:', err);
      loaded = true;
    });
    return () => unwatch();
  });

  async function persist() {
    await alarmsItem.setValue(alarms.map(normalizeAlarm));
  }

  function addAlarm() {
    if (atCap) return;
    alarms = [...alarms, newAlarm(Date.now())];
    void persist();
  }

  function removeAlarm(id: string) {
    alarms = alarms.filter((a) => a.id !== id);
    void persist();
  }

  function patch(id: string, change: Partial<AlarmItem>) {
    alarms = alarms.map((a) => (a.id === id ? { ...a, ...change } : a));
    void persist();
  }

  function toggleDay(a: AlarmItem, day: number) {
    const days = a.days.includes(day) ? a.days.filter((d) => d !== day) : [...a.days, day];
    patch(a.id, { days });
  }
</script>

<section class="card alarms-card">
  <div class="card-header">
    <h2 class="text-headline-md">{t('alarmsSectionTitle')}</h2>
  </div>
  <p class="text-body-muted">{t('alarmsSectionHint')}</p>

  {#if !loaded}
    <p class="msg-muted">{t('loading')}</p>
  {:else}
    {#each alarms as a (a.id)}
      <div class="alarm-block" class:disabled={!a.enabled}>
        <div class="alarm-row">
          <input
            class="input-inline time"
            type="time"
            value={a.time}
            onchange={(e) => patch(a.id, { time: (e.currentTarget as HTMLInputElement).value })}
          />
          <input
            class="input-inline label"
            type="text"
            value={a.label}
            placeholder={t('alarmLabelPlaceholder')}
            oninput={(e) => patch(a.id, { label: (e.currentTarget as HTMLInputElement).value })}
          />
          <Toggle
            checked={a.enabled}
            ariaLabel={t('ariaToggleAlarm')}
            onchange={(enabled) => patch(a.id, { enabled })}
          />
          <button
            type="button"
            class="btn-icon"
            onclick={() => removeAlarm(a.id)}
            aria-label={t('ariaRemoveAlarm')}
            title={t('ariaRemoveAlarm')}
          >&#x2715;</button>
        </div>

        <div class="mode-row">
          <div class="segmented">
            <button
              type="button"
              class="seg"
              class:selected={a.repeat === 'once'}
              onclick={() => patch(a.id, { repeat: 'once' })}
            >{t('alarmRepeatOnce')}</button>
            <button
              type="button"
              class="seg"
              class:selected={a.repeat === 'weekly'}
              onclick={() => patch(a.id, { repeat: 'weekly' })}
            >{t('alarmRepeatWeekly')}</button>
          </div>

          {#if a.repeat === 'once'}
            <input
              class="input-inline date"
              type="date"
              value={a.date ?? ''}
              onchange={(e) => patch(a.id, { date: (e.currentTarget as HTMLInputElement).value || null })}
            />
          {:else}
            <div class="day-pills">
              {#each DAY_VALUES as day, di}
                <button
                  type="button"
                  class="day-pill"
                  class:selected={a.days.includes(day)}
                  onclick={() => toggleDay(a, day)}
                >{DAYS[di]}</button>
              {/each}
            </div>
          {/if}
        </div>
      </div>
    {/each}

    <div class="actions">
      <button type="button" class="btn btn-outline" onclick={addAlarm} disabled={atCap}>
        {t('addAlarm')}
      </button>
    </div>
    {#if atCap}<p class="text-body-muted">{t('alarmsFull')}</p>{/if}
  {/if}
</section>

<style>
  .alarms-card {
    padding: 24px;
  }
  .card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 8px;
  }
  .card-header h2 {
    margin: 0;
  }
  .alarm-block {
    margin-top: 16px;
    padding-top: 16px;
    border-top: 1px solid var(--border);
  }
  .alarm-block.disabled {
    opacity: 0.55;
  }
  .alarm-row {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .alarm-row .label {
    flex: 1;
  }
  .mode-row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 12px;
    margin-top: 12px;
  }
  .segmented {
    display: inline-flex;
    border: 1px solid var(--border-variant);
    border-radius: var(--radius-sm);
    overflow: hidden;
  }
  .seg {
    padding: 6px 12px;
    background: var(--surface-low);
    cursor: pointer;
    border: none;
  }
  .seg.selected {
    background: var(--preset-selected-bg);
    color: var(--text-strong);
  }
  .actions {
    display: flex;
    gap: 12px;
    margin-top: 20px;
  }
</style>
