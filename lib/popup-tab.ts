import { blocklistItem } from './storage';
import {
  cloneBlocklist,
  domainPatternFromUrl,
  normalizePattern,
  pathPatternFromUrl,
} from './blocklist';
import { hasBlockedPattern, loadBlocklist, setEntryEnabled } from './blocklist-session';
import { syncBlockerSafe } from './messages';
import { entryMatchesPattern, findMatchingPattern } from './pattern-match';
import { revealEntry } from './masking';
import type { BlockPattern } from './blocklist';
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
  // Decrypt each masked entry at most once; reuse the plaintext for both pattern
  // matching and the enabled/disabled lookup. Masked entries with no key in this
  // session cannot be revealed, so they are skipped.
  const resolved: { entry: BlockEntry; pattern: string }[] = [];
  for (const e of entries) {
    if (!e.masked) resolved.push({ entry: e, pattern: e.domain });
    else if (key) resolved.push({ entry: e, pattern: await revealEntry(e, key) });
  }

  const rules: BlockPattern[] = resolved.map(({ entry, pattern }) => ({
    pattern,
    kind: entry.kind ?? 'site',
  }));

  const matched = findMatchingPattern(tabUrl, rules);
  if (!matched) return { kind: 'none' };

  for (const { entry, pattern } of resolved) {
    if (!entryMatchesPattern(entry, matched, pattern)) continue;
    if (entry.enabled === false) return { kind: 'listed-disabled', entry, pattern: matched };
    return { kind: 'listed-enabled', entry, pattern: matched };
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
