<script lang="ts">
  import { pomodoroItem } from '@/lib/storage';
  import { isPaused, remainingMs, displaySecondsFromMs, formatMmSs, matchesPreset, parseMinutesInput, POMODORO_PRESETS, withDurations } from '@/lib/pomodoro';
  import { pausePomodoro, resumePomodoro } from '@/lib/pomodoro-controller';
  import { BG_MESSAGE, sendBg } from '@/lib/messages';
  import { useNow, useStored } from '@/lib/reactive.svelte';
  import { pomodoroPresetLabel, t } from '@/lib/i18n';

  let editingField = $state<'workMinutes' | 'restMinutes' | null>(null);
  let fieldDraft = $state('');

  const clock = useNow();
  const stored = useStored(pomodoroItem, { onChange: () => clock.sync() });
  const state = $derived(stored.value);
  const now = $derived(clock.value);

  const remaining = $derived(state ? remainingMs(state, now) : 0);
  const mmss = $derived(formatMmSs(displaySecondsFromMs(remaining)));

  const idle = $derived(state?.phase === 'idle');
  const running = $derived(state != null && state.phase !== 'idle');
  const paused = $derived(state != null && isPaused(state));

  async function setDurations(workMinutes: number, restMinutes: number) {
    if (!idle) return;
    await pomodoroItem.setValue(withDurations(workMinutes, restMinutes));
  }

  async function bump(field: 'workMinutes' | 'restMinutes', delta: number) {
    if (!state || !idle) return;
    const next = state[field] + delta;
    await setDurations(
      field === 'workMinutes' ? next : state.workMinutes,
      field === 'restMinutes' ? next : state.restMinutes,
    );
  }

  async function commitField(field: 'workMinutes' | 'restMinutes', raw: string) {
    if (!state || !idle) return;
    const value = parseMinutesInput(raw, state[field]);
    await setDurations(
      field === 'workMinutes' ? value : state.workMinutes,
      field === 'restMinutes' ? value : state.restMinutes,
    );
  }

  function fieldValue(field: 'workMinutes' | 'restMinutes'): string {
    if (editingField === field) return fieldDraft;
    return String(state?.[field] ?? '');
  }

  function startFieldEdit(field: 'workMinutes' | 'restMinutes', event: FocusEvent) {
    if (!state || !idle) return;
    editingField = field;
    fieldDraft = String(state[field]);
    (event.currentTarget as HTMLInputElement).select();
  }

  function onFieldInput(event: Event) {
    const el = event.currentTarget as HTMLInputElement;
    fieldDraft = el.value.replace(/\D/g, '').slice(0, 3);
    el.value = fieldDraft;
  }

  async function finishFieldEdit(field: 'workMinutes' | 'restMinutes') {
    if (editingField !== field) return;
    editingField = null;
    await commitField(field, fieldDraft);
  }

  function onFieldKeydown(field: 'workMinutes' | 'restMinutes', event: KeyboardEvent) {
    if (event.key === 'Enter') {
      event.preventDefault();
      void finishFieldEdit(field);
      (event.currentTarget as HTMLInputElement).blur();
    }
  }
</script>

