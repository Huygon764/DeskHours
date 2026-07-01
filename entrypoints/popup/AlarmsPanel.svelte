<script lang="ts">
  import { alarmsItem } from '@/lib/storage';
  import { normalizeAlarm, nextOccurrence } from '@/lib/alarm';
  import type { AlarmItem } from '@/lib/types';
  import { t } from '@/lib/i18n';
  import { useStored, useNow, useLocaleRevision } from '@/lib/reactive.svelte';

  const stored = useStored(alarmsItem, { transform: (raw) => raw.map(normalizeAlarm) });
  const now = useNow(30_000);
  const rev = useLocaleRevision();

  const alarms = $derived(stored.value ?? []);

  const upcoming = $derived(
    alarms
      .map((a) => ({ alarm: a, at: nextOccurrence(a, now.value) }))
      .filter((x): x is { alarm: AlarmItem; at: number } => x.at != null)
      .sort((a, b) => a.at - b.at)
      .slice(0, 3),
  );

  function formatNext(at: number): string {
    void rev.value;
    const d = new Date(at);
    const day = d.toLocaleDateString(undefined, { weekday: 'short' });
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    return `${day} ${hh}:${mm}`;
  }

  async function toggle(a: AlarmItem) {
    const next = alarms.map((x) => (x.id === a.id ? { ...x, enabled: !x.enabled } : x));
    await alarmsItem.setValue(next.map(normalizeAlarm));
  }
</script>

<section class="alarms-panel">
  <h3 class="text-label">{t('alarmsSectionTitle')}</h3>
  {#key rev.value}
    {#if upcoming.length === 0}
      <p class="text-body-muted">{t('alarmNoneUpcoming')}</p>
    {:else}
      <ul class="alarm-list">
        {#each upcoming as item (item.alarm.id)}
          <li class="alarm-item">
            <div class="alarm-text">
              <span class="alarm-label">{item.alarm.label || t('alarmDefaultLabel')}</span>
              <span class="alarm-next">{t('alarmNextAt', formatNext(item.at))}</span>
            </div>
            <label class="switch">
              <input type="checkbox" checked={item.alarm.enabled} onchange={() => toggle(item.alarm)} />
            </label>
          </li>
        {/each}
      </ul>
    {/if}
  {/key}
</section>

<style>
  .alarms-panel {
    margin-top: 16px;
    padding-top: 16px;
    border-top: 1px solid var(--border);
  }
  .alarm-list {
    list-style: none;
    margin: 8px 0 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .alarm-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }
  .alarm-text {
    display: flex;
    flex-direction: column;
  }
  .alarm-label {
    font-weight: 600;
    color: var(--text-strong);
  }
  .alarm-next {
    font-size: 12px;
    color: var(--text-muted);
  }
</style>
