/** Reactive helpers shared by the popup panels (Svelte 5 runes module).
 *  Each must be called during a component's init so the inner $effect has an owner. */

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
