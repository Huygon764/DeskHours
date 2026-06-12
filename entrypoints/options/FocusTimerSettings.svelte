<script lang="ts">
  import FocusPanel from '../popup/FocusPanel.svelte';
  import TimerPanel from '../popup/TimerPanel.svelte';
  import { t } from '@/lib/i18n';
</script>

<section class="card">
  <h2 class="text-headline-md section-title">{t('tabFocus')}</h2>
  <FocusPanel />
</section>

<section class="card">
  <h2 class="text-headline-md section-title">{t('tabTimer')}</h2>
  <TimerPanel />
</section>

<style>
  .section-title {
    margin: 0 0 20px;
  }
</style>
