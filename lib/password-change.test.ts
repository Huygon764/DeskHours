import { describe, it, expect, beforeEach } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { hashPassword, deriveKey } from './crypto';
import { maskDomain, revealEntry } from './masking';
import {
  PasswordChangeError,
  applyPasswordChange,
  verifyCurrentPassword,
} from './password-change';
import { authItem, blocklistItem, unmaskedDomainsItem } from './storage';
import type { BlockEntry } from './types';

describe('password change', () => {
  beforeEach(() => fakeBrowser.reset());

  it('verifyCurrentPassword rejects wrong password', async () => {
    await authItem.setValue(await hashPassword('Old-Horse-9!'));
    await expect(verifyCurrentPassword('wrong')).rejects.toThrow(PasswordChangeError);
  });

  it('verifyCurrentPassword returns a key for the correct password', async () => {
    await authItem.setValue(await hashPassword('Old-Horse-9!'));
    const key = await verifyCurrentPassword('Old-Horse-9!');
    expect(key).toBeTruthy();
  });

  it('applyPasswordChange re-encrypts hidden entries and updates auth', async () => {
    const oldAuth = await hashPassword('Old-Horse-9!');
    await authItem.setValue(oldAuth);
    const oldKey = await deriveKey('Old-Horse-9!', oldAuth.encKeySalt);
    const entry: BlockEntry = {
      id: '1',
      domain: await maskDomain('secret.com', oldKey),
      masked: true,
    };
    await blocklistItem.setValue([entry]);
    await unmaskedDomainsItem.setValue(['secret.com']);

    const oldKeyForChange = await verifyCurrentPassword('Old-Horse-9!');
    await applyPasswordChange(oldKeyForChange, 'New-Horse-9!');

    expect(await unmaskedDomainsItem.getValue()).toEqual([]);
    expect(await verifyCurrentPassword('New-Horse-9!')).toBeTruthy();
    await expect(verifyCurrentPassword('Old-Horse-9!')).rejects.toThrow(PasswordChangeError);

    const stored = (await blocklistItem.getValue())[0];
    const newKey = await verifyCurrentPassword('New-Horse-9!');
    expect(await revealEntry(stored, newKey)).toBe('secret.com');
  });
});
