<script lang="ts">
  import { authItem, blocklistItem } from '@/lib/storage';
  import { verifyPassword } from '@/lib/crypto';
  import { BG_MESSAGE, sendBg } from '@/lib/messages';
  import { cloneBlocklist, entryToBlockPattern, normalizeEntry } from '@/lib/blocklist';
  import { BLOCKED_URL_PARAM } from '@/lib/keyword-navigation';
  import { findMatchingPattern } from '@/lib/pattern-match';
  import { t, watchLocale } from '@/lib/i18n';

  function initialBlockedUrl(): string {
    try {
      const fromQuery = new URLSearchParams(window.location.search).get(BLOCKED_URL_PARAM);
      if (fromQuery) return fromQuery;
    } catch {
      /* ignore */
    }
    try {
      return document.referrer || '';
    } catch {
      return '';
    }
  }

  let pageUrl = $state(initialBlockedUrl());
  let blockPattern = $state('');
  let confirmed = $state(false);
  let countdown = $state(0);
  let password = $state('');
  let error = $state('');
  let busy = $state(false);
  let localeRevision = $state(0);

  const WAIT_SECONDS = 30;

  const headline = $derived.by(() => {
    void localeRevision;
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

  $effect(() => watchLocale(() => localeRevision++));

  $effect(() => {
    void resolvePattern();
  });

  async function resolvePattern() {
    if (!pageUrl) return;
    const entries = cloneBlocklist(await blocklistItem.getValue()).map(normalizeEntry);
    const patterns = entries.filter((e) => !e.masked).map(entryToBlockPattern);
    blockPattern = findMatchingPattern(pageUrl, patterns) ?? '';
  }

  function startCountdown() {
    confirmed = true;
    countdown = WAIT_SECONDS;
    const id = setInterval(() => {
      countdown -= 1;
      if (countdown <= 0) clearInterval(id);
    }, 1000);
  }

  async function submit() {
    error = '';
    if (!pageUrl) {
      error = t('enterUrlError');
      return;
    }
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
      await sendBg({ type: BG_MESSAGE.GRANT_UNBLOCK, pattern: blockPattern });
      window.location.href = pageUrl;
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
  {#key localeRevision}
  <div class="intercept-card">
    <div class="hero">
      <div class="shield-circle" aria-hidden="true">&#x1F6E1;</div>
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
            <p class="step-hint">{t('wait30Seconds')}</p>
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
            <input class="input" type="password" disabled placeholder={t('masterPasswordLabel')} />
            <button type="button" class="btn btn-primary btn-block" disabled>{t('unblockTemporarily')}</button>
            <p class="step-hint italic">{t('blockingResumes')}</p>
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
    padding: 40px 20px;
    background: var(--surface-low);
    display: flex;
    justify-content: center;
  }

  .shield-circle {
    width: 96px;
    height: 96px;
    border-radius: 999px;
    background: var(--amber-bg);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 48px;
    line-height: 1;
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
    gap: 12px;
    text-align: left;
  }

  .step {
    padding: 16px;
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
    margin: 0;
  }
</style>
