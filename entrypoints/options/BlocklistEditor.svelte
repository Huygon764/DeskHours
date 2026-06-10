<script lang="ts">
  import { onMount } from 'svelte';
  import { blocklistItem } from '@/lib/storage';
  import { cloneBlocklist, normalizeKeyword, normalizePattern } from '@/lib/blocklist';
  import { hasBlockedPattern, loadBlocklist, setEntryEnabled } from '@/lib/blocklist-session';
  import { syncBlockerSafe } from '@/lib/messages';
  import type { BlockEntry } from '@/lib/types';
  import Toggle from '@/components/Toggle.svelte';
  import HiddenListEditor from './HiddenListEditor.svelte';
  import { t } from '@/lib/i18n';

  let { locked = false }: { locked?: boolean } = $props();

  let entries = $state<BlockEntry[]>([]);
  let newDomain = $state('');
  let addAsHidden = $state(false);
  let newKeyword = $state('');
  let addKeywordAsHidden = $state(false);
  let addError = $state('');
  let addNotice = $state('');
  let loading = $state(true);
  let loadError = $state('');

  onMount(() => {
    void loadFromStorage();
    const unwatch = blocklistItem.watch((v) => {
      entries = cloneBlocklist(v);
    });
    return () => unwatch();
  });

  async function loadFromStorage() {
    loading = true;
    loadError = '';
    try {
      entries = await loadBlocklist();
    } catch (err) {
      console.error('load blocklist failed:', err);
      loadError = t('loadBlocklistError');
    } finally {
      loading = false;
    }
  }

  const siteEntries = $derived(
    entries.filter((e) => !e.masked && (e.kind ?? 'site') === 'site'),
  );
  const keywordEntries = $derived(
    entries.filter((e) => !e.masked && e.kind === 'keyword'),
  );

  async function persist(next: BlockEntry[]): Promise<boolean> {
    const plain = cloneBlocklist(next);
    await blocklistItem.setValue(plain);
    entries = plain;
    return syncBlockerSafe();
  }

  async function add() {
    addError = '';
    addNotice = '';
    if (locked) {
      addError = t('unlockToEditBlocklist');
      return;
    }
    const domain = normalizePattern(newDomain);
    if (!domain) {
      addError = t('enterDomainError');
      return;
    }
    try {
      const stored = await loadBlocklist();
      if (await hasBlockedPattern(stored, domain, null)) {
        addError = t('alreadyOnList', domain);
        return;
      }

      const id = crypto.randomUUID();
      const next = [
        ...cloneBlocklist(entries),
        { id, domain, masked: addAsHidden, enabled: true, kind: 'site' as const },
      ];
      const synced = await persist(next);
      newDomain = '';
      addAsHidden = false;

      if (!synced) {
        addNotice = t('savedReloadExtension');
      }
    } catch (err) {
      console.error('add blocklist entry failed:', err);
      addError = t('saveBlocklistError');
    }
  }

  async function addKeyword() {
    addError = '';
    addNotice = '';
    if (locked) {
      addError = t('unlockToEditBlocklist');
      return;
    }
    const keyword = normalizeKeyword(newKeyword);
    if (!keyword) {
      addError = t('enterKeywordError');
      return;
    }
    try {
      const stored = await loadBlocklist();
      if (await hasBlockedPattern(stored, keyword, null, 'keyword')) {
        addError = t('keywordAlreadyOnList', keyword);
        return;
      }

      const id = crypto.randomUUID();
      const next = [
        ...cloneBlocklist(entries),
        { id, domain: keyword, masked: addKeywordAsHidden, enabled: true, kind: 'keyword' as const },
      ];
      const synced = await persist(next);
      newKeyword = '';
      addKeywordAsHidden = false;
      if (!synced) {
        addNotice = t('savedReloadUrls');
      }
    } catch (err) {
      console.error('add keyword entry failed:', err);
      addError = t('saveKeywordError');
    }
  }

  async function remove(id: string) {
    addError = '';
    addNotice = '';
    try {
      const next = cloneBlocklist(entries).filter((e) => e.id !== id);
      const synced = await persist(next);
      if (!synced) addNotice = t('savedRulesRefresh');
    } catch (err) {
      console.error('remove blocklist entry failed:', err);
      addError = t('updateBlocklistError');
    }
  }

  async function toggleEnabled(id: string, enabled: boolean) {
    addError = '';
    addNotice = '';
    if (locked) {
      addError = t('unlockToEditBlocklist');
      return;
    }
    try {
      const next = await setEntryEnabled(id, enabled);
      entries = next;
      await syncBlockerSafe();
    } catch (err) {
      console.error('toggle blocklist entry failed:', err);
      addError = t('updateBlocklistError');
    }
  }
</script>

