<script lang="ts">
  import { authItem } from '@/lib/storage';
  import { hashPassword } from '@/lib/crypto';
  import { checkPassword } from '@/lib/password-policy';
  import { t } from '@/lib/i18n';

  let {
    onset = () => {},
    readonly = false,
  }: {
    onset?: () => void;
    readonly?: boolean;
  } = $props();

  let password = $state('');
  let confirm = $state('');
  let errors = $state<string[]>([]);
  let score = $state(0);
  let saved = $state(false);
  let hasExisting = $state(false);

  $effect(() => {
    void authItem.getValue().then((a) => (hasExisting = a != null));
  });

  function onInput() {
    const r = checkPassword(password);
    errors = r.errors;
    score = r.score;
  }

  const strengthLabel = $derived.by(() => {
    if (score <= 1) return t('strengthWeak');
    if (score === 2) return t('strengthFair');
    if (score === 3) return t('strengthGood');
    return t('strengthStrong');
  });

  async function save() {
    const r = checkPassword(password);
    if (!r.ok) {
      errors = r.errors;
      return;
    }
    if (password !== confirm) {
      errors = [t('passwordsDoNotMatch')];
      return;
    }
    await authItem.setValue(await hashPassword(password));
    saved = true;
    hasExisting = true;
    password = '';
    confirm = '';
    onset();
  }

  function onSubmit(event: SubmitEvent) {
    event.preventDefault();
    void save();
  }
</script>

<section class="card">
  <h2 class="text-headline-md section-title">{t('masterPasswordTitle')}</h2>
  <p class="text-body-muted intro">
    {t('masterPasswordIntro')}
  </p>

  {#if readonly}
    <p class="hint-banner">{t('unlockToChangePassword')}</p>
  {:else}
    <form class="password-form" onsubmit={onSubmit}>
      <div class="fields">
      <div class="field">
        <label class="field-label" for="pw-new">{hasExisting ? t('newPassword') : t('password')}</label>
        <input
          id="pw-new"
          class="input"
          class:input-error={errors.length > 0 && password.length > 0}
          type="password"
          bind:value={password}
          oninput={onInput}
        />
        {#each errors as e}
          <p class="msg-error">{e}</p>
        {/each}
      </div>
      <div class="field">
        <label class="field-label" for="pw-confirm">{t('confirmPassword')}</label>
        <input id="pw-confirm" class="input" type="password" bind:value={confirm} />
      </div>
    </div>

    {#if password.length > 0}
      <div class="strength">
        <div class="strength-bars" aria-hidden="true">
          {#each [1, 2, 3, 4] as level}
            <div
              class="strength-bar"
              class:filled={score >= level}
              class:ok={score >= 3}
            ></div>
          {/each}
        </div>
        <span class="text-label strength-label">{t('strengthFormat', strengthLabel, String(score))}</span>
      </div>
    {/if}

    <button
      type="submit"
      class="btn btn-primary save-btn"
      disabled={errors.length > 0 || !password}
    >
      {t('savePassword')}
    </button>

    {#if saved}<p class="msg-success">{t('passwordSaved')}</p>{/if}
    </form>
  {/if}
</section>

<style>
  .section-title {
    margin: 0 0 8px;
  }

  .intro {
    margin: 0 0 24px;
  }

  .fields {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16px;
    margin-bottom: 16px;
  }

  @media (max-width: 520px) {
    .fields {
      grid-template-columns: 1fr;
    }
  }

  .input-error {
    border-color: var(--error);
  }

  .strength {
    margin-bottom: 20px;
  }

  .strength-label {
    display: block;
    margin-top: 8px;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .save-btn {
    min-width: 160px;
  }

  .password-form {
    margin: 0;
  }

  .hint-banner {
    margin: 0;
    padding: 12px;
    border-radius: var(--radius-sm);
    background: var(--amber-bg);
    color: var(--amber-text);
    font-size: 14px;
  }
</style>
