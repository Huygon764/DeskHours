import { describe, it, expect, beforeEach } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { hashPassword, deriveKey } from './crypto';
import { maskDomain, revealEntry } from './masking';
import { ensureEncKeySalt, keyFromPassword } from './blocklist-session';
import { authItem, blocklistItem } from './storage';
import type { AuthRecord, BlockEntry } from './types';

describe('legacy encKeySalt migration', () => {
  beforeEach(() => fakeBrowser.reset());

  it('migrates a legacy auth record and re-encrypts masked entries losslessly', async () => {
    // Legacy: no encKeySalt, masked entries encrypted with the salt-derived key.
    const fresh = await hashPassword('Correct-Horse-9!');
    const legacyAuth = { hash: fresh.hash, salt: fresh.salt, iterations: fresh.iterations } as AuthRecord;
    await authItem.setValue(legacyAuth);
    const legacyKey = await deriveKey('Correct-Horse-9!', legacyAuth.salt);
    const entry: BlockEntry = { id: '1', domain: await maskDomain('secret.com', legacyKey), masked: true };
    await blocklistItem.setValue([entry]);

    const key = await keyFromPassword('Correct-Horse-9!');
    expect(key).toBeTruthy();

    const migrated = await authItem.getValue();
    expect(migrated?.encKeySalt).toBeTruthy();
    expect(migrated?.encKeySalt).not.toBe(legacyAuth.salt);

    // The entry is now decryptable with the migrated key and still reads back plaintext.
    const stored = (await blocklistItem.getValue())[0];
    expect(await revealEntry(stored, key!)).toBe('secret.com');
  });

  it('ensureEncKeySalt is idempotent for already-migrated records', async () => {
    const auth = await hashPassword('Correct-Horse-9!');
    await authItem.setValue(auth);
    const salt = await ensureEncKeySalt('Correct-Horse-9!', auth);
    expect(salt).toBe(auth.encKeySalt);
  });
});
