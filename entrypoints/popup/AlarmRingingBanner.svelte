<script lang="ts">
  import { alarmsItem, ringingAlarmsItem } from '@/lib/storage';
  import { normalizeAlarm } from '@/lib/alarm';
  import { dismissAlarm } from '@/lib/alarm-controller';
  import type { AlarmItem } from '@/lib/types';
  import { t } from '@/lib/i18n';
  import { useStored } from '@/lib/reactive.svelte';

  const alarmsStore = useStored(alarmsItem, { transform: (raw) => raw.map(normalizeAlarm) });
  const ringingStore = useStored(ringingAlarmsItem);

  const ringing = $derived(
    (ringingStore.value ?? [])
      .map((id) => (alarmsStore.value ?? []).find((a) => a.id === id))
      .filter((a): a is AlarmItem => a != null),
  );
</script>

{#if ringing.length > 0}
  <div class="ringing-banner">
    {#each ringing as a (a.id)}
      <div class="ringing-row">
        <span class="ringing-icon" aria-hidden="true">&#x23F0;</span>
        <span class="ringing-label">{a.label.trim() || t('alarmDefaultLabel')}</span>
        <button
          type="button"
          class="btn btn-sm btn-primary"
          onclick={() => void dismissAlarm(a.id)}
        >{t('alarmDismiss')}</button>
      </div>
    {/each}
  </div>
{/if}

<style>
  .ringing-banner {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 12px 16px;
    background: var(--preset-selected-bg);
    border-bottom: 1px solid var(--border);
  }
  .ringing-row {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .ringing-icon {
    font-size: 18px;
  }
  .ringing-label {
    flex: 1;
    font-weight: 600;
    color: var(--text-strong);
  }
</style>
