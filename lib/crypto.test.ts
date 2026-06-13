import { describe, it, expect } from 'vitest';
import { hashPassword, verifyPassword, deriveKey, encrypt, decrypt } from './crypto';

describe('password hashing', () => {
  it('verifies a correct password and rejects a wrong one', async () => {
    const rec = await hashPassword('Correct-Horse-9!');
    expect(await verifyPassword('Correct-Horse-9!', rec)).toBe(true);
    expect(await verifyPassword('wrong', rec)).toBe(false);
  });
  it('uses a random salt (two hashes of same password differ)', async () => {
    const a = await hashPassword('Correct-Horse-9!');
    const b = await hashPassword('Correct-Horse-9!');
    expect(a.salt).not.toBe(b.salt);
    expect(a.hash).not.toBe(b.hash);
  });
  it('derives the masking key from a salt independent of the auth hash', async () => {
    const rec = await hashPassword('Correct-Horse-9!');
    expect(rec.encKeySalt).toBeTruthy();
    expect(rec.encKeySalt).not.toBe(rec.salt);
    // Key whose raw bits equal the stored hash (the salt-derived key) must NOT
    // decrypt masked data, so reading storage alone cannot reveal hidden domains.
    const hashKey = await deriveKey('Correct-Horse-9!', rec.salt);
    const maskKey = await deriveKey('Correct-Horse-9!', rec.encKeySalt);
    const payload = await encrypt('facebook.com', maskKey);
    await expect(decrypt(payload, hashKey)).rejects.toThrow();
  });
});

describe('AES-GCM encrypt/decrypt', () => {
  it('round-trips plaintext with a password-derived key', async () => {
    const key = await deriveKey('Correct-Horse-9!', 'c2FsdHNhbHQ=');
    const payload = await encrypt('facebook.com', key);
    expect(payload.iv).toBeTruthy();
    expect(payload.ciphertext).not.toContain('facebook');
    expect(await decrypt(payload, key)).toBe('facebook.com');
  });
  it('fails to decrypt with the wrong key', async () => {
    const k1 = await deriveKey('Correct-Horse-9!', 'c2FsdHNhbHQ=');
    const k2 = await deriveKey('different-pass', 'c2FsdHNhbHQ=');
    const payload = await encrypt('secret.com', k1);
    await expect(decrypt(payload, k2)).rejects.toThrow();
  });
});
