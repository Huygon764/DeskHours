import { describe, it, expect } from 'vitest';
import { cloneBlocklist, hasPlainDomain, normalizeDomain } from './blocklist';
import type { BlockEntry } from './types';

describe('normalizeDomain', () => {
  it('strips scheme, www, and path', () => {
    expect(normalizeDomain('https://www.facebook.com/page')).toBe('facebook.com');
  });
});

describe('cloneBlocklist', () => {
  it('returns plain objects', () => {
    const entries: BlockEntry[] = [{ id: '1', domain: 'a.com', masked: false }];
    const cloned = cloneBlocklist(entries);
    expect(cloned).toEqual(entries);
    expect(cloned).not.toBe(entries);
  });
});

describe('hasPlainDomain', () => {
  it('detects duplicate plain domains', () => {
    const entries: BlockEntry[] = [{ id: '1', domain: 'facebook.com', masked: false }];
    expect(hasPlainDomain(entries, 'facebook.com')).toBe(true);
    expect(hasPlainDomain(entries, 'youtube.com')).toBe(false);
  });
});
