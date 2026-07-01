<script lang="ts">
  import PasswordSetup from './PasswordSetup.svelte';
  import PreferenceRadioGroup from './PreferenceRadioGroup.svelte';
  import ScheduleEditor from './ScheduleEditor.svelte';
  import BlocklistEditor from './BlocklistEditor.svelte';
  import FocusTimerSettings from './FocusTimerSettings.svelte';
  import AlarmsSettings from './AlarmsSettings.svelte';
  import BackupSettings from './BackupSettings.svelte';
  import {
    authItem,
    localeItem,
    optionsTabItem,
    pomodoroItem,
    scheduleItem,
    themeItem,
  } from '@/lib/storage';
  import type { LocalePreference } from '@/lib/locale';
  import type { ThemePreference } from '@/lib/theme';
  import { verifyPassword } from '@/lib/crypto';
  import { isSiteBlockingEnabled } from '@/lib/schedule';
  import { syncBlockerSafe } from '@/lib/messages';
  import { t } from '@/lib/i18n';
  import { useLocaleRevision } from '@/lib/reactive.svelte';

  const LANGUAGE_OPTIONS: { value: LocalePreference; labelKey: string; hintKey: string }[] = [
    { value: 'system', labelKey: 'languageSystem', hintKey: 'languageSystemHint' },
    { value: 'en', labelKey: 'languageEnglish', hintKey: 'languageEnglishHint' },
    { value: 'vi', labelKey: 'languageVietnamese', hintKey: 'languageVietnameseHint' },
  ];

  const THEME_OPTIONS: { value: ThemePreference; labelKey: string; hintKey: string }[] = [
    { value: 'system', labelKey: 'themeSystem', hintKey: 'themeSystemHint' },
    { value: 'light', labelKey: 'themeLight', hintKey: 'themeLightHint' },
    { value: 'dark', labelKey: 'themeDark', hintKey: 'themeDarkHint' },
  ];

  type Tab = 'schedule' | 'sites' | 'focus-timer' | 'settings';

  const locale = useLocaleRevision();

  let hasPassword = $state(false);
  let blockingNow = $state(false);
  let unlocked = $state(false);
  let pw = $state('');
  let unlockError = $state('');
  let unlocking = $state(false);
  let activeTab = $state<Tab>('schedule');

  function selectTab(tab: Tab) {
    activeTab = tab;
    void optionsTabItem.setValue(tab);
  }

  $effect(() => {
    void init();
    void optionsTabItem.getValue().then((v) => {
      if (v === 'schedule' || v === 'sites' || v === 'focus-timer' || v === 'settings') {
        activeTab = v;
      }
    });
    const unwatchPomodoro = pomodoroItem.watch(() => void refreshBlocking());
    const id = setInterval(() => void refreshBlocking(), 15_000);
    return () => {
      unwatchPomodoro();
      clearInterval(id);
    };
  });

  async function init() {
    hasPassword = (await authItem.getValue()) != null;
    await refreshBlocking();
  }

  async function refreshBlocking() {
    const [schedule, pomodoro] = await Promise.all([scheduleItem.getValue(), pomodoroItem.getValue()]);
    blockingNow = isSiteBlockingEnabled(schedule, Date.now(), pomodoro);
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
      // This page only gates editing during a block; masked-entry enforcement lives
      // in the editors, so no AES key needs deriving here.
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
  {#key locale.value}
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
        <button class="tab" class:active={activeTab === 'schedule'} onclick={() => selectTab('schedule')}>
          {t('tabSchedule')}
        </button>
        <button class="tab" class:active={activeTab === 'sites'} onclick={() => selectTab('sites')}>
          {t('tabBlockedSites')}
        </button>
        <button class="tab" class:active={activeTab === 'focus-timer'} onclick={() => selectTab('focus-timer')}>
          {t('tabFocusTimer')}
        </button>
        <button class="tab" class:active={activeTab === 'settings'} onclick={() => selectTab('settings')}>
          {t('tabSettings')}
        </button>
      </nav>

      {#if activeTab === 'schedule'}
        <ScheduleEditor {locked} onsaved={refreshBlocking} />
      {:else if activeTab === 'sites'}
        <BlocklistEditor {locked} />
      {:else if activeTab === 'focus-timer'}
        <FocusTimerSettings />
        <AlarmsSettings />
      {:else}
        <PreferenceRadioGroup
          item={localeItem}
          titleKey="languageTitle"
          introKey="languageIntro"
          ariaKey="ariaLanguage"
          options={LANGUAGE_OPTIONS}
        />
        <PreferenceRadioGroup
          item={themeItem}
          titleKey="appearanceTitle"
          introKey="appearanceIntro"
          ariaKey="ariaTheme"
          options={THEME_OPTIONS}
        />
        <BackupSettings />
        <PasswordSetup />
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
