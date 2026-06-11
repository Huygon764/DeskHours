import { cloneBlocklist } from './blocklist';
import { deriveKey, hashPassword, verifyPassword } from './crypto';
import { maskDomain, revealEntry } from './masking';
import { authItem, blocklistItem, unmaskedDomainsItem } from './storage';
import type { BlockEntry } from './types';

export class PasswordChangeError extends Error {
  constructor(readonly code: 'wrong_password' | 'no_password') {
    super(code);
    this.name = 'PasswordChangeError';
  }
}

/** Verify the current password and return the AES key for hidden entries. */
export async function verifyCurrentPassword(password: string): Promise<CryptoKey> {
  const auth = await authItem.getValue();
  if (!auth) throw new PasswordChangeError('no_password');
  if (!(await verifyPassword(password, auth))) throw new PasswordChangeError('wrong_password');
  return deriveKey(password, auth.salt);
}

async function reencryptMaskedEntries(
  entries: BlockEntry[],
  oldKey: CryptoKey,
  newKey: CryptoKey,
): Promise<BlockEntry[]> {
  const next: BlockEntry[] = [];
  for (const entry of entries) {
    if (!entry.masked) {
      next.push(entry);
      continue;
    }
    const plaintext = await revealEntry(entry, oldKey);
    next.push({ ...entry, domain: await maskDomain(plaintext, newKey) });
  }
  return next;
}

/** Set a new master password and re-encrypt hidden entries. */
export async function applyPasswordChange(oldKey: CryptoKey, newPassword: string): Promise<void> {
  const newAuth = await hashPassword(newPassword);
  const newKey = await deriveKey(newPassword, newAuth.salt);
  const entries = cloneBlocklist(await blocklistItem.getValue());
  const next = await reencryptMaskedEntries(entries, oldKey, newKey);

  await Promise.all([
    blocklistItem.setValue(next),
    authItem.setValue(newAuth),
    unmaskedDomainsItem.setValue([]),
  ]);
}
