<script lang="ts">
  import { authItem } from '@/lib/storage';
  import { hashPassword } from '@/lib/crypto';
  import { checkPassword } from '@/lib/password-policy';

  let { onset = () => {} }: { onset?: () => void } = $props();

  let password = $state('');
  let confirm = $state('');
  let errors = $state<string[]>([]);
  let score = $state(0);
  let saved = $state(false);

  function onInput() {
    const r = checkPassword(password);
    errors = r.errors;
    score = r.score;
  }

  async function save() {
    const r = checkPassword(password);
    if (!r.ok) {
      errors = r.errors;
      return;
    }
    if (password !== confirm) {
      errors = ['Passwords do not match'];
      return;
    }
    await authItem.setValue(await hashPassword(password));
    saved = true;
    password = '';
    confirm = '';
    onset();
  }
</script>

<section>
  <h2>Master password</h2>
  <p>Set a strong password. It guards unblocking, editing during blocked hours, and masked sites.</p>
  <label>Password <input type="password" bind:value={password} oninput={onInput} /></label>
  <label>Confirm <input type="password" bind:value={confirm} /></label>
  <p>Strength: {score}/4</p>
  <ul>{#each errors as e}<li class="error">{e}</li>{/each}</ul>
  <button onclick={save} disabled={errors.length > 0 || !password}>Save password</button>
  {#if saved}<p>Password saved.</p>{/if}
</section>

<style>
  .error { color: #c0392b; }
  label { display: block; margin: 0.5rem 0; }
  input { display: block; width: 100%; max-width: 20rem; padding: 0.4rem; box-sizing: border-box; }
</style>
