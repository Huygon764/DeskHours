<script lang="ts">
  import FocusPanel from '../popup/FocusPanel.svelte';
  import TimerPanel from '../popup/TimerPanel.svelte';
  import { t } from '@/lib/i18n';
</script>

<section class="card focus-timer-card">
  <h2 class="text-headline-md section-title">{t('tabFocus')}</h2>
  <FocusPanel />
</section>

<section class="card focus-timer-card">
  <h2 class="text-headline-md section-title">{t('tabTimer')}</h2>
  <TimerPanel />
</section>

<style>
  .focus-timer-card {
    max-width: 420px;
  }

  .focus-timer-card + .focus-timer-card {
    margin-top: 24px;
  }

  .section-title {
    margin: 0 0 20px;
  }
</style>
