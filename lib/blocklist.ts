import type { BlockEntry } from './types';

/** Plain copy for chrome.storage — do not pass Svelte $state proxies to setValue. */
export function cloneBlocklist(entries: BlockEntry[]): BlockEntry[] {
  return entries.map((e) => ({ id: e.id, domain: e.domain, masked: e.masked }));
}

/** Normalize user input to a bare registrable domain. */
export function normalizeDomain(raw: string): string {
  return raw
    .trim()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .split('/')[0];
}

/** True if a non-masked entry already blocks this domain. */
export function hasPlainDomain(entries: BlockEntry[], domain: string): boolean {
  return entries.some((e) => !e.masked && e.domain === domain);
}
