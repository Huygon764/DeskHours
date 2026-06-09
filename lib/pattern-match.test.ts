import { describe, it, expect } from 'vitest';
import { findMatchingPattern, urlMatchesPattern } from './pattern-match';

describe('urlMatchesPattern', () => {
  it('matches whole-domain patterns', () => {
    expect(urlMatchesPattern('https://www.youtube.com/watch?v=1', 'youtube.com')).toBe(true);
    expect(urlMatchesPattern('https://google.com/', 'youtube.com')).toBe(false);
  });

  it('matches path wildcard patterns without blocking the whole domain', () => {
    expect(urlMatchesPattern('https://youtube.com/shorts/abc', 'youtube.com/shorts/*')).toBe(true);
    expect(urlMatchesPattern('https://youtube.com/watch?v=1', 'youtube.com/shorts/*')).toBe(false);
  });
});

describe('findMatchingPattern', () => {
  it('prefers the most specific matching pattern', () => {
    const url = 'https://youtube.com/shorts/abc';
    const patterns = ['youtube.com', 'youtube.com/shorts/*'];
    expect(findMatchingPattern(url, patterns)).toBe('youtube.com/shorts/*');
  });
});
