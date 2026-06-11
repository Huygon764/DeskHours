<script lang="ts">
  import PasswordSetup from './PasswordSetup.svelte';
  import ThemeSettings from './ThemeSettings.svelte';
  import LanguageSettings from './LanguageSettings.svelte';
  import ScheduleEditor from './ScheduleEditor.svelte';
  import BlocklistEditor from './BlocklistEditor.svelte';
  import FocusTimerSettings from './FocusTimerSettings.svelte';
  import BackupSettings from './BackupSettings.svelte';
  import { authItem, scheduleItem } from '@/lib/storage';
  import { verifyPassword, deriveKey } from '@/lib/crypto';
  import { isBlockingActive } from '@/lib/schedule';
  import { syncBlockerSafe } from '@/lib/messages';
  import { t, watchLocale } from '@/lib/i18n';

  type Tab = 'schedule' | 'sites' | 'focus-timer' | 'settings';

  let localeRevision = $state(0);

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

  $effect(() => watchLocale(() => localeRevision++));

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
        unlockError = t('wrongPassword');
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

  function onUnlockSubmit(event: SubmitEvent) {
    event.preventDefault();
    if (unlocking) return;
    void unlock();
  }
</script>

<div class="page">
  {#key localeRevision}
  <div class="page-inner">
    {#if !hasPassword}
      <header class="page-header">
        <h1 class="text-headline-lg">{t('appName')}</h1>
        <p class="text-body-muted">{t('setupSubtitle')}</p>
      </header>
      <PasswordSetup onset={init} />
    {:else}
      <header class="page-header">
        <h1 class="text-headline-lg">{t('settingsTitle')}</h1>
        <p class="text-body-muted">{t('settingsSubtitle')}</p>
      </header>

      {#if showUnlockBanner}
        <div class="banner-lock">
          <p>{t('blockingUnlockBanner')}</p>
          <form class="banner-lock-actions" onsubmit={onUnlockSubmit}>
            <input class="input" type="password" bind:value={pw} placeholder={t('passwordPlaceholder')} />
            <button type="submit" class="btn btn-primary btn-sm" disabled={unlocking}>
              {unlocking ? t('unlocking') : t('unlock')}
            </button>
          </form>
          {#if unlockError}<p class="msg-error banner-error">{unlockError}</p>{/if}
        </div>
      {/if}

      <nav class="tabs" aria-label={t('ariaSettingsSections')}>
        <button class="tab" class:active={activeTab === 'schedule'} onclick={() => (activeTab = 'schedule')}>
          {t('tabSchedule')}
        </button>
        <button class="tab" class:active={activeTab === 'sites'} onclick={() => (activeTab = 'sites')}>
          {t('tabBlockedSites')}
        </button>
        <button class="tab" class:active={activeTab === 'focus-timer'} onclick={() => (activeTab = 'focus-timer')}>
          {t('tabFocusTimer')}
        </button>
        <button class="tab" class:active={activeTab === 'settings'} onclick={() => (activeTab = 'settings')}>
          {t('tabSettings')}
        </button>
      </nav>

      {#if activeTab === 'schedule'}
        <ScheduleEditor {locked} onsaved={refreshBlocking} />
      {:else if activeTab === 'sites'}
        <BlocklistEditor {locked} />
      {:else if activeTab === 'focus-timer'}
        <FocusTimerSettings />
      {:else}
        <LanguageSettings />
        <ThemeSettings />
        <BackupSettings />
        <PasswordSetup readonly={locked} />
      {/if}
    {/if}
  </div>
  {/key}
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