{#if !state}
  <p class="msg-muted loading">{t('loading')}</p>
{:else if idle}
  <div class="timer-section">
    <div class="text-timer idle-preview">{String(state.workMinutes).padStart(2, '0')}:00</div>
    <button class="btn btn-primary btn-block" onclick={() => sendBg({ type: BG_MESSAGE.POMODORO_START })}>
      {t('startFocus')}
    </button>
  </div>

  <div class="preset-section">
    <span class="text-label">{t('preset')}</span>
    <div class="presets">
      {#each POMODORO_PRESETS as preset (preset.id)}
        <button
          type="button"
          class="btn btn-outline btn-sm preset"
          class:preset-active={matchesPreset(state, preset)}
          disabled={!idle}
          onclick={() => setDurations(preset.workMinutes, preset.restMinutes)}
        >
          {pomodoroPresetLabel(preset.id)} {preset.workMinutes}/{preset.restMinutes}
        </button>
      {/each}
    </div>
  </div>

  <div class="duration-grid">
    <div class="duration-col">
      <span class="text-label">{t('work')}</span>
      <div class="stepper">
        <button class="stepper-btn" onclick={() => bump('workMinutes', -1)} disabled={!idle} aria-label={t('ariaDecreaseWork')}>−</button>
        <input
          class="stepper-input"
          type="text"
          inputmode="numeric"
          aria-label={t('ariaWorkMinutes')}
          value={fieldValue('workMinutes')}
          disabled={!idle}
          onfocus={(event) => startFieldEdit('workMinutes', event)}
          oninput={onFieldInput}
          onblur={() => void finishFieldEdit('workMinutes')}
          onkeydown={(event) => onFieldKeydown('workMinutes', event)}
        />
        <button class="stepper-btn" onclick={() => bump('workMinutes', 1)} disabled={!idle} aria-label={t('ariaIncreaseWork')}>+</button>
      </div>
    </div>
    <div class="duration-col">
      <span class="text-label">{t('rest')}</span>
      <div class="stepper">
        <button class="stepper-btn" onclick={() => bump('restMinutes', -1)} disabled={!idle} aria-label={t('ariaDecreaseRest')}>−</button>
        <input
          class="stepper-input"
          type="text"
          inputmode="numeric"
          aria-label={t('ariaRestMinutes')}
          value={fieldValue('restMinutes')}
          disabled={!idle}
          onfocus={(event) => startFieldEdit('restMinutes', event)}
          oninput={onFieldInput}
          onblur={() => void finishFieldEdit('restMinutes')}
          onkeydown={(event) => onFieldKeydown('restMinutes', event)}
        />
        <button class="stepper-btn" onclick={() => bump('restMinutes', 1)} disabled={!idle} aria-label={t('ariaIncreaseRest')}>+</button>
      </div>
    </div>
  </div>
{:else if running}
  <div class="timer-section">
    <p class="phase-label">
      {#if paused}{t('pausedDash')} {state.phase === 'work' ? t('work') : t('rest')}{:else}{state.phase === 'work' ? t('phaseFocus') : t('phaseRest')}{/if}
    </p>
    <div class="text-timer" class:timer-paused={paused}>{mmss}</div>
  </div>
{/if}

{#if running && state}
  <div class="running-bar">
    <div class="running-meta">
      <span class="text-label">
        {#if paused}{t('paused')}{:else}{state.phase === 'work' ? t('workSession') : t('restBreak')}{/if}
      </span>
      <span class="text-timer-sm">{mmss}</span>
    </div>
    {#if paused}
      <button class="btn btn-primary btn-block" onclick={() => void resumePomodoro()}>
        {t('resume')}
      </button>
    {:else}
      <button class="btn btn-outline btn-block" onclick={() => void pausePomodoro()}>
        {t('pause')}
      </button>
    {/if}
    <button class="btn btn-danger-outline btn-block end-btn" onclick={() => sendBg({ type: BG_MESSAGE.POMODORO_STOP })}>
      {t('endSession')}
    </button>
  </div>
{/if}

<style>
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
  }

  .preset-section {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-bottom: 16px;
  }

  .presets {
    display: flex;
    gap: 8px;
  }

  .preset {
    flex: 1;
  }

  .preset-active {
    border-color: var(--amber);
    color: var(--text-strong);
    background: var(--surface-low);
  }

  .duration-col {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .running-bar {
    margin-top: 8px;
    padding-top: 16px;
    border-top: 1px solid var(--border-variant);
  }

  .running-meta {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 8px;
  }

  .timer-paused {
    opacity: 0.55;
  }

  .running-bar .btn-block + .btn-block {
    margin-top: 8px;
  }

  .end-btn {
    margin-top: 8px;
  }
</style>
