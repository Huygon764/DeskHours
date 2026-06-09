<script lang="ts">
  import { parseHhMmSs, splitHhMmSs } from '@/lib/timer';

  type Segment = 'seconds' | 'minutes' | 'hours';

  const NEXT: Record<Segment, Segment | null> = {
    seconds: 'minutes',
    minutes: 'hours',
    hours: null,
  };
  const PREV: Record<Segment, Segment | null> = {
    seconds: null,
    minutes: 'seconds',
    hours: 'minutes',
  };

  let {
    totalSeconds,
    oncommit,
    oncancel,
  }: {
    totalSeconds: number;
    oncommit: (seconds: number) => void;
    oncancel?: () => void;
  } = $props();

  let editHours = $state('00');
  let editMinutes = $state('00');
  let editSeconds = $state('00');
  let activeSegment = $state<Segment>('seconds');
  let skipNextFocusPrepare = $state<Segment | null>(null);
  let replaceOnNextInput = $state<Segment | null>(null);
  let hoursInput = $state<HTMLInputElement | null>(null);
  let minutesInput = $state<HTMLInputElement | null>(null);
  let secondsInput = $state<HTMLInputElement | null>(null);

  const inputRefs: Record<Segment, () => HTMLInputElement | null> = {
    hours: () => hoursInput,
    minutes: () => minutesInput,
    seconds: () => secondsInput,
  };

  function loadPreset(seconds: number) {
    const parts = splitHhMmSs(seconds);
    editHours = parts.hours;
    editMinutes = parts.minutes;
    editSeconds = parts.seconds;
  }

  $effect(() => {
    loadPreset(totalSeconds);
    replaceOnNextInput = 'seconds';
    activeSegment = 'seconds';
    skipNextFocusPrepare = 'seconds';
    queueMicrotask(() => focusSegmentEl('seconds', true));
  });

  function segmentValue(segment: Segment): string {
    if (segment === 'hours') return editHours;
    if (segment === 'minutes') return editMinutes;
    return editSeconds;
  }

  function setSegmentValue(segment: Segment, value: string) {
    if (segment === 'hours') editHours = value;
    else if (segment === 'minutes') editMinutes = value;
    else editSeconds = value;
  }

  /** Zero segments to the left of the active field on first keystroke. */
  function resetOnFirstInput(segment: Segment) {
    if (segment === 'seconds') {
      editHours = '00';
      editMinutes = '00';
    } else if (segment === 'minutes') {
      editHours = '00';
      editSeconds = '00';
    } else {
      editMinutes = '00';
      editSeconds = '00';
    }
  }

  function focusSegmentEl(segment: Segment, select = false) {
    queueMicrotask(() => {
      const el = inputRefs[segment]();
      el?.focus();
      if (select) el?.select();
    });
  }

  /** Select segment text; keep other parts unchanged. */
  function prepareSegment(segment: Segment) {
    if (skipNextFocusPrepare === segment) {
      skipNextFocusPrepare = null;
      activeSegment = segment;
      return;
    }
    replaceOnNextInput = segment;
    activeSegment = segment;
    focusSegmentEl(segment, true);
  }

  function commit() {
    const parsed = parseHhMmSs(editHours, editMinutes, editSeconds);
    if (parsed != null) oncommit(parsed);
  }

  function onSegmentInput(segment: Segment, event: Event) {
    const el = event.currentTarget as HTMLInputElement;
    let digits = el.value.replace(/\D/g, '');

    if (replaceOnNextInput === segment) {
      replaceOnNextInput = null;
      resetOnFirstInput(segment);
      digits = digits.slice(-1);
    }

    digits = digits.slice(0, 2);
    setSegmentValue(segment, digits);

    if (digits.length >= 2) {
      const next = NEXT[segment];
      if (next) {
        replaceOnNextInput = next;
        activeSegment = next;
        skipNextFocusPrepare = next;
        focusSegmentEl(next, true);
      } else {
        commit();
      }
    }
  }

  function onSegmentKeydown(segment: Segment, event: KeyboardEvent) {
    if (event.key === 'Enter') {
      event.preventDefault();
      commit();
      return;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      oncancel?.();
      return;
    }
    if (event.key === 'Backspace') {
      const el = event.currentTarget as HTMLInputElement;
      const empty = segmentValue(segment).length === 0;
      const atStart = el.selectionStart === 0 && el.selectionEnd === 0;
      if (empty || atStart) {
        const prev = PREV[segment];
        if (prev) {
          event.preventDefault();
          prepareSegment(prev);
        }
      }
    }
  }

  function onGroupFocusOut(event: FocusEvent) {
    const group = event.currentTarget as HTMLElement;
    if (!group.contains(event.relatedTarget as Node)) commit();
  }
</script>

<div
  class="time-inputs text-timer text-timer-hms"
  role="group"
  aria-label="Edit timer duration"
  onfocusout={onGroupFocusOut}
>
  <input
    bind:this={hoursInput}
    class="time-field"
    class:time-field-active={activeSegment === 'hours'}
    type="text"
    inputmode="numeric"
    aria-label="Hours"
    value={editHours}
    onfocus={() => prepareSegment('hours')}
    oninput={(event) => onSegmentInput('hours', event)}
    onkeydown={(event) => onSegmentKeydown('hours', event)}
  />
  <span class="time-colon">:</span>
  <input
    bind:this={minutesInput}
    class="time-field"
    class:time-field-active={activeSegment === 'minutes'}
    type="text"
    inputmode="numeric"
    aria-label="Minutes"
    value={editMinutes}
    onfocus={() => prepareSegment('minutes')}
    oninput={(event) => onSegmentInput('minutes', event)}
    onkeydown={(event) => onSegmentKeydown('minutes', event)}
  />
  <span class="time-colon">:</span>
  <input
    bind:this={secondsInput}
    class="time-field"
    class:time-field-active={activeSegment === 'seconds'}
    type="text"
    inputmode="numeric"
    aria-label="Seconds"
    value={editSeconds}
    onfocus={() => prepareSegment('seconds')}
    oninput={(event) => onSegmentInput('seconds', event)}
    onkeydown={(event) => onSegmentKeydown('seconds', event)}
  />
</div>

<style>
  .time-inputs {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 2px;
    margin: 0;
  }

  .text-timer-hms {
    font-size: 36px;
  }

  .time-field {
    width: 2.2ch;
    border: none;
    background: transparent;
    font: inherit;
    font-size: inherit;
    font-weight: inherit;
    font-variant-numeric: tabular-nums;
    color: inherit;
    text-align: center;
    padding: 0 0 2px;
    outline: none;
    border-bottom: 2px solid transparent;
    cursor: text;
  }

  .time-field-active {
    border-bottom-color: var(--amber);
  }

  .time-colon {
    line-height: 1;
    opacity: 0.7;
  }
</style>