<section class="card">
  <h2 class="text-headline-md section-title">{t('blockedSitesTitle')}</h2>

  {#if locked}
    <p class="hint-banner">{t('blocklistLockedHint')}</p>
  {/if}

  {#if loading}
    <p class="msg-muted">{t('loadingBlocklist')}</p>
  {:else if loadError}
    <p class="msg-error">{loadError}</p>
  {:else if siteEntries.length === 0}
    <p class="empty-state">{t('noSitesBlocked')}</p>
  {:else}
    <div class="site-list">
      {#each siteEntries as e (e.id)}
        <div class="list-row" class:row-disabled={e.enabled === false}>
          <div class="list-row-left">
            <span class="status-dot" class:dot-off={e.enabled === false}></span>
            <span class="domain">{e.domain}</span>
            {#if e.enabled === false}<span class="tag">{t('paused')}</span>{/if}
          </div>
          <div class="row-actions">
            <Toggle
              checked={e.enabled !== false}
              disabled={locked}
              ariaLabel={t('ariaBlockingEnabledFor', e.domain)}
              onchange={(enabled) => toggleEnabled(e.id, enabled)}
            />
            <button
              type="button"
              class="btn-icon"
              onclick={() => remove(e.id)}
              disabled={locked}
              aria-label={t('ariaRemoveItem', e.domain)}
            >
              &#x2715;
            </button>
          </div>
        </div>
      {/each}
    </div>
  {/if}

  <div class="add-form">
    <div class="field">
      <label class="field-label" for="new-domain">{t('addSite')}</label>
      <input id="new-domain" class="input" bind:value={newDomain} placeholder={t('addSitePlaceholder')} disabled={locked} />
    </div>

    <label class="hidden-check">
      <input type="checkbox" bind:checked={addAsHidden} disabled={locked} />
      <span>{t('addToHidden')}</span>
    </label>

    <button type="button" class="btn btn-primary" onclick={add} disabled={locked}>
      {locked ? t('addUnlockRequired') : t('addSite')}
    </button>
  </div>

  {#if addError}<p class="msg-error">{addError}</p>{/if}
  {#if addNotice}<p class="msg-success">{addNotice}</p>{/if}
</section>

<section class="card keyword-section">
  <h2 class="text-headline-md section-title">{t('urlKeywordsTitle')}</h2>
  <p class="text-body-muted section-hint">{t('urlKeywordsHint')}</p>

  {#if locked}
    <p class="hint-banner">{t('keywordsLockedHint')}</p>
  {/if}

  {#if loading}
    <p class="msg-muted">{t('loading')}</p>
  {:else if keywordEntries.length === 0}
    <p class="empty-state">{t('noKeywords')}</p>
  {:else}
    <div class="site-list">
      {#each keywordEntries as e (e.id)}
        <div class="list-row" class:row-disabled={e.enabled === false}>
          <div class="list-row-left">
            <span class="status-dot" class:dot-off={e.enabled === false}></span>
            <span class="domain">{e.domain}</span>
            <span class="tag">{t('keywordTag')}</span>
            {#if e.enabled === false}<span class="tag">{t('paused')}</span>{/if}
          </div>
          <div class="row-actions">
            <Toggle
              checked={e.enabled !== false}
              disabled={locked}
              ariaLabel={t('ariaBlockingEnabledFor', e.domain)}
              onchange={(enabled) => toggleEnabled(e.id, enabled)}
            />
            <button
              type="button"
              class="btn-icon"
              onclick={() => remove(e.id)}
              disabled={locked}
              aria-label={t('ariaRemoveItem', e.domain)}
            >
              &#x2715;
            </button>
          </div>
        </div>
      {/each}
    </div>
  {/if}

  <div class="add-form">
    <div class="field">
      <label class="field-label" for="new-keyword">{t('addKeyword')}</label>
      <input
        id="new-keyword"
        class="input"
        bind:value={newKeyword}
        placeholder={t('addKeywordPlaceholder')}
        disabled={locked}
      />
    </div>
    <label class="hidden-check">
      <input type="checkbox" bind:checked={addKeywordAsHidden} disabled={locked} />
      <span>{t('addToHidden')}</span>
    </label>

    <button type="button" class="btn btn-primary" onclick={addKeyword} disabled={locked}>
      {locked ? t('addUnlockRequired') : t('addKeyword')}
    </button>
  </div>
</section>

<HiddenListEditor {locked} kind="site" />

<HiddenListEditor {locked} kind="keyword" />

<style>
  .section-title {
    margin: 0 0 20px;
  }

  .keyword-section {
    margin-top: 24px;
  }

  .section-hint {
    margin: -12px 0 20px;
    font-size: 14px;
  }

  .hint-banner {
    margin: 0 0 16px;
    padding: 12px;
    border-radius: var(--radius-sm);
    background: var(--amber-bg);
    color: var(--amber-text);
    font-size: 14px;
  }

  .site-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-bottom: 24px;
  }

  .domain {
    font-size: 14px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .add-form {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding-top: 16px;
    border-top: 1px solid var(--border);
  }

  .hidden-check {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 14px;
    color: var(--text-muted);
    cursor: pointer;
  }

  .hidden-check input {
    margin: 0;
  }

  .row-disabled .domain {
    opacity: 0.55;
  }

  .dot-off {
    background: var(--text-subtle);
  }

  .row-actions {
    display: flex;
    align-items: center;
    gap: 8px;
  }
</style>
