<script lang="ts">
  let {
    size = 24,
    class: className = '',
  }: {
    size?: number;
    class?: string;
  } = $props();

  const iconPath = $derived(
    size >= 72 ? '/icon/128.png' : size >= 36 ? '/icon/48.png' : '/icon/32.png',
  );
  const src = $derived(browser.runtime.getURL(iconPath));
</script>

<img
  class="app-logo {className}"
  {src}
  width={size}
  height={size}
  alt=""
  aria-hidden="true"
/>

<style>
  .app-logo {
    display: block;
    flex-shrink: 0;
  }
</style>
