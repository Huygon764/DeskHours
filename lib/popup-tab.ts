import { blocklistItem } from './storage';
import { cloneBlocklist, domainPatternFromUrl, normalizePattern, pathPatternFromUrl } from './blocklist';
import { hasBlockedPattern, loadBlocklist, setEntryEnabled } from './blocklist-session';
import { syncBlockerSafe } from './messages';
import { findMatchingPattern } from './pattern-match';
import { revealEntry } from './masking';
import type { BlockEntry } from './types';

export type PageBlockStatus =
  | { kind: 'none' }
  | { kind: 'listed-disabled'; entry: BlockEntry; pattern: string }
  | { kind: 'listed-enabled'; entry: BlockEntry; pattern: string };

/** Resolve how the active tab relates to the blocklist. */
export async function pageBlockStatus(
  tabUrl: string,
  entries: BlockEntry[],
  key: CryptoKey | null,
): Promise<PageBlockStatus> {
  const plainPatterns: string[] = [];
  for (const e of entries) {
    if (e.masked) {
      if (key) plainPatterns.push(await revealEntry(e, key));
    } else {
      plainPatterns.push(e.domain);
    }
  }

  const matched = findMatchingPattern(tabUrl, plainPatterns);
  if (!matched) return { kind: 'none' };

  for (const e of entries) {
    const p = e.masked && key ? await revealEntry(e, key) : e.domain;
    if (p !== matched) continue;
    if (e.enabled === false) return { kind: 'listed-disabled', entry: e, pattern: matched };
    return { kind: 'listed-enabled', entry: e, pattern: matched };
  }

  return { kind: 'none' };
}

export async function addPattern(pattern: string, masked = false, key: CryptoKey | null = null): Promise<void> {
  const normalized = normalizePattern(pattern);
  const stored = await loadBlocklist();
  if (await hasBlockedPattern(stored, normalized, key)) return;

  const id = crypto.randomUUID();
  let domainStored = normalized;
  if (masked && key) {
    const { maskDomain } = await import('./masking');
    domainStored = await maskDomain(normalized, key);
  }

  const next = [...cloneBlocklist(stored), { id, domain: domainStored, masked, enabled: true }];
  await blocklistItem.setValue(next);
  await syncBlockerSafe();
}

export async function toggleEntry(id: string, enabled: boolean): Promise<void> {
  await setEntryEnabled(id, enabled);
  await syncBlockerSafe();
}

export { domainPatternFromUrl, pathPatternFromUrl, normalizePattern };
