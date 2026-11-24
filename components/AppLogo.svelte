<script lang="ts">
  let {
    size = 24,
    class: className = '',
  }: {
    size?: number;
    class?: string;
  } = $props();

  function logoSrc(path: string): string {
    const runtime = (globalThis as { browser?: { runtime?: { getURL?: (p: string) => string } }; chrome?: { runtime?: { getURL?: (p: string) => string } } }).browser?.runtime
      ?? (globalThis as { chrome?: { runtime?: { getURL?: (p: string) => string } } }).chrome?.runtime;
    try {
      if (typeof runtime?.getURL === 'function') return runtime.getURL(path);
    } catch {
      /* static preview and tests have no extension runtime */
    }
    return path;
  }

  const iconPath = $derived(
    size >= 72 ? '/icon/128.png' : size >= 36 ? '/icon/48.png' : '/icon/32.png',
  );
  const src = $derived(logoSrc(iconPath));
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
