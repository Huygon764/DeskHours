<script lang="ts" generics="T extends string">
  import { t } from '@/lib/i18n';

  /** Minimal shape of a WXT storage item this control needs. */
  interface StorageLike {
    getValue(): Promise<T>;
    setValue(value: T): Promise<unknown>;
    watch(cb: (value: T) => void): () => void;
  }

  let {
    item,
    titleKey,
    introKey,
    ariaKey,
    options,
  }: {
    item: StorageLike;
    titleKey: string;
    introKey: string;
    ariaKey: string;
    options: { value: T; labelKey: string; hintKey: string }[];
  } = $props();

  let preference = $state<T | null>(null);

  $effect(() => {
    void item.getValue().then((v) => (preference = v));
    return item.watch((v) => (preference = v));
  });

  async function select(value: T) {
    if (preference === value) return;
    await item.setValue(value);
  }
</script>

<section class="card">
  <h2 class="text-headline-md section-title">{t(titleKey)}</h2>
  <p class="text-body-muted intro">{t(introKey)}</p>

  <div class="pref-options" role="radiogroup" aria-label={t(ariaKey)}>
    {#each options as opt (opt.value)}
      <button
        type="button"
        class="pref-option"
        class:selected={preference === opt.value}
        role="radio"
        aria-checked={preference === opt.value}
        onclick={() => select(opt.value)}
      >
        <span class="pref-option-label">{t(opt.labelKey)}</span>
        <span class="pref-option-hint">{t(opt.hintKey)}</span>
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

  .pref-options {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 8px;
  }

  @media (max-width: 520px) {
    .pref-options {
      grid-template-columns: 1fr;
    }
  }

  .pref-option {
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

  .pref-option:hover:not(:disabled) {
    border-color: var(--border);
    background: var(--surface-muted);
  }

  .pref-option.selected {
    border-color: var(--amber);
    background: var(--preset-selected-bg);
  }

  .pref-option-label {
    font-size: 14px;
    font-weight: 600;
    color: var(--text-strong);
  }

  .pref-option-hint {
    font-size: 12px;
    color: var(--text-muted);
    line-height: 1.3;
  }
</style>
