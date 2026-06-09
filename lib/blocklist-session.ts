import { authItem, blocklistItem, unmaskedDomainsItem } from './storage';
import { verifyPassword, deriveKey } from './crypto';
import { revealEntry } from './masking';
import { cloneBlocklist, hasPlainPattern, normalizeEntry } from './blocklist';
import type { BlockEntry } from './types';

/** Verify password and derive the AES key used for masked entries. */
export async function keyFromPassword(password: string): Promise<CryptoKey | null> {
  const auth = await authItem.getValue();
  if (!auth) return null;
  if (!(await verifyPassword(password, auth))) return null;
  return deriveKey(password, auth.salt);
}

/** Plaintext patterns for all masked entries that should be blocked this session. */
export async function unmaskedPatternsFromEntries(
  entries: BlockEntry[],
  key: CryptoKey,
): Promise<string[]> {
  const patterns: string[] = [];
  for (const e of entries) {
    if (!e.masked || e.enabled === false) continue;
    patterns.push(await revealEntry(e, key));
  }
  return patterns;
}

/** Persist decrypted masked patterns for the background worker (session-scoped). */
export async function syncUnmaskedDomains(entries: BlockEntry[], key: CryptoKey): Promise<void> {
  await unmaskedDomainsItem.setValue(await unmaskedPatternsFromEntries(entries, key));
}

/** True if pattern is already blocked (plain or decrypted masked entry). */
export async function hasBlockedPattern(
  entries: BlockEntry[],
  pattern: string,
  key: CryptoKey | null,
): Promise<boolean> {
  const normalized = entries.map(normalizeEntry);
  if (hasPlainPattern(normalized, pattern)) return true;
  if (!key) return false;
  for (const e of normalized) {
    if (!e.masked) continue;
    if ((await revealEntry(e, key)) === pattern) return true;
  }
  return false;
}

/** Load blocklist from storage with defaults applied. */
export async function loadBlocklist(): Promise<BlockEntry[]> {
  return cloneBlocklist(await blocklistItem.getValue());
}

/** Toggle enabled on an entry; persists blocklist. */
export async function setEntryEnabled(id: string, enabled: boolean): Promise<BlockEntry[]> {
  const entries = cloneBlocklist(await blocklistItem.getValue()).map(normalizeEntry);
  const next = entries.map((e) => (e.id === id ? { ...e, enabled } : e));
  await blocklistItem.setValue(next);
  return next;
}
