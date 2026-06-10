<script lang="ts">
  import { onMount } from 'svelte';
  import { authItem, blocklistItem } from '@/lib/storage';
  import { verifyPassword, deriveKey } from '@/lib/crypto';
  import { cloneBlocklist } from '@/lib/blocklist';
  import { loadBlocklist, setEntryEnabled, syncUnmaskedDomains } from '@/lib/blocklist-session';
  import { isEncryptedMaskedDomain, revealEntry } from '@/lib/masking';
  import { syncBlockerSafe } from '@/lib/messages';
  import type { BlockEntry, BlockEntryKind } from '@/lib/types';
  import Toggle from '@/components/Toggle.svelte';
  import { t } from '@/lib/i18n';

  let {
    locked = false,
    kind,
  }: {
    locked?: boolean;
    kind: BlockEntryKind;
  } = $props();

  const title = $derived(kind === 'site' ? t('hiddenSitesTitle') : t('hiddenKeywordsTitle'));
  const hint = $derived(kind === 'site' ? t('hiddenSitesHint') : t('hiddenKeywordsHint'));
  const revealPlaceholder = $derived(
    kind === 'site' ? t('revealPasswordSites') : t('revealPasswordKeywords'),
  );
  const showButtonLabel = $derived(
    kind === 'site' ? t('showHiddenSites') : t('showHiddenKeywords'),
  );

  function countLabel(count: number): string {
    if (kind === 'site') {
      if (count === 0) return t('hiddenCountNoneSites');
      if (count === 1) return t('hiddenCountOneSite');
      return t('hiddenCountSites', String(count));
    }
    if (count === 0) return t('hiddenCountNoneKeywords');
    if (count === 1) return t('hiddenCountOneKeyword');
    return t('hiddenCountKeywords', String(count));
  }

  let entries = $state<BlockEntry[]>([]);
  let revealed = $state<Record<string, string>>({});
  let listVisible = $state(false);
  let viewKey = $state<CryptoKey | null>(null);
  let viewPassword = $state('');
  let viewError = $state('');
  let viewing = $state(false);
  let actionError = $state('');
  let actionNotice = $state('');
  let loading = $state(true);
  let loadError = $state('');

  const hiddenEntries = $derived(
    entries.filter((e) => e.masked && (e.kind ?? 'site') === kind),
  );

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
      console.error('load hidden list failed:', err);
      loadError = t('loadHiddenError');
    } finally {
      loading = false;
    }
  }

  $effect(() => {
    if (!listVisible || loading) return;
    void hiddenEntries.length;
    void refreshRevealed(viewKey);
  });

  async function refreshRevealed(key: CryptoKey | null) {
    try {
      const map: Record<string, string> = {};
      for (const e of hiddenEntries) {
        if (!isEncryptedMaskedDomain(e.domain)) {
          map[e.id] = e.domain;
        } else if (key) {
          map[e.id] = await revealEntry(e, key);
        }
      }
      revealed = map;
      if (key) {
        await syncUnmaskedDomains(entries, key);
        await syncBlockerSafe();
      }
    } catch (err) {
      console.error('reveal hidden list failed:', err);
      viewError = t('decryptHiddenError');
      hideList();
    }
  }

  function display(e: BlockEntry): string {
    return revealed[e.id] ?? '••••••••••••';
  }

  async function showList() {
    viewError = '';
    viewing = true;
    try {
      const auth = await authItem.getValue();
      if (!auth) {
        viewError = t('setPasswordFirst');
        return;
      }
      if (!(await verifyPassword(viewPassword, auth))) {
        viewError = t('wrongPassword');
        return;
      }
      const key = await deriveKey(viewPassword, auth.salt);
      viewPassword = '';
      viewKey = key;
      listVisible = true;
      await refreshRevealed(key);
    } finally {
      viewing = false;
    }
  }

  function hideList() {
    listVisible = false;
    viewKey = null;
    viewPassword = '';
    viewError = '';
    revealed = {};
  }

  async function persist(next: BlockEntry[]): Promise<boolean> {
    const plain = cloneBlocklist(next);
    await blocklistItem.setValue(plain);
    entries = plain;
    return syncBlockerSafe();
  }

  async function remove(id: string) {
    actionError = '';
    actionNotice = '';
    if (!listVisible) {
      actionError = t('showToRemove');
      return;
    }
    try {
      const next = cloneBlocklist(entries).filter((e) => e.id !== id);
      const synced = await persist(next);
      await refreshRevealed(viewKey);
      if (!synced) actionNotice = t('savedRulesRefresh');
    } catch (err) {
      console.error('remove hidden entry failed:', err);
      actionError = t('updateHiddenError');
    }
  }

  async function toggleEnabled(id: string, enabled: boolean) {
    actionError = '';
    actionNotice = '';
    if (!listVisible) {
      actionError = t('showToChange');
      return;
    }
    if (locked) {
      actionError = t('unlockToEditDuringSchedule');
      return;
    }
    try {
      const next = await setEntryEnabled(id, enabled);
      entries = next;
      await refreshRevealed(viewKey);
      await syncBlockerSafe();
    } catch (err) {
      console.error('toggle hidden entry failed:', err);
      actionError = t('updateHiddenEntryError');
    }
  }
