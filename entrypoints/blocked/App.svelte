<script lang="ts">
  import { authItem, unblockTimestampsItem } from '@/lib/storage';
  import { verifyPassword } from '@/lib/crypto';
  import { todayUnblockCount, waitSeconds } from '@/lib/unblock-wait';
  import { grantUnblockSafe, getPendingBlockedUrlSafe } from '@/lib/messages';
  import { BLOCKED_URL_PARAM, matchingBlockedPattern } from '@/lib/keyword-navigation';
  import { t } from '@/lib/i18n';
  import { useLocaleRevision } from '@/lib/reactive.svelte';
  import AppLogo from '@/components/AppLogo.svelte';

  function blockedUrlFromLocation(): string {
    try {
      const href = window.location.href;
      const marker = `${BLOCKED_URL_PARAM}=`;
      const idx = href.indexOf(marker);
      if (idx !== -1) {
        const raw = href.slice(idx + marker.length);
        try {
          return decodeURIComponent(raw);
        } catch {
          return raw;
        }
      }
    } catch {
      /* ignore */
    }
    return '';
  }

  let pageUrl = $state('');
  let blockPattern = $state('');
  let confirmed = $state(false);
  let countdown = $state(0);
  let password = $state('');
  let error = $state('');
  let busy = $state(false);
  // Escalating wait: grows with how many unblocks were already granted today.
  // Resolved once on load so a page refresh can't shorten an in-progress wait.
  let waitSecondsValue = $state(waitSeconds(0));

  const locale = useLocaleRevision();

  const headline = $derived.by(() => {
    void locale.value;
    if (blockPattern) return t('patternBlocked', blockPattern);
    if (pageUrl) {
      try {
        return t('hostnameBlocked', new URL(pageUrl).hostname);
      } catch {
        return t('siteBlocked');
      }
    }
    return t('siteBlocked');
  });

  $effect(() => {
    void resolveWait();
  });

  async function resolveWait() {
    const history = await unblockTimestampsItem.getValue();
    waitSecondsValue = waitSeconds(todayUnblockCount(history, Date.now()));
  }

  $effect(() => {
    void resolvePageUrl();
  });

  async function resolvePageUrl() {
    const fromLocation = blockedUrlFromLocation();
    if (fromLocation) {
      pageUrl = fromLocation;
      return;
    }
    const pending = await getPendingBlockedUrlSafe();
    if (pending) {
      pageUrl = pending;
      return;
    }
    try {
      pageUrl = document.referrer || '';
    } catch {
      pageUrl = '';
    }
  }

  $effect(() => {
    void resolvePattern();
  });

  async function resolvePattern() {
    if (!pageUrl) return;
    blockPattern = (await matchingBlockedPattern(pageUrl)) ?? '';
  }

  function startCountdown() {
    confirmed = true;
    countdown = waitSecondsValue;
    const id = setInterval(() => {
      countdown -= 1;
      if (countdown <= 0) clearInterval(id);
    }, 1000);
  }

  async function submit() {
    error = '';
    if (!pageUrl) await resolvePageUrl();
    if (!pageUrl) {
      error = t('enterUrlError');
      return;
    }
    if (!blockPattern) await resolvePattern();
    if (!blockPattern) {
      error = t('ruleUnknownError');
      return;
    }
    busy = true;
    try {
      const auth = await authItem.getValue();
      if (!auth) {
        error = t('noPasswordSet');
        return;
      }
      const ok = await verifyPassword(password, auth);
      if (!ok) {
        error = t('wrongPassword');
        return;
      }
      const granted = await grantUnblockSafe(blockPattern);
      if (!granted) {
        error = t('actionFailed');
        return;
      }
      window.location.assign(pageUrl);
    } catch (err) {
      console.error('[deskhours] unblock failed:', err);
      error = t('actionFailed');
    } finally {
      busy = false;
    }
  }

  function onUnblockSubmit(event: SubmitEvent) {
    event.preventDefault();
    if (busy) return;
    void submit();
  }
</script>

