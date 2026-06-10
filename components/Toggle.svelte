<script lang="ts">
  let {
    checked = false,
    disabled = false,
    label = '',
    ariaLabel = 'Toggle',
    onchange = (_value: boolean) => {},
  }: {
    checked?: boolean;
    disabled?: boolean;
    label?: string;
    ariaLabel?: string;
    onchange?: (checked: boolean) => void;
  } = $props();

  function handleChange(event: Event) {
    onchange((event.currentTarget as HTMLInputElement).checked);
  }
</script>

<label class="toggle-switch" class:has-label={!!label} class:is-disabled={disabled}>
  <input
    type="checkbox"
    class="toggle-input"
    {checked}
    {disabled}
    aria-label={label || ariaLabel}
    onchange={handleChange}
  />
  <span class="toggle-track" aria-hidden="true">
    <span class="toggle-knob"></span>
  </span>
  {#if label}<span class="toggle-label">{label}</span>{/if}
</label>

<style>
  .toggle-switch {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    cursor: pointer;
    user-select: none;
  }

  .toggle-switch.is-disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .toggle-input {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }

  .toggle-track {
    position: relative;
    width: 44px;
    height: 26px;
    flex-shrink: 0;
    border-radius: 999px;
    background: var(--toggle-track);
    border: 1px solid var(--toggle-track-border);
    transition: background 0.2s ease, border-color 0.2s ease;
  }

  .toggle-knob {
    position: absolute;
    top: 2px;
    left: 2px;
    width: 20px;
    height: 20px;
    border-radius: 999px;
    background: var(--toggle-knob);
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.18);
    transition: transform 0.2s ease;
  }

  .toggle-input:checked + .toggle-track {
    background: var(--toggle-on);
    border-color: var(--toggle-on-border);
  }

  .toggle-input:checked + .toggle-track .toggle-knob {
    transform: translateX(18px);
  }

  .toggle-input:focus-visible + .toggle-track {
    outline: 2px solid var(--amber-ring);
    outline-offset: 2px;
  }

  .toggle-label {
    font-size: 13px;
    color: var(--text);
  }
</style>
