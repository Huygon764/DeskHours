<script lang="ts">
  import { authItem, blocklistItem } from '@/lib/storage';
  import { keyFromPassword, syncUnmaskedDomains } from '@/lib/blocklist-session';
  import { verifyPassword, deriveKey } from '@/lib/crypto';
  import {
    addPattern,
    domainPatternFromUrl,
    pageBlockStatus,
    pathPatternFromUrl,
    toggleEntry,
    type PageBlockStatus,
  } from '@/lib/popup-tab';
  import { cloneBlocklist, normalizeEntry } from '@/lib/blocklist';
  import type { BlockEntry } from '@/lib/types';
  import Toggle from '@/components/Toggle.svelte';
  import { t } from '@/lib/i18n';

  let { blockingNow = false }: { blockingNow?: boolean } = $props();

  let tabUrl = $state('');
  let entries = $state<BlockEntry[]>([]);
  let status = $state<PageBlockStatus>({ kind: 'none' });
  let cryptoKey = $state<CryptoKey | null>(null);
  let unlocked = $state(false);
  let pw = $state('');
  let unlockError = $state('');
  let actionError = $state('');
  let loading = $state(true);
  let busy = $state(false);

  const locked = $derived(blockingNow && !unlocked);
  const domainPattern = $derived(tabUrl ? domainPatternFromUrl(tabUrl) : '');
  const pathPattern = $derived(tabUrl ? pathPatternFromUrl(tabUrl) : null);

  $effect(() => {
    void load();
    const unwatch = blocklistItem.watch((v) => {
      entries = cloneBlocklist(v).map(normalizeEntry);
      void refreshStatus();
    });
    return () => unwatch();
  });

  async function load() {
    loading = true;
    try {
      const [tabs] = await browser.tabs.query({ active: true, currentWindow: true });
      tabUrl = tabs?.url && tabs.url.startsWith('http') ? tabs.url : '';
      entries = cloneBlocklist(await blocklistItem.getValue()).map(normalizeEntry);
      await refreshStatus();
    } finally {
      loading = false;
    }
  }

  async function refreshStatus() {
    if (!tabUrl) {
      status = { kind: 'none' };
      return;
    }
    status = await pageBlockStatus(tabUrl, entries, cryptoKey);
  }

  async function unlock() {
    unlockError = '';
    const auth = await authItem.getValue();
    if (!auth) return;
    if (!(await verifyPassword(pw, auth))) {
      unlockError = t('wrongPassword');
      return;
    }
    cryptoKey = await deriveKey(pw, auth.salt);
    unlocked = true;
    pw = '';
    await refreshStatus();
  }

  async function withAuth(action: () => Promise<void>) {
    actionError = '';
    if (locked) {
      actionError = t('enterPasswordToEdit');
      return;
    }
    busy = true;
    try {
      await action();
      entries = cloneBlocklist(await blocklistItem.getValue()).map(normalizeEntry);
      if (cryptoKey) await syncUnmaskedDomains(entries, cryptoKey);
      await refreshStatus();
    } catch (err) {
      console.error('popup blocklist action failed:', err);
      actionError = t('actionFailed');
    } finally {
      busy = false;
    }
  }

  async function blockDomain() {
    await withAuth(() => addPattern(domainPattern, false, cryptoKey));
  }

  async function blockPath() {
    if (!pathPattern) return;
    await withAuth(() => addPattern(pathPattern, false, cryptoKey));
  }

  async function flipEnabled(enabled: boolean) {
    if (status.kind !== 'listed-disabled' && status.kind !== 'listed-enabled') return;
    await withAuth(() => toggleEntry(status.entry.id, enabled));
  }
</script>

<section class="current-page">
  <h2 class="text-label section-label">{t('thisPage')}</h2>

  {#if loading}
    <p class="msg-muted">{t('loadingTab')}</p>
  {:else if !tabUrl}
    <p class="msg-muted">{t('openWebsiteTab')}</p>
  {:else}
    <p class="page-url" title={tabUrl}>{domainPattern}{new URL(tabUrl).pathname}</p>

    {#if locked}
      <div class="lock-row">
        <input class="input" type="password" bind:value={pw} placeholder={t('passwordPlaceholder')} />
        <button type="button" class="btn btn-primary btn-sm" onclick={unlock}>{t('unlock')}</button>
      </div>
      {#if unlockError}<p class="msg-error">{unlockError}</p>{/if}
    {/if}

    {#if status.kind === 'listed-enabled'}
      <p class="status-on">
        {#if blockingNow}{t('blocked')}{:else}{t('onList')}{/if}: <strong>{status.pattern}</strong>
      </p>
      <Toggle
        checked={true}
        disabled={locked || busy}
        label={t('blockingEnabled')}
        onchange={(enabled) => { if (!enabled) void flipEnabled(false); }}
      />
    {:else if status.kind === 'listed-disabled'}
      <p class="status-off">{t('onListPaused')} <strong>{status.pattern}</strong></p>
      <Toggle
        checked={false}
        disabled={locked || busy}
        label={t('blockingEnabled')}
        onchange={(enabled) => { if (enabled) void flipEnabled(true); }}
      />
    {:else}
      <p class="status-off">{t('notOnBlocklist')}</p>
      <div class="actions">
        <button type="button" class="btn btn-primary btn-sm" disabled={locked || busy} onclick={blockDomain}>
          {t('blockPattern', domainPattern)}
        </button>
        {#if pathPattern}
          <button type="button" class="btn btn-outline btn-sm" disabled={locked || busy} onclick={blockPath}>
            {t('blockPattern', pathPattern)}
          </button>
        {/if}
      </div>
    {/if}

    {#if actionError}<p class="msg-error">{actionError}</p>{/if}
  {/if}
</section>

<style>
  .current-page {
    margin-bottom: 16px;
    padding-bottom: 16px;
    border-bottom: 1px solid var(--border-variant);
  }

  .section-label {
    margin: 0 0 8px;
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }

  .page-url {
    margin: 0 0 12px;
    font-size: 13px;
    font-weight: 600;
    color: var(--text-strong);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .lock-row {
    display: flex;
    gap: 8px;
    margin-bottom: 8px;
  }

  .lock-row .input {
    flex: 1;
  }

  .status-on {
    margin: 0 0 8px;
    font-size: 13px;
    color: var(--amber-text);
  }

  .status-off {
    margin: 0 0 8px;
    font-size: 13px;
    color: var(--text-muted);
  }

  .actions {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
</style>
