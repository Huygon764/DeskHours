<script lang="ts">
  import { authItem } from '@/lib/storage';
  import { verifyPassword } from '@/lib/crypto';
  import { BG_MESSAGE, sendBg } from '@/lib/messages';

  function referrerHost(): string {
    try {
      return document.referrer ? new URL(document.referrer).hostname.replace(/^www\./, '') : '';
    } catch {
      return '';
    }
  }

  let domain = $state(referrerHost());
  let confirmed = $state(false);
  let countdown = $state(0);
  let password = $state('');
  let error = $state('');
  let busy = $state(false);

  const WAIT_SECONDS = 30;

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
    if (!domain) {
      error = 'Enter the domain to unblock';
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
      const bare = domain.replace(/^www\./, '');
      await sendBg({ type: BG_MESSAGE.GRANT_UNBLOCK, domain: bare });
      window.location.href = `https://${bare}`;
    } finally {
      busy = false;
    }
  }
</script>

<main>
  <h1>This site is blocked</h1>
  <p>Blocking is active right now per your schedule.</p>

  <label>Domain
    <input bind:value={domain} placeholder="facebook.com" />
  </label>

  {#if !confirmed}
    <button onclick={startCountdown}>I really need to unblock this</button>
  {:else if countdown > 0}
    <p>Wait {countdown}s before you can unblock…</p>
  {:else}
    <label>Password
      <input type="password" bind:value={password} />
    </label>
    <button onclick={submit} disabled={busy}>Unblock temporarily</button>
  {/if}

  {#if error}<p class="error">{error}</p>{/if}
</main>

<style>
  main { max-width: 28rem; margin: 4rem auto; font-family: system-ui; }
  .error { color: #c0392b; }
  label { display: block; margin: 0.75rem 0; }
  input { display: block; width: 100%; padding: 0.5rem; box-sizing: border-box; }
  button { margin-top: 0.5rem; padding: 0.5rem 1rem; }
</style>
