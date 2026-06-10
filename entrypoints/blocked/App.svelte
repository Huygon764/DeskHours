<script lang="ts">
  import { authItem, blocklistItem } from '@/lib/storage';
  import { verifyPassword } from '@/lib/crypto';
  import { BG_MESSAGE, sendBg } from '@/lib/messages';
  import { cloneBlocklist, entryToBlockPattern, normalizeEntry } from '@/lib/blocklist';
  import { BLOCKED_URL_PARAM } from '@/lib/keyword-navigation';
  import { findMatchingPattern } from '@/lib/pattern-match';

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

  const WAIT_SECONDS = 30;

  const headline = $derived.by(() => {
    if (blockPattern) return `${blockPattern} is blocked`;
    if (pageUrl) {
      try {
        return `${new URL(pageUrl).hostname} is blocked`;
      } catch {
        return 'This site is blocked';
      }
    }
    return 'This site is blocked';
  });

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
      error = 'Enter the URL to unblock';
      return;
    }
    if (!blockPattern) {
      error = 'Could not determine which rule blocked this page.';
      return;
    }
    busy = true;
    try {
      const auth = await authItem.getValue();
      if (!auth) {
        error = 'No password set. Set one in extension options.';
        return;
      }
      const ok = await verifyPassword(password, auth);
      if (!ok) {
        error = 'Wrong password';
        return;
      }
      await sendBg({ type: BG_MESSAGE.GRANT_UNBLOCK, pattern: blockPattern });
      window.location.href = pageUrl;
    } finally {
      busy = false;
    }
  }
</script>

<div class="page">
  <div class="intercept-card">
    <div class="hero">
      <div class="shield-circle" aria-hidden="true">&#x1F6E1;</div>
    </div>

    <div class="content">
      <h1 class="headline">{headline}</h1>
      <p class="text-body-muted subtext">
        Your schedule is active. You chose to block this site.
      </p>

      <div class="steps">
        <div class="step" class:step-done={confirmed}>
          <div class="step-header">
            <span class="text-label">Step 1</span>
            <span class="step-tag">Wait period</span>
          </div>
          {#if !confirmed}
            <button type="button" class="btn btn-outline btn-block" onclick={startCountdown}>
              I still need access
            </button>
            <p class="step-hint">Wait 30 seconds before unblocking.</p>
          {:else if countdown > 0}
            <p class="countdown">Wait {countdown}s before you can unblock…</p>
          {:else}
            <p class="step-hint done">Wait complete.</p>
          {/if}
        </div>

        <div class="step" class:step-active={confirmed && countdown <= 0} class:step-disabled={!confirmed || countdown > 0}>
          <div class="step-header">
            <span class="text-label">Step 2</span>
            <span class="step-tag">Authentication</span>
          </div>
          {#if confirmed && countdown <= 0}
            <div class="field">
              <label class="field-label" for="unblock-pw">Master password</label>
              <input id="unblock-pw" class="input" type="password" bind:value={password} />
            </div>
            <button type="button" class="btn btn-primary btn-block" onclick={submit} disabled={busy}>
              Unblock {blockPattern || 'temporarily'}
            </button>
            <p class="step-hint italic">Blocking resumes automatically.</p>
          {:else}
            <input class="input" type="password" disabled placeholder="Master password" />
            <button type="button" class="btn btn-primary btn-block" disabled>Unblock temporarily</button>
            <p class="step-hint italic">Blocking resumes automatically.</p>
          {/if}
        </div>
      </div>

      {#if error}<p class="msg-error">{error}</p>{/if}
    </div>
  </div>
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
    background: rgba(250, 242, 235, 0.3);
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
    background: rgba(207, 196, 189, 0.3);
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
</style>
