<script lang="ts">
  import { onMount } from 'svelte';
  import { blocklistItem } from '@/lib/storage';
  import { cloneBlocklist, normalizeDomain } from '@/lib/blocklist';
  import {
    hasBlockedDomain,
    keyFromPassword,
    loadBlocklist,
    syncUnmaskedDomains,
  } from '@/lib/blocklist-session';
  import { maskDomain } from '@/lib/masking';
  import { syncBlockerSafe } from '@/lib/messages';
  import type { BlockEntry } from '@/lib/types';

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

  /** Update UI labels for masked entries; never clear session unmasked list when locked. */
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

  function display(e: BlockEntry): string {
    if (!e.masked) return e.domain;
    return revealed[e.id] ?? '•••• (locked)';
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
    const domain = normalizeDomain(newDomain);
    if (!domain) {
      addError = 'Enter a domain (e.g. facebook.com).';
      return;
    }
    try {
      const key = newMasked ? await resolveKey() : cryptoKey;
      if (newMasked && !key) return;

      const stored = await loadBlocklist();
      if (await hasBlockedDomain(stored, domain, key)) {
        addError = `${domain} is already on the list.`;
        return;
      }

      const id = crypto.randomUUID();
      const wasMasked = newMasked;
      let domainStored = domain;
      if (wasMasked && key) {
        domainStored = await maskDomain(domain, key);
      }

      const next = [...cloneBlocklist(entries), { id, domain: domainStored, masked: wasMasked }];
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
</script>

<section>
  <h2>Blocked sites</h2>
  {#if locked}
    <p class="hint">Blocklist is locked while a schedule window is active. Enter your password above to add or remove sites.</p>
  {/if}
  {#if loading}
    <p class="muted">Loading blocklist…</p>
  {:else if loadError}
    <p class="error">{loadError}</p>
  {:else if entries.length === 0}
    <p class="empty">No sites blocked yet.</p>
  {:else}
    <ul>
      {#each entries as e (e.id)}
        <li>
          {display(e)} {#if e.masked}<em>(masked)</em>{/if}
          <button onclick={() => remove(e.id)} disabled={locked || (e.masked && !cryptoKey)}>Remove</button>
        </li>
      {/each}
    </ul>
  {/if}
  <input bind:value={newDomain} placeholder="youtube.com" disabled={locked} />
  <label><input type="checkbox" bind:checked={newMasked} disabled={locked} /> Masked (hidden name)</label>
  {#if newMasked && !cryptoKey}
    <label class="mask-pw">Password to enable masking + blocking
      <input type="password" bind:value={maskPassword} disabled={locked} />
    </label>
    <p class="hint-inline">Masked sites need your password once so the extension can block them without showing the name.</p>
  {/if}
  <button onclick={add} disabled={locked}>
    {locked ? 'Add (unlock required)' : 'Add'}
  </button>
  {#if addError}<p class="error">{addError}</p>{/if}
  {#if addNotice}<p class="notice">{addNotice}</p>{/if}
</section>

<style>
  ul { list-style: none; padding: 0; }
  li { margin: 0.5rem 0; }
  input[type='text'] { padding: 0.4rem; margin-right: 0.5rem; }
  .mask-pw { display: block; margin: 0.5rem 0; }
  .mask-pw input { display: block; margin-top: 0.25rem; padding: 0.4rem; width: 100%; max-width: 20rem; box-sizing: border-box; }
  .error { color: #c0392b; margin-top: 0.5rem; }
  .notice { color: #1e7e34; margin-top: 0.5rem; }
  .muted { color: #666; font-style: italic; }
  .hint { color: #856404; background: #fff3cd; padding: 0.5rem 0.75rem; border-radius: 4px; }
  .hint-inline { color: #666; font-size: 0.85rem; margin: 0.25rem 0 0.5rem; }
  .empty { color: #666; font-style: italic; }
</style>
