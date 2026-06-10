<script lang="ts">
  import { onMount } from 'svelte';
  import { blocklistItem } from '@/lib/storage';
  import { cloneBlocklist, hasKeywordPattern, normalizeKeyword, normalizePattern } from '@/lib/blocklist';
  import {
    hasBlockedPattern,
    keyFromPassword,
    loadBlocklist,
    syncUnmaskedDomains,
    setEntryEnabled,
  } from '@/lib/blocklist-session';
  import { maskDomain } from '@/lib/masking';
  import { syncBlockerSafe } from '@/lib/messages';
  import type { BlockEntry } from '@/lib/types';
  import Toggle from '@/components/Toggle.svelte';

  let {
    locked = false,
    cryptoKey = $bindable<CryptoKey | null>(null),
    onUnlocked = () => {},
  }: {
    locked?: boolean;
    cryptoKey?: CryptoKey | null;
    onUnlocked?: () => void;
  } = $props();

  let entries = $state<BlockEntry[]>([]);
  let revealed = $state<Record<string, string>>({});
  let newDomain = $state('');
  let newKeyword = $state('');
  let newMasked = $state(false);
  let maskPassword = $state('');
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
      loadError = 'Could not load blocklist.';
    } finally {
      loading = false;
    }
  }

  $effect(() => {
    const key = cryptoKey;
    if (loading) return;
    void refreshRevealed(key);
  });

  async function refreshRevealed(key: CryptoKey | null) {
    if (!key) {
      revealed = {};
      return;
    }
    try {
      const { revealEntry } = await import('@/lib/masking');
      const map: Record<string, string> = {};
      for (const e of entries) {
        map[e.id] = e.masked ? await revealEntry(e, key) : e.domain;
      }
      revealed = map;
      await syncUnmaskedDomains(entries, key);
      await syncBlockerSafe();
    } catch (err) {
      console.error('reveal masked entries failed:', err);
      addError = 'Could not decrypt masked entries. Check your password.';
    }
  }

  const siteEntries = $derived(entries.filter((e) => (e.kind ?? 'site') === 'site'));
  const keywordEntries = $derived(entries.filter((e) => e.kind === 'keyword'));

  function display(e: BlockEntry): string {
    if (!e.masked) return e.domain;
    return revealed[e.id] ?? '••••••••••••';
  }

  async function resolveKey(): Promise<CryptoKey | null> {
    if (cryptoKey) return cryptoKey;
    if (!newMasked) return null;
    if (!maskPassword) {
      addError = 'Enter your password to add a masked site.';
      return null;
    }
    const key = await keyFromPassword(maskPassword);
    if (!key) {
      addError = 'Wrong password.';
      return null;
    }
    maskPassword = '';
    cryptoKey = key;
    onUnlocked();
    return key;
  }

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
      addError = 'Unlock with your password above to edit the blocklist.';
      return;
    }
    const domain = normalizePattern(newDomain);
    if (!domain) {
      addError = 'Enter a domain or path (e.g. youtube.com/shorts/*).';
      return;
    }
    try {
      const key = newMasked ? await resolveKey() : cryptoKey;
      if (newMasked && !key) return;

      const stored = await loadBlocklist();
      if (await hasBlockedPattern(stored, domain, key)) {
        addError = `${domain} is already on the list.`;
        return;
      }

      const id = crypto.randomUUID();
      const wasMasked = newMasked;
      let domainStored = domain;
      if (wasMasked && key) {
        domainStored = await maskDomain(domain, key);
      }

      const next = [
        ...cloneBlocklist(entries),
        { id, domain: domainStored, masked: wasMasked, enabled: true, kind: 'site' as const },
      ];
      const synced = await persist(next);
      newDomain = '';
      newMasked = false;

      if (key) {
        await syncUnmaskedDomains(next, key);
        await refreshRevealed(key);
      }

      if (!synced) {
        addNotice = 'Saved. If the site is not blocked yet, reload the extension on brave://extensions.';
      } else if (wasMasked) {
        addNotice = 'Masked site saved and blocking is active for this browser session.';
      }
    } catch (err) {
      console.error('add blocklist entry failed:', err);
      addError = 'Failed to save blocklist. Try again.';
    }
  }

  async function addKeyword() {
    addError = '';
    addNotice = '';
    if (locked) {
      addError = 'Unlock with your password above to edit the blocklist.';
      return;
    }
    const keyword = normalizeKeyword(newKeyword);
    if (!keyword) {
      addError = 'Enter text to match in URLs (e.g. shorts or /reels/).';
      return;
    }
    try {
      const stored = await loadBlocklist();
      if (hasKeywordPattern(stored, keyword)) {
        addError = `"${keyword}" is already on the keyword list.`;
        return;
      }

      const id = crypto.randomUUID();
      const next = [
        ...cloneBlocklist(entries),
        { id, domain: keyword, masked: false, enabled: true, kind: 'keyword' as const },
      ];
      const synced = await persist(next);
      newKeyword = '';
      if (!synced) {
        addNotice = 'Saved. If URLs are not blocked yet, reload the extension on brave://extensions.';
      }
    } catch (err) {
      console.error('add keyword entry failed:', err);
      addError = 'Failed to save keyword. Try again.';
    }
  }

  async function remove(id: string) {
    addError = '';
    addNotice = '';
    try {
      const next = cloneBlocklist(entries).filter((e) => e.id !== id);
      const synced = await persist(next);
      if (cryptoKey) await refreshRevealed(cryptoKey);
      if (!synced) addNotice = 'Saved. Block rules will refresh within 1 minute.';
    } catch (err) {
      console.error('remove blocklist entry failed:', err);
      addError = 'Failed to update blocklist. Try again.';
    }
  }

  async function toggleEnabled(id: string, enabled: boolean) {
    addError = '';
    addNotice = '';
    if (locked) {
      addError = 'Unlock with your password above to edit the blocklist.';
      return;
    }
    try {
      const next = await setEntryEnabled(id, enabled);
      entries = next;
      if (cryptoKey) await refreshRevealed(cryptoKey);
      await syncBlockerSafe();
    } catch (err) {
      console.error('toggle blocklist entry failed:', err);
      addError = 'Failed to update blocklist. Try again.';
    }
  }