</script>

<section class="card hidden-section">
  <h2 class="text-headline-md section-title">{title}</h2>
  <p class="text-body-muted section-hint">{hint}</p>

  {#if loading}
    <p class="msg-muted">{t('loading')}</p>
  {:else if loadError}
    <p class="msg-error">{loadError}</p>
  {:else if !listVisible}
    <p class="hidden-summary">{countLabel(hiddenEntries.length)}</p>
    <div class="reveal-form">
      <input
        class="input"
        type="password"
        bind:value={viewPassword}
        placeholder={revealPlaceholder}
        disabled={viewing}
      />
      <button
        type="button"
        class="btn btn-outline"
        onclick={showList}
        disabled={viewing || hiddenEntries.length === 0}
      >
        {viewing ? t('checking') : showButtonLabel}
      </button>
    </div>
    {#if viewError}<p class="msg-error">{viewError}</p>{/if}
  {:else}
    <div class="visible-header">
      <p class="text-label">{t('showingHiddenCount', countLabel(hiddenEntries.length))}</p>
      <button type="button" class="btn btn-outline btn-sm" onclick={hideList}>{t('hideAgain')}</button>
    </div>

    {#if hiddenEntries.length === 0}
      <p class="empty-state">{countLabel(0)}</p>
    {:else}
      <div class="site-list">
        {#each hiddenEntries as e (e.id)}
          <div class="list-row" class:row-disabled={e.enabled === false}>
            <div class="list-row-left">
              <span class="lock-icon" aria-hidden="true">&#x1F512;</span>
              <span class="domain">{display(e)}</span>
              {#if kind === 'keyword'}<span class="tag">{t('keywordTag')}</span>{/if}
              {#if e.enabled === false}<span class="tag">{t('paused')}</span>{/if}
            </div>
            <div class="row-actions">
              <Toggle
                checked={e.enabled !== false}
                disabled={locked}
                ariaLabel={t('ariaBlockingEnabledFor', display(e))}
                onchange={(enabled) => toggleEnabled(e.id, enabled)}
              />
              <button
                type="button"
                class="btn-icon"
                onclick={() => remove(e.id)}
                disabled={locked}
                aria-label={t('ariaRemoveItem', display(e))}
              >
                &#x2715;
              </button>
            </div>
          </div>
        {/each}
      </div>
    {/if}
  {/if}

  {#if actionError}<p class="msg-error">{actionError}</p>{/if}
  {#if actionNotice}<p class="msg-success">{actionNotice}</p>{/if}
</section>

<style>
  .hidden-section {
    margin-top: 24px;
  }

  .section-title {
    margin: 0 0 8px;
  }

  .section-hint {
    margin: 0 0 20px;
    font-size: 14px;
  }

  .hidden-summary {
    margin: 0 0 12px;
    font-size: 14px;
    color: var(--text-muted);
  }

  .reveal-form {
    display: flex;
    gap: 8px;
    margin-bottom: 8px;
  }

  .reveal-form .input {
    flex: 1;
  }

  .visible-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 16px;
  }

  .site-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-bottom: 8px;
  }

  .domain {
    font-size: 14px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .lock-icon {
    font-size: 14px;
    flex-shrink: 0;
  }

  .row-disabled .domain {
    opacity: 0.55;
  }

  .row-actions {
    display: flex;
    align-items: center;
    gap: 8px;
  }
</style>
