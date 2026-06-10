<script lang="ts">
  import PasswordSetup from './PasswordSetup.svelte';
  import ThemeSettings from './ThemeSettings.svelte';
  import ScheduleEditor from './ScheduleEditor.svelte';
  import BlocklistEditor from './BlocklistEditor.svelte';
  import { authItem, scheduleItem } from '@/lib/storage';
  import { verifyPassword, deriveKey } from '@/lib/crypto';
  import { isBlockingActive } from '@/lib/schedule';
  import { syncBlockerSafe } from '@/lib/messages';

  type Tab = 'schedule' | 'sites' | 'settings';

  let hasPassword = $state(false);
  let blockingNow = $state(false);
  let unlocked = $state(false);
  let pw = $state('');
  let unlockError = $state('');
  let unlocking = $state(false);
  let activeTab = $state<Tab>('schedule');

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
  const showUnlockBanner = $derived(hasPassword && locked);

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
      await deriveKey(pw, auth.salt);
      unlocked = true;
      pw = '';
      await syncBlockerSafe();
    } finally {
      unlocking = false;
    }
  }
</script>

<div class="page">
  <div class="page-inner">
    {#if !hasPassword}
      <header class="page-header">
        <h1 class="text-headline-lg">Site Blocker</h1>
        <p class="text-body-muted">Set up your master password to get started.</p>
      </header>
      <PasswordSetup onset={init} />
    {:else}
      <header class="page-header">
        <h1 class="text-headline-lg">Site Blocker settings</h1>
        <p class="text-body-muted">Manage your focus schedule and blocked sites.</p>
      </header>

      {#if showUnlockBanner}
        <div class="banner-lock">
          <p>Blocking is active. Enter your password to edit the blocklist.</p>
          <div class="banner-lock-actions">
            <input class="input" type="password" bind:value={pw} placeholder="Password" />
            <button class="btn btn-primary btn-sm" onclick={unlock} disabled={unlocking}>
              {unlocking ? 'Unlocking…' : 'Unlock'}
            </button>
          </div>
          {#if unlockError}<p class="msg-error banner-error">{unlockError}</p>{/if}
        </div>
      {/if}

      <nav class="tabs" aria-label="Settings sections">
        <button class="tab" class:active={activeTab === 'schedule'} onclick={() => (activeTab = 'schedule')}>
          Schedule
        </button>
        <button class="tab" class:active={activeTab === 'sites'} onclick={() => (activeTab = 'sites')}>
          Blocked sites
        </button>
        <button class="tab" class:active={activeTab === 'settings'} onclick={() => (activeTab = 'settings')}>
          Settings
        </button>
      </nav>

      {#if activeTab === 'schedule'}
        <ScheduleEditor {locked} onsaved={refreshBlocking} />
      {:else if activeTab === 'sites'}
        <BlocklistEditor {locked} />
      {:else}
        <ThemeSettings />
        <PasswordSetup readonly={locked} />
      {/if}
    {/if}
  </div>
</div>

<style>
  .page-header {
    margin-bottom: 24px;
  }

  .page-header h1 {
    margin: 0 0 4px;
  }

  .page-header p {
    margin: 0;
  }

  .banner-error {
    width: 100%;
    margin-top: 4px;
  }
</style>
