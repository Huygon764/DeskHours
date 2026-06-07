import { describe, it, expect } from 'vitest';
import { maskDomain, revealEntry } from './masking';
import type { BlockEntry } from './types';
import { deriveKey } from './crypto';

describe('masking', () => {
  it('mask then reveal round-trips through an entry', async () => {
    const key = await deriveKey('Correct-Horse-9!', 'c2FsdHNhbHQ=');
    const entry: BlockEntry = { id: 'x', domain: await maskDomain('reddit.com', key), masked: true };
    expect(entry.domain).not.toContain('reddit');
    expect(await revealEntry(entry, key)).toBe('reddit.com');
  });

  it('revealEntry returns plaintext domain unchanged for non-masked entries', async () => {
    const key = await deriveKey('Correct-Horse-9!', 'c2FsdHNhbHQ=');
    const entry: BlockEntry = { id: 'y', domain: 'twitter.com', masked: false };
    expect(await revealEntry(entry, key)).toBe('twitter.com');
  });
});
