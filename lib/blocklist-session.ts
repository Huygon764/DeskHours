import { authItem, blocklistItem, unmaskedDomainsItem } from './storage';
import { verifyPassword, deriveKey, randomSaltB64 } from './crypto';
import { isEncryptedMaskedDomain, maskDomain, revealEntry } from './masking';
import { cloneBlocklist, hasKeywordPattern, hasPlainPattern, normalizeEntry } from './blocklist';
import type { AuthRecord, BlockEntry, BlockEntryKind } from './types';

/** Legacy records derived the AES key from `auth.salt`, making the stored hash equal to
 *  the key. Migrate to an independent `encKeySalt`, re-encrypting masked entries from the
 *  old key to the new one, and return the salt to use. Idempotent once migrated. */
export async function ensureEncKeySalt(password: string, auth: AuthRecord): Promise<string> {
  if (auth.encKeySalt) return auth.encKeySalt;

  const oldKey = await deriveKey(password, auth.salt);
  const encKeySalt = randomSaltB64();
  const newKey = await deriveKey(password, encKeySalt);

  const entries = cloneBlocklist(await blocklistItem.getValue());
  const reencrypted: BlockEntry[] = [];
  for (const e of entries) {
    if (!e.masked || !isEncryptedMaskedDomain(e.domain)) {
      reencrypted.push(e);
      continue;
    }
    const plaintext = await revealEntry(e, oldKey);
    reencrypted.push({ ...e, domain: await maskDomain(plaintext, newKey) });
  }

  await Promise.all([
    authItem.setValue({ ...auth, encKeySalt }),
    blocklistItem.setValue(reencrypted),
  ]);
  return encKeySalt;
}

/** Verify password and derive the AES key used for masked entries. */
export async function keyFromPassword(password: string): Promise<CryptoKey | null> {
  const auth = await authItem.getValue();
  if (!auth) return null;
  if (!(await verifyPassword(password, auth))) return null;
  return deriveKey(password, await ensureEncKeySalt(password, auth));
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
  kind: BlockEntryKind = 'site',
): Promise<boolean> {
  const normalized = entries.map(normalizeEntry);
  if (kind === 'keyword') {
    if (hasKeywordPattern(normalized, pattern)) return true;
    if (!key) return false;
    const lower = pattern.toLowerCase();
    for (const e of normalized) {
      if (e.kind !== 'keyword' || !e.masked || !isEncryptedMaskedDomain(e.domain)) continue;
      if ((await revealEntry(e, key)).toLowerCase() === lower) return true;
    }
    return false;
  }
  if (hasPlainPattern(normalized, pattern)) return true;
  for (const e of normalized) {
    if (!e.masked || isEncryptedMaskedDomain(e.domain)) continue;
    if (e.domain === pattern) return true;
  }
  if (!key) return false;
  for (const e of normalized) {
    if (!e.masked || !isEncryptedMaskedDomain(e.domain)) continue;
    if ((await revealEntry(e, key)) === pattern) return true;
  }
  return false;
}

/** Load blocklist from storage with defaults applied. */
export async function loadBlocklist(): Promise<BlockEntry[]> {
  return cloneBlocklist(await blocklistItem.getValue());
}

/** Write a blocklist as a plain clone (never pass Svelte $state proxies to setValue)
 *  and return the stored copy for the caller to mirror into local state. */
export async function persistBlocklist(next: BlockEntry[]): Promise<BlockEntry[]> {
  const plain = cloneBlocklist(next);
  await blocklistItem.setValue(plain);
  return plain;
}

/** Toggle enabled on an entry; persists blocklist. */
export async function setEntryEnabled(id: string, enabled: boolean): Promise<BlockEntry[]> {
  const entries = cloneBlocklist(await blocklistItem.getValue()).map(normalizeEntry);
  const next = entries.map((e) => (e.id === id ? { ...e, enabled } : e));
  await blocklistItem.setValue(next);
  return next;
}
