import type { BlockEntry, EncryptedPayload } from './types';
import { encrypt, decrypt } from './crypto';

/** True when `domain` holds a legacy AES-GCM payload instead of plaintext. */
export function isEncryptedMaskedDomain(domain: string): boolean {
  if (!domain.startsWith('{')) return false;
  try {
    const parsed = JSON.parse(domain) as Partial<EncryptedPayload>;
    return typeof parsed.iv === 'string' && typeof parsed.ciphertext === 'string';
  } catch {
    return false;
  }
}

/** Encrypt a domain into the string stored in a masked entry's `domain` field. */
export async function maskDomain(domain: string, key: CryptoKey): Promise<string> {
  const payload = await encrypt(domain, key);
  return JSON.stringify(payload);
}

/** Decrypt a masked entry's domain; pass-through for non-masked and plaintext hidden entries. */
export async function revealEntry(entry: BlockEntry, key: CryptoKey): Promise<string> {
  if (!entry.masked) return entry.domain;
  if (!isEncryptedMaskedDomain(entry.domain)) return entry.domain;
  const payload = JSON.parse(entry.domain) as EncryptedPayload;
  return decrypt(payload, key);
}
