<script lang="ts">
  import { displaySecondsFromMs } from '@/lib/pomodoro';
  import { timerItem } from '@/lib/storage';
  import {
    addDurationSeconds,
    formatHhMmSs,
    isTimerFinished,
    isTimerIdle,
    isTimerPaused,
    isTimerRunning,
    normalizeTimerState,
    timerRemainingMs,
    withDurationSeconds,
  } from '@/lib/timer';
  import {
    pauseTimer,
    resetTimer,
    resumeTimer,
    setTimerSoundEnabled,
    startTimer,
    stopTimerAlert,
  } from '@/lib/timer-controller';
  import Toggle from '@/components/Toggle.svelte';
  import TimerDurationInput from './TimerDurationInput.svelte';
  import { useNow, useStored } from '@/lib/reactive.svelte';
  import { t } from '@/lib/i18n';

  let editing = $state(false);

  const clock = useNow();
  const stored = useStored(timerItem, { transform: normalizeTimerState, onChange: () => clock.sync() });
  const state = $derived(stored.value);
  const now = $derived(clock.value);

  const idle = $derived(state != null && isTimerIdle(state));
  const running = $derived(state != null && isTimerRunning(state) && !isTimerPaused(state));
  const paused = $derived(state != null && isTimerPaused(state));
  const finished = $derived(state != null && isTimerFinished(state));

  const displaySeconds = $derived.by(() => {
    if (!state) return 0;
    if (idle) return state.durationSeconds;
    if (finished) return 0;
    return displaySecondsFromMs(timerRemainingMs(state, now));
  });

  const hhmmss = $derived(formatHhMmSs(displaySeconds));

  function beginEdit() {
    if (!state || !idle) return;
    editing = true;
  }

  async function commitDuration(seconds: number) {
    if (!state || !idle) return;
    await timerItem.setValue(withDurationSeconds(state, seconds));
    editing = false;
  }

  async function addSeconds(delta: number) {
    if (!state || !idle) return;
    await timerItem.setValue(addDurationSeconds(state, delta));
  }
</script>

{#if !state}
  <p class="msg-muted loading">{t('loading')}</p>
{:else}
  <div class="timer-section" class:timer-section-done={finished}>
    <p class="phase-label">
      {#if finished}{t('timesUp')}{:else if paused}{t('paused')}{:else if running}{t('countingDown')}{:else}{t('tapToEdit')}{/if}
    </p>

    {#if finished}
      <div class="text-timer text-timer-hms time-done" aria-live="polite">00:00:00</div>
    {:else if idle && editing}
      <TimerDurationInput
        totalSeconds={state.durationSeconds}
        oncommit={(seconds) => void commitDuration(seconds)}
        oncancel={() => (editing = false)}
      />
    {:else}
      <button
        type="button"
        class="text-timer text-timer-hms time-display"
        class:timer-paused={paused}
        class:time-display-idle={idle}
        disabled={!idle}
        onclick={beginEdit}
        aria-label={idle ? t('ariaEditDuration') : hhmmss}
      >
        {hhmmss}
      </button>
    {/if}
  </div>

  {#if idle}
    <div class="quick-adds">
      <button class="btn btn-outline btn-sm" onclick={() => addSeconds(30)}>+30s</button>
      <button class="btn btn-outline btn-sm" onclick={() => addSeconds(60)}>+1m</button>
      <button class="btn btn-outline btn-sm" onclick={() => addSeconds(5 * 60)}>+5m</button>
    </div>

    <button class="btn btn-primary btn-block" onclick={() => void startTimer()}>
      {t('startTimer')}
    </button>
  {:else if finished}
    <p class="done-hint">{t('stopAlertHint')}</p>
    <button class="btn btn-outline btn-block" onclick={() => void stopTimerAlert()}>
      {t('stopAlert')}
    </button>
    <button class="btn btn-primary btn-block reset-done-btn" onclick={() => void resetTimer()}>
      {t('reset')}
    </button>
  {:else}
    <div class="active-actions">
      {#if paused}
        <button class="btn btn-primary btn-block" onclick={() => void resumeTimer()}>
          {t('resume')}
        </button>
      {:else}
        <button class="btn btn-outline btn-block" onclick={() => void pauseTimer()}>
          {t('pause')}
        </button>
      {/if}
      <button class="btn btn-danger-outline btn-block" onclick={() => void resetTimer()}>
        {t('reset')}
      </button>
    </div>
  {/if}

  {#if idle}
    <div class="sound-row">
      <Toggle
        checked={state.soundEnabled}
        label={t('sound')}
        onchange={(enabled) => void setTimerSoundEnabled(enabled)}
      />
    </div>
  {/if}
{/if}

<style>
  .timer-section {
    text-align: center;
    margin-bottom: 20px;
  }

  .timer-section-done {
    padding: 12px 0 4px;
    border-radius: 12px;
    background: var(--amber-bg);
    border: 1px solid var(--amber-border);
  }

  .timer-section-done .phase-label,
  .timer-section-done .time-done {
    color: var(--amber-text);
  }

  .phase-label {
    margin: 0 0 8px;
    font-size: 12px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: var(--text-muted);
  }

  .text-timer-hms {
    font-size: 36px;
  }

  .time-done {
    line-height: 1;
    margin: 8px 0 4px;
  }

  .time-display {
    border: none;
    background: none;
    padding: 0;
    cursor: default;
    width: 100%;
  }

  .time-display-idle {
    cursor: pointer;
    border-radius: 8px;
  }

  .time-display-idle:hover {
    background: var(--surface-low);
  }

  .timer-paused {
    opacity: 0.55;
  }

  .quick-adds {
    display: flex;
    gap: 8px;
    margin-bottom: 16px;
  }

  .quick-adds .btn {
    flex: 1;
  }

  .done-hint {
    margin: 0 0 12px;
    font-size: 13px;
    color: var(--text-muted);
    text-align: center;
  }

  .reset-done-btn {
    margin-top: 8px;
  }

  .active-actions .btn-block + .btn-block {
    margin-top: 8px;
  }

  .sound-row {
    margin-top: 16px;
    padding-top: 16px;
    border-top: 1px solid var(--border-variant);
  }
</style>
