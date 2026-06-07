import { authItem, blocklistItem, unmaskedDomainsItem } from './storage';
import { verifyPassword, deriveKey } from './crypto';
import { revealEntry } from './masking';
import { cloneBlocklist, hasPlainDomain } from './blocklist';
import type { BlockEntry } from './types';

/** Verify password and derive the AES key used for masked entries. */
export async function keyFromPassword(password: string): Promise<CryptoKey | null> {
  const auth = await authItem.getValue();
  if (!auth) return null;
  if (!(await verifyPassword(password, auth))) return null;
  return deriveKey(password, auth.salt);
}

/** Plaintext domains for all masked entries that should be blocked this session. */
export async function unmaskedDomainsFromEntries(
  entries: BlockEntry[],
  key: CryptoKey,
): Promise<string[]> {
  const domains: string[] = [];
  for (const e of entries) {
    if (!e.masked) continue;
    domains.push(await revealEntry(e, key));
  }
  return domains;
}

/** Persist decrypted masked domains for the background worker (session-scoped). */
export async function syncUnmaskedDomains(entries: BlockEntry[], key: CryptoKey): Promise<void> {
  await unmaskedDomainsItem.setValue(await unmaskedDomainsFromEntries(entries, key));
}

/** True if domain is already blocked (plain or decrypted masked entry). */
export async function hasBlockedDomain(
  entries: BlockEntry[],
  domain: string,
  key: CryptoKey | null,
): Promise<boolean> {
  if (hasPlainDomain(entries, domain)) return true;
  if (!key) return false;
  for (const e of entries) {
    if (!e.masked) continue;
    if ((await revealEntry(e, key)) === domain) return true;
  }
  return false;
}

/** Load blocklist from storage. */
export async function loadBlocklist(): Promise<BlockEntry[]> {
  return cloneBlocklist(await blocklistItem.getValue());
}
