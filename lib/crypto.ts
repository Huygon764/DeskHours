import type { AuthRecord, EncryptedPayload } from './types';

const ITERATIONS = 600_000;
const enc = new TextEncoder();
const dec = new TextDecoder();

function toB64(buf: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buf)));
}
function fromB64(b64: string): Uint8Array {
  const binary = atob(b64);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

async function pbkdf2Bits(password: string, salt: Uint8Array, iterations: number): Promise<ArrayBuffer> {
  const baseKey = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  return crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: salt as BufferSource, iterations, hash: 'SHA-256' },
    baseKey,
    256,
  );
}

/** Hash a new password with a fresh random salt. */
export async function hashPassword(password: string): Promise<AuthRecord> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const bits = await pbkdf2Bits(password, salt, ITERATIONS);
  return { hash: toB64(bits), salt: toB64(salt.buffer), iterations: ITERATIONS };
}

/** Constant-effort verification against a stored AuthRecord. */
export async function verifyPassword(password: string, rec: AuthRecord): Promise<boolean> {
  const bits = await pbkdf2Bits(password, fromB64(rec.salt), rec.iterations);
  return toB64(bits) === rec.hash;
}

/** Derive an AES-GCM key from the password + a base64 salt. */
export async function deriveKey(password: string, saltB64: string): Promise<CryptoKey> {
  const baseKey = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: fromB64(saltB64) as BufferSource, iterations: ITERATIONS, hash: 'SHA-256' },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

export async function encrypt(plaintext: string, key: CryptoKey): Promise<EncryptedPayload> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(plaintext));
  return { iv: toB64(iv.buffer), ciphertext: toB64(ct) };
}

export async function decrypt(payload: EncryptedPayload, key: CryptoKey): Promise<string> {
  const pt = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: fromB64(payload.iv) as BufferSource },
    key,
    fromB64(payload.ciphertext) as BufferSource,
  );
  return dec.decode(pt);
}
