import type { BlockEntry, EncryptedPayload } from './types';
import { encrypt, decrypt } from './crypto';

/** Encrypt a domain into the string stored in a masked entry's `domain` field. */
export async function maskDomain(domain: string, key: CryptoKey): Promise<string> {
  const payload = await encrypt(domain, key);
  return JSON.stringify(payload);
}

/** Decrypt a masked entry's domain; pass-through for non-masked entries. */
export async function revealEntry(entry: BlockEntry, key: CryptoKey): Promise<string> {
  if (!entry.masked) return entry.domain;
  const payload = JSON.parse(entry.domain) as EncryptedPayload;
  return decrypt(payload, key);
}