<div class="page">
  {#key locale.value}
  <div class="intercept-card">
    <div class="hero">
      <AppLogo size={112} />
    </div>

    <div class="content">
      <h1 class="headline">{headline}</h1>
      <p class="text-body-muted subtext">
        {t('blockedSubtext')}
      </p>

      <div class="steps">
        <div class="step" class:step-done={confirmed}>
          <div class="step-header">
            <span class="text-label">{t('step1')}</span>
            <span class="step-tag">{t('waitPeriod')}</span>
          </div>
          {#if !confirmed}
            <button type="button" class="btn btn-outline btn-block" onclick={startCountdown}>
              {t('stillNeedAccess')}
            </button>
            <p class="step-hint">{t('waitCountdown', String(waitSecondsValue))}</p>
          {:else if countdown > 0}
            <p class="countdown">{t('waitCountdown', String(countdown))}</p>
          {:else}
            <p class="step-hint done">{t('waitComplete')}</p>
          {/if}
        </div>

        <div class="step" class:step-active={confirmed && countdown <= 0} class:step-disabled={!confirmed || countdown > 0}>
          <div class="step-header">
            <span class="text-label">{t('step2')}</span>
            <span class="step-tag">{t('authentication')}</span>
          </div>
          {#if confirmed && countdown <= 0}
            <form class="unblock-form" onsubmit={onUnblockSubmit}>
              <div class="field">
                <label class="field-label" for="unblock-pw">{t('masterPasswordLabel')}</label>
                <input id="unblock-pw" class="input" type="password" bind:value={password} />
              </div>
              <button type="submit" class="btn btn-primary btn-block" disabled={busy}>
                {t('unblockPattern', blockPattern || t('temporarily'))}
              </button>
              <p class="step-hint italic">{t('blockingResumes')}</p>
            </form>
          {:else}
            <p class="step-placeholder">{t('completeStep1First')}</p>
          {/if}
        </div>
      </div>

      {#if error}<p class="msg-error">{error}</p>{/if}
    </div>
  </div>
  {/key}
</div>

<style>
  .page {
    display: flex;
    align-items: flex-start;
    justify-content: center;
    padding: 48px 20px;
    min-height: 100vh;
  }

  .intercept-card {
    width: 100%;
    max-width: 480px;
    background: var(--surface);
    border: 1px solid var(--border-variant);
    border-radius: 24px;
    box-shadow: var(--shadow-card);
    overflow: hidden;
    text-align: center;
  }

  .hero {
    padding: 32px 24px 28px;
    background: var(--surface-low);
    display: flex;
    justify-content: center;
  }

  .content {
    padding: 32px 24px 40px;
  }

  .headline {
    margin: 0 0 8px;
    font-size: 28px;
    font-weight: 600;
    line-height: 1.2;
    letter-spacing: -0.02em;
    color: var(--text-strong);
    word-break: break-word;
  }

  .subtext {
    margin: 0 0 24px;
  }

  .steps {
    display: flex;
    flex-direction: column;
    gap: 16px;
    text-align: left;
  }

  .step {
    padding: 18px;
    border: 1px solid var(--border-variant);
    border-radius: var(--radius);
    background: var(--surface-step);
  }

  .step-disabled {
    opacity: 0.45;
    pointer-events: none;
  }

  .step-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;
  }

  .step-tag {
    font-size: 10px;
    font-weight: 500;
    padding: 2px 8px;
    border-radius: 999px;
    background: var(--surface-muted);
    color: var(--text-muted);
    text-transform: capitalize;
  }

  .step-hint {
    margin: 8px 0 0;
    font-size: 12px;
    color: var(--text-muted);
    font-weight: 500;
  }

  .step-hint.done {
    color: var(--success);
  }

  .step-hint.italic {
    font-style: italic;
  }

  .countdown {
    margin: 0;
    font-size: 14px;
    font-weight: 600;
    color: var(--amber-text);
  }

  .unblock-form {
    display: flex;
    flex-direction: column;
    gap: 12px;
    margin: 0;
  }

  .step-disabled .step-placeholder {
    margin: 0;
    font-size: 13px;
    color: var(--text-muted);
  }
</style>
