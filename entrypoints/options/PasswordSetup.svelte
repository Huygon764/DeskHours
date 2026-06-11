<script lang="ts">
  import { authItem } from '@/lib/storage';
  import { hashPassword } from '@/lib/crypto';
  import { checkPassword } from '@/lib/password-policy';
  import {
    PasswordChangeError,
    applyPasswordChange,
    verifyCurrentPassword,
  } from '@/lib/password-change';
  import { syncBlockerSafe } from '@/lib/messages';
  import { t } from '@/lib/i18n';

  let { onset = () => {} }: { onset?: () => void } = $props();

  let currentPassword = $state('');
  let password = $state('');
  let confirm = $state('');
  let errors = $state<string[]>([]);
  let score = $state(0);
  let saved = $state(false);
  let hasExisting = $state(false);
  let changeFormOpen = $state(false);
  let oldKey = $state<CryptoKey | null>(null);
  let verifyError = $state('');
  let verifying = $state(false);
  let saving = $state(false);

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

  async function startChange() {
    verifyError = '';
    verifying = true;
    try {
      oldKey = await verifyCurrentPassword(currentPassword);
      currentPassword = '';
      changeFormOpen = true;
      saved = false;
    } catch (err) {
      if (err instanceof PasswordChangeError && err.code === 'wrong_password') {
        verifyError = t('wrongPassword');
      } else {
        verifyError = t('changePasswordVerifyFailed');
      }
    } finally {
      verifying = false;
    }
  }

  function cancelChange() {
    oldKey = null;
    changeFormOpen = false;
    currentPassword = '';
    password = '';
    confirm = '';
    errors = [];
    verifyError = '';
    saved = false;
  }

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

    saving = true;
    try {
      if (hasExisting) {
        if (!oldKey) return;
        await applyPasswordChange(oldKey, password);
        await syncBlockerSafe();
        oldKey = null;
        changeFormOpen = false;
      } else {
        await authItem.setValue(await hashPassword(password));
        hasExisting = true;
      }
      saved = true;
      password = '';
      confirm = '';
      errors = [];
      onset();
    } catch (err) {
      console.error('save password failed:', err);
      errors = [t('changePasswordSaveFailed')];
    } finally {
      saving = false;
    }
  }

  function onVerifySubmit(event: SubmitEvent) {
    event.preventDefault();
    if (verifying || !currentPassword) return;
    void startChange();
  }

  function onChangeSubmit(event: SubmitEvent) {
    event.preventDefault();
    if (saving || errors.length > 0 || !password) return;
    void save();
  }

  function onFirstSetupSubmit(event: SubmitEvent) {
    event.preventDefault();
    if (saving || errors.length > 0 || !password) return;
    void save();
  }
</script>

<section class="card">
  <h2 class="text-headline-md section-title">{t('masterPasswordTitle')}</h2>
  <p class="text-body-muted intro">
    {t('masterPasswordIntro')}
  </p>

  {#if hasExisting && !changeFormOpen}
    <form class="password-form verify-form" onsubmit={onVerifySubmit}>
      <div class="verify-row">
        <input
          class="input"
          type="password"
          bind:value={currentPassword}
          placeholder={t('revealPasswordChange')}
          autocomplete="current-password"
        />
        <button
          type="submit"
          class="btn btn-primary"
          disabled={verifying || !currentPassword}
        >
          {verifying ? t('verifyingPassword') : t('changePasswordStart')}
        </button>
      </div>
      {#if verifyError}<p class="msg-error verify-error">{verifyError}</p>{/if}
    </form>
  {:else}
    <form
      class="password-form"
      onsubmit={hasExisting ? onChangeSubmit : onFirstSetupSubmit}
    >
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
            autocomplete={hasExisting ? 'new-password' : 'new-password'}
          />
          {#each errors as e}
            <p class="msg-error">{e}</p>
          {/each}
        </div>
        <div class="field">
          <label class="field-label" for="pw-confirm">{t('confirmPassword')}</label>
          <input
            id="pw-confirm"
            class="input"
            type="password"
            bind:value={confirm}
            autocomplete="new-password"
          />
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

      <div class="form-actions">
        <button
          type="submit"
          class="btn btn-primary save-btn"
          disabled={saving || errors.length > 0 || !password}
        >
          {saving ? t('savingPassword') : t('savePassword')}
        </button>
        {#if hasExisting}
          <button type="button" class="btn btn-outline" disabled={saving} onclick={cancelChange}>
            {t('cancel')}
          </button>
        {/if}
      </div>

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

  .form-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .save-btn {
    min-width: 160px;
  }

  .password-form {
    margin: 0;
  }

  .verify-form {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .verify-row {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    align-items: flex-start;
  }

  .verify-row .input {
    flex: 1 1 200px;
    min-width: 0;
  }

  .verify-error {
    margin: 0;
  }

</style>
