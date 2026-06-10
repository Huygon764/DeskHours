import { describe, it, expect } from 'vitest';
import { entryMatchesPattern, findMatchingPattern, urlMatchesPattern } from './pattern-match';

describe('urlMatchesPattern', () => {
  it('matches whole-domain patterns', () => {
    expect(urlMatchesPattern('https://www.youtube.com/watch?v=1', 'youtube.com')).toBe(true);
    expect(urlMatchesPattern('https://google.com/', 'youtube.com')).toBe(false);
  });

  it('matches path wildcard patterns without blocking the whole domain', () => {
    expect(urlMatchesPattern('https://youtube.com/shorts/abc', 'youtube.com/shorts/*')).toBe(true);
    expect(urlMatchesPattern('https://youtube.com/watch?v=1', 'youtube.com/shorts/*')).toBe(false);
  });

  it('matches keywords anywhere in the URL', () => {
    expect(urlMatchesPattern('https://youtube.com/shorts/abc', 'shorts', 'keyword')).toBe(true);
    expect(urlMatchesPattern('https://google.com/search?q=shorts', 'shorts', 'keyword')).toBe(true);
    expect(urlMatchesPattern('https://youtube.com/watch?v=1', 'shorts', 'keyword')).toBe(false);
  });

  it('matches keywords case-insensitively', () => {
    expect(urlMatchesPattern('https://x.com/Shorts/1', 'shorts', 'keyword')).toBe(true);
  });
});

describe('findMatchingPattern', () => {
  it('prefers the most specific matching pattern', () => {
    const url = 'https://youtube.com/shorts/abc';
    const patterns = [
      { pattern: 'youtube.com', kind: 'site' as const },
      { pattern: 'youtube.com/shorts/*', kind: 'site' as const },
    ];
    expect(findMatchingPattern(url, patterns)).toBe('youtube.com/shorts/*');
  });

  it('returns keyword matches', () => {
    const url = 'https://youtube.com/shorts/abc';
    expect(findMatchingPattern(url, [{ pattern: 'shorts', kind: 'keyword' }])).toBe('shorts');
  });
});

describe('entryMatchesPattern', () => {
  it('matches keyword entries case-insensitively', () => {
    expect(entryMatchesPattern({ domain: 'Shorts', kind: 'keyword', masked: false }, 'shorts')).toBe(
      true,
    );
  });
});
