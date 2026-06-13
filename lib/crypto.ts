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

function pbkdf2Params(salt: Uint8Array, iterations: number) {
  return { name: 'PBKDF2', salt: salt as BufferSource, iterations, hash: 'SHA-256' } as const;
}

async function pbkdf2Bits(password: string, salt: Uint8Array, iterations: number): Promise<ArrayBuffer> {
  const baseKey = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  return crypto.subtle.deriveBits(pbkdf2Params(salt, iterations), baseKey, 256);
}

/** Constant-time equality for two equal-purpose strings; avoids leaking match length. */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Fresh random 16-byte salt, base64. */
export function randomSaltB64(): string {
  return toB64(crypto.getRandomValues(new Uint8Array(16)).buffer);
}

/** Hash a new password with a fresh auth salt and an independent masking-key salt.
 *  The two salts are distinct so the stored hash is never itself the AES key. */
export async function hashPassword(password: string): Promise<AuthRecord> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const bits = await pbkdf2Bits(password, salt, ITERATIONS);
  return {
    hash: toB64(bits),
    salt: toB64(salt.buffer),
    iterations: ITERATIONS,
    encKeySalt: randomSaltB64(),
  };
}

/** Constant-effort verification against a stored AuthRecord. */
export async function verifyPassword(password: string, rec: AuthRecord): Promise<boolean> {
  const bits = await pbkdf2Bits(password, fromB64(rec.salt), rec.iterations);
  return timingSafeEqual(toB64(bits), rec.hash);
}

/** Derive an AES-GCM key from the password + a base64 salt. Pass the auth record's
 *  `encKeySalt` (NOT `salt`) so the key is independent of the stored password hash. */
export async function deriveKey(password: string, saltB64: string): Promise<CryptoKey> {
  const baseKey = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    pbkdf2Params(fromB64(saltB64), ITERATIONS),
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
