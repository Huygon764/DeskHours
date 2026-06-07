<script lang="ts">
  import PasswordSetup from './PasswordSetup.svelte';
  import ScheduleEditor from './ScheduleEditor.svelte';
  import BlocklistEditor from './BlocklistEditor.svelte';
  import { authItem, scheduleItem } from '@/lib/storage';
  import { verifyPassword, deriveKey } from '@/lib/crypto';
  import { isBlockingActive } from '@/lib/schedule';
  import { syncBlockerSafe } from '@/lib/messages';

  let hasPassword = $state(false);
  let blockingNow = $state(false);
  let unlocked = $state(false);
  let cryptoKey = $state<CryptoKey | null>(null);
  let pw = $state('');
  let unlockError = $state('');
  let unlocking = $state(false);

  $effect(() => {
    void init();
    const id = setInterval(() => void refreshBlocking(), 15_000);
    return () => clearInterval(id);
  });

  async function init() {
    hasPassword = (await authItem.getValue()) != null;
    await refreshBlocking();
  }

  async function refreshBlocking() {
    blockingNow = isBlockingActive(await scheduleItem.getValue(), Date.now());
  }

  const locked = $derived(blockingNow && !unlocked);

  async function unlock() {
    unlockError = '';
    unlocking = true;
    try {
      const auth = await authItem.getValue();
      if (!auth) return;
      if (!(await verifyPassword(pw, auth))) {
        unlockError = 'Wrong password';
        return;
      }
      cryptoKey = await deriveKey(pw, auth.salt);
      unlocked = true;
      pw = '';
      await syncBlockerSafe();
    } finally {
      unlocking = false;
    }
  }
</script>

<main>
  <h1>Site Blocker</h1>

  {#if !hasPassword}
    <PasswordSetup onset={init} />
  {:else}
    {#if locked}
      <section class="lock">
        <p>Blocking is active. Enter your password to edit settings or reveal masked sites.</p>
        <input type="password" bind:value={pw} />
        <button onclick={unlock} disabled={unlocking}>{unlocking ? 'Unlocking…' : 'Unlock'}</button>
        {#if unlockError}<p class="error">{unlockError}</p>{/if}
      </section>
    {:else if !unlocked}
      <section class="lock">
        <p>Enter your password to reveal masked sites (optional).</p>
        <input type="password" bind:value={pw} />
        <button onclick={unlock} disabled={unlocking}>{unlocking ? 'Unlocking…' : 'Unlock masked'}</button>
        {#if unlockError}<p class="error">{unlockError}</p>{/if}
      </section>
    {/if}

    <ScheduleEditor {locked} onsaved={refreshBlocking} />
    <BlocklistEditor {locked} bind:cryptoKey onUnlocked={() => (unlocked = true)} />
  {/if}
</main>

<style>
  main { max-width: 40rem; margin: 2rem auto; font-family: system-ui; padding: 0 1rem; }
  .lock { background: #fff3cd; padding: 1rem; border-radius: 6px; margin-bottom: 1rem; }
  .error { color: #c0392b; }
</style>