</script>

<section class="card">
  <h2 class="text-headline-md section-title">Blocked sites</h2>

  {#if locked}
    <p class="hint-banner">Blocklist is locked while a schedule window is active. Enter your password above to add or remove sites.</p>
  {/if}

  {#if loading}
    <p class="msg-muted">Loading blocklist…</p>
  {:else if loadError}
    <p class="msg-error">{loadError}</p>
  {:else if siteEntries.length === 0}
    <p class="empty-state">No sites blocked yet.</p>
  {:else}
    <div class="site-list">
      {#each siteEntries as e (e.id)}
        <div class="list-row" class:row-disabled={e.enabled === false}>
          <div class="list-row-left">
            {#if e.masked}
              <span class="lock-icon" aria-hidden="true">&#x1F512;</span>
            {:else}
              <span class="status-dot" class:dot-off={e.enabled === false}></span>
            {/if}
            <span class="domain">{display(e)}</span>
            {#if e.masked}<span class="tag">Masked</span>{/if}
            {#if e.enabled === false}<span class="tag">Paused</span>{/if}
          </div>
          <div class="row-actions">
            <Toggle
              checked={e.enabled !== false}
              disabled={locked || (e.masked && !cryptoKey)}
              ariaLabel="Blocking enabled for {display(e)}"
              onchange={(enabled) => toggleEnabled(e.id, enabled)}
            />
            <button
            type="button"
            class="btn-icon"
            onclick={() => remove(e.id)}
            disabled={locked || (e.masked && !cryptoKey)}
            aria-label="Remove {display(e)}"
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
      <label class="field-label" for="new-domain">Add site</label>
      <input id="new-domain" class="input" bind:value={newDomain} placeholder="youtube.com or youtube.com/shorts/*" disabled={locked} />
    </div>

    <label class="check-row">
      <input type="checkbox" bind:checked={newMasked} disabled={locked} />
      Hide site name (masked)
    </label>

    {#if newMasked && !cryptoKey}
      <div class="field">
        <label class="field-label" for="mask-pw">Password to enable masking + blocking</label>
        <input id="mask-pw" class="input" type="password" bind:value={maskPassword} disabled={locked} />
      </div>
      <p class="text-body-muted hint-inline">Masked sites need your password once per browser session.</p>
    {/if}

    <button type="button" class="btn btn-primary" onclick={add} disabled={locked}>
      {locked ? 'Add (unlock required)' : 'Add site'}
    </button>
  </div>

  {#if addError}<p class="msg-error">{addError}</p>{/if}
  {#if addNotice}<p class="msg-success">{addNotice}</p>{/if}
</section>

<section class="card keyword-section">
  <h2 class="text-headline-md section-title">URL keywords</h2>
  <p class="text-body-muted section-hint">Block any page whose URL contains the text (path, query, etc.).</p>

  {#if locked}
    <p class="hint-banner">Keywords are locked while a schedule window is active. Enter your password above to edit.</p>
  {/if}

  {#if loading}
    <p class="msg-muted">Loading…</p>
  {:else if keywordEntries.length === 0}
    <p class="empty-state">No URL keywords yet.</p>
  {:else}
    <div class="site-list">
      {#each keywordEntries as e (e.id)}
        <div class="list-row" class:row-disabled={e.enabled === false}>
          <div class="list-row-left">
            <span class="status-dot" class:dot-off={e.enabled === false}></span>
            <span class="domain">{display(e)}</span>
            <span class="tag">Keyword</span>
            {#if e.enabled === false}<span class="tag">Paused</span>{/if}
          </div>
          <div class="row-actions">
            <Toggle
              checked={e.enabled !== false}
              disabled={locked}
              ariaLabel="Blocking enabled for keyword {display(e)}"
              onchange={(enabled) => toggleEnabled(e.id, enabled)}
            />
            <button
              type="button"
              class="btn-icon"
              onclick={() => remove(e.id)}
              disabled={locked}
              aria-label="Remove keyword {display(e)}"
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
      <label class="field-label" for="new-keyword">Add keyword</label>
      <input
        id="new-keyword"
        class="input"
        bind:value={newKeyword}
        placeholder="shorts, /reels/, gambling"
        disabled={locked}
      />
    </div>
    <button type="button" class="btn btn-primary" onclick={addKeyword} disabled={locked}>
      {locked ? 'Add (unlock required)' : 'Add keyword'}
    </button>
  </div>
</section>

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

  .lock-icon {
    font-size: 14px;
    flex-shrink: 0;
  }

  .add-form {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding-top: 16px;
    border-top: 1px solid var(--border);
  }

  .hint-inline {
    margin: 0;
    font-size: 12px;
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
