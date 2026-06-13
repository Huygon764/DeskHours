/** Reactive helpers shared by the popup panels (Svelte 5 runes module).
 *  Each must be called during a component's init so the inner $effect has an owner. */
import { watchLocale } from './i18n';
import { blocklistItem } from './storage';
import { cloneBlocklist } from './blocklist';
import { loadBlocklist } from './blocklist-session';
import type { BlockEntry } from './types';

/** A counter that bumps whenever the UI language changes; read it inside `{#key ...}`
 *  (and `void` it in any `t()`-derived value) to re-render translated content. */
export function useLocaleRevision() {
  let revision = $state(0);
  $effect(() => watchLocale(() => revision++));
  return {
    get value() {
      return revision;
    },
  };
}

/** A wall-clock that ticks every `intervalMs` while the using component is mounted. */
export function useNow(intervalMs = 250) {
  let now = $state(Date.now());
  $effect(() => {
    const id = setInterval(() => (now = Date.now()), intervalMs);
    return () => clearInterval(id);
  });
  return {
    get value() {
      return now;
    },
    /** Force an immediate update, e.g. right after the watched state changes. */
    sync() {
      now = Date.now();
    },
  };
}

/** Load the blocklist once and keep it live via watch. The component owns its own
 *  `entries` state (so it can reassign after mutations); this just feeds it. `onEntries`
 *  fires for the initial load and every external change; `onError`/`onSettled` cover the
 *  initial load outcome. */
export function watchBlocklist(opts: {
  onEntries: (entries: BlockEntry[]) => void;
  onError: (err: unknown) => void;
  onSettled?: () => void;
}) {
  $effect(() => {
    let active = true;
    void (async () => {
      try {
        const loaded = await loadBlocklist();
        if (active) opts.onEntries(loaded);
      } catch (err) {
        if (active) opts.onError(err);
      } finally {
        if (active) opts.onSettled?.();
      }
    })();
    const unwatch = blocklistItem.watch((v) => opts.onEntries(cloneBlocklist(v)));
    return () => {
      active = false;
      unwatch();
    };
  });
}

interface ReadableStored<T> {
  getValue(): Promise<T>;
  watch(cb: (value: T) => void): () => void;
}

/** Reactive mirror of a WXT storage item: seeded via getValue and kept live via watch.
 *  `transform` adapts the raw stored value; `onChange` runs after every update. */
export function useStored<T, U = T>(
  item: ReadableStored<T>,
  opts: { transform?: (raw: T) => U; onChange?: (value: U) => void } = {},
) {
  const transform = opts.transform ?? ((v: T) => v as unknown as U);
  let value = $state<U | null>(null);
  $effect(() => {
    const apply = (raw: T) => {
      value = transform(raw);
      opts.onChange?.(value);
    };
    const unwatch = item.watch(apply);
    void item.getValue().then(apply);
    return () => unwatch();
  });
  return {
    get value() {
      return value;
    },
  };
}
