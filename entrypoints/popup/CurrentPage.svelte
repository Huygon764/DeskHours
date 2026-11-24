<script lang="ts">
  import { blocklistItem } from '@/lib/storage';
  import { keyFromPassword, syncUnmaskedDomains } from '@/lib/blocklist-session';
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
  import Tape from '@/components/Tape.svelte';
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
      const query = browser.tabs?.query;
      if (typeof query !== 'function') {
        tabUrl = '';
        entries = [];
        status = { kind: 'none' };
        return;
      }
      const [tabs] = await Promise.race([
        query({ active: true, currentWindow: true }),
        new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('tabs query timeout')), 400);
        }),
      ]);
      tabUrl = tabs?.url && tabs.url.startsWith('http') ? tabs.url : '';
      entries = cloneBlocklist(await blocklistItem.getValue()).map(normalizeEntry);
      await refreshStatus();
    } catch {
      tabUrl = '';
      entries = [];
      status = { kind: 'none' };
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
    const key = await keyFromPassword(pw);
    if (!key) {
      unlockError = t('wrongPassword');
      return;
    }
    cryptoKey = key;
    unlocked = true;
    pw = '';
    await refreshStatus();
  }

  function onUnlockSubmit(event: SubmitEvent) {
    event.preventDefault();
    void unlock();
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
  <Tape>
    <div class="tape-ink-row">
      {#if !loading && tabUrl}
        <svg class="tape-link" viewBox="0 0 24 24" aria-hidden="true">
          <path
            fill="none"
            stroke="currentColor"
            stroke-width="1.8"
            stroke-linecap="round"
            d="M10 13a5 5 0 0 0 7.07 0l1.41-1.41a5 5 0 0 0-7.07-7.07L10 5.93M14 11a5 5 0 0 0-7.07 0L5.52 12.4a5 5 0 0 0 7.07 7.07L14 18.07"
          />
        </svg>
      {/if}
      <div class="tape-copy">
        <h2 class="tape-title">{t('thisPage')}</h2>
        {#if loading}
          <p class="tape-line">{t('loadingTab')}</p>
        {:else if !tabUrl}
          <p class="tape-line tape-empty">{t('openWebsiteTab')}</p>
        {:else}
          <p class="tape-line" title={tabUrl}>
            {domainPattern}{new URL(tabUrl).pathname === '/' ? '' : new URL(tabUrl).pathname}
          </p>
        {/if}
      </div>
    </div>
  </Tape>

  {#if !loading && tabUrl}
    {#if locked}
      <form class="lock-row" onsubmit={onUnlockSubmit}>
        <input class="input" type="password" bind:value={pw} placeholder={t('passwordPlaceholder')} />
        <button type="submit" class="btn btn-unlock btn-block">{t('unlock')}</button>
      </form>
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
    margin: 0;
  }

  .tape-ink-row {
    display: flex;
    align-items: center;
    gap: 10px;
    min-height: 76px;
    padding: 18px 22px 20px 16px;
  }

  .tape-link {
    flex-shrink: 0;
    width: 22px;
    height: 22px;
    color: var(--text-strong);
  }

  .tape-copy {
    min-width: 0;
    flex: 1;
  }

  .tape-title {
    margin: 0;
    font-size: 13px;
    font-weight: 700;
    line-height: 1.2;
    letter-spacing: -0.02em;
    color: var(--text-strong);
  }

  .tape-line {
    margin: 3px 0 0;
    font-size: 13px;
    font-weight: 600;
    line-height: 1.3;
    color: var(--text-strong);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .tape-empty {
    font-weight: 500;
    color: var(--text);
    white-space: normal;
  }

  .lock-row {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-bottom: 8px;
    margin-top: 0;
  }

  .status-on {
    margin: 0 0 8px;
    font-size: 13px;
    color: var(--text-strong);
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
