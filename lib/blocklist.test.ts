import { describe, it, expect } from 'vitest';
import { cloneBlocklist, hasPlainPattern, isPathPattern, normalizePattern, pathPatternFromUrl } from './blocklist';

describe('normalizePattern', () => {
  it('strips scheme and www from domains', () => {
    expect(normalizePattern('https://www.facebook.com/page')).toBe('facebook.com/page');
  });

  it('preserves path segments', () => {
    expect(normalizePattern('youtube.com/shorts/*')).toBe('youtube.com/shorts/*');
  });
});

describe('pathPatternFromUrl', () => {
  it('builds a first-segment wildcard from a tab URL', () => {
    expect(pathPatternFromUrl('https://www.youtube.com/shorts/abc')).toBe('youtube.com/shorts/*');
  });

  it('returns null for site root', () => {
    expect(pathPatternFromUrl('https://youtube.com/')).toBeNull();
  });
});

describe('isPathPattern', () => {
  it('detects path and wildcard patterns', () => {
    expect(isPathPattern('youtube.com')).toBe(false);
    expect(isPathPattern('youtube.com/shorts/*')).toBe(true);
  });
});

describe('cloneBlocklist', () => {
  it('returns plain objects with enabled defaulting true', () => {
    const entries = [{ id: '1', domain: 'a.com', masked: false }];
    expect(cloneBlocklist(entries)).toEqual([{ id: '1', domain: 'a.com', masked: false, enabled: true }]);
  });
});

describe('hasPlainPattern', () => {
  it('detects duplicate plain patterns', () => {
    const entries = [{ id: '1', domain: 'facebook.com', masked: false, enabled: true }];
    expect(hasPlainPattern(entries, 'facebook.com')).toBe(true);
    expect(hasPlainPattern(entries, 'youtube.com/shorts/*')).toBe(false);
  });
});
