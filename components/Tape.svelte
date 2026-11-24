<script lang="ts">
  import type { Snippet } from 'svelte';
  import tapePiece from '@/assets/plates/tape-piece.png';

  let {
    rest = '-1.05deg',
    children,
  }: {
    rest?: string;
    children: Snippet;
  } = $props();
</script>

<div class="tape" style="--tape-rest: {rest}">
  <img class="tape-piece" src={tapePiece} alt="" />
  <div class="tape-ink">
    {@render children()}
  </div>
</div>

<style>
  .tape {
    position: relative;
    margin: 2px 0 18px;
    filter: drop-shadow(0 1px 2px rgba(21, 21, 21, 0.16));
    animation: tape-settle 0.72s cubic-bezier(0.16, 1, 0.3, 1) both;
  }

  .tape-piece {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: fill;
    pointer-events: none;
  }

  .tape-ink {
    position: relative;
    z-index: 1;
  }

  :global([data-theme='dark']) .tape {
    animation: none;
    transform: none;
    filter: none;
    background: var(--surface-low);
  }

  :global([data-theme='dark']) .tape-piece {
    display: none;
  }

  @keyframes tape-settle {
    from {
      transform: rotate(-0.2deg) translateY(-5px);
      filter: drop-shadow(0 0 0 transparent);
    }
    to {
      transform: rotate(var(--tape-rest, -1.05deg)) translateY(0);
      filter: drop-shadow(0 1px 2px rgba(21, 21, 21, 0.16));
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .tape {
      animation: none;
      transform: rotate(var(--tape-rest, -1.05deg));
    }
  }
</style>
