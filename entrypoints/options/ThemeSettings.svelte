<script lang="ts">
  import { themeItem } from '@/lib/storage';
  import type { ThemePreference } from '@/lib/theme';

  let preference = $state<ThemePreference>('system');

  const options: { value: ThemePreference; label: string; hint: string }[] = [
    { value: 'system', label: 'System', hint: 'Match your OS light or dark mode' },
    { value: 'light', label: 'Light', hint: 'Soft Sand palette' },
    { value: 'dark', label: 'Dark', hint: 'Warm charcoal palette' },
  ];

  $effect(() => {
    void themeItem.getValue().then((v) => (preference = v));
    return themeItem.watch((v) => (preference = v));
  });

  async function select(value: ThemePreference) {
    if (preference === value) return;
    await themeItem.setValue(value);
  }
</script>

<section class="card theme-card">
  <h2 class="text-headline-md section-title">Appearance</h2>
  <p class="text-body-muted intro">Choose how Site Blocker looks in the popup, settings, and blocked page.</p>

  <div class="theme-options" role="radiogroup" aria-label="Theme">
    {#each options as opt (opt.value)}
      <button
        type="button"
        class="theme-option"
        class:selected={preference === opt.value}
        role="radio"
        aria-checked={preference === opt.value}
        onclick={() => select(opt.value)}
      >
        <span class="theme-option-label">{opt.label}</span>
        <span class="theme-option-hint">{opt.hint}</span>
      </button>
    {/each}
  </div>
</section>

<style>
  .section-title {
    margin: 0 0 8px;
  }

  .intro {
    margin: 0 0 20px;
  }

  .theme-options {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 8px;
  }

  @media (max-width: 520px) {
    .theme-options {
      grid-template-columns: 1fr;
    }
  }

  .theme-option {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 4px;
    padding: 12px;
    border: 1px solid var(--border-variant);
    border-radius: var(--radius-sm);
    background: var(--surface-low);
    text-align: left;
    cursor: pointer;
    transition: border-color 0.15s, background 0.15s;
  }

  .theme-option:hover:not(:disabled) {
    border-color: var(--border);
    background: var(--surface-muted);
  }

  .theme-option.selected {
    border-color: var(--amber);
    background: var(--preset-selected-bg);
  }

  .theme-option-label {
    font-size: 14px;
    font-weight: 600;
    color: var(--text-strong);
  }

  .theme-option-hint {
    font-size: 12px;
    color: var(--text-muted);
    line-height: 1.3;
  }
</style>
