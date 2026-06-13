import { describe, it, expect } from 'vitest';
import {
  peekPendingBlockUrl,
  setPendingBlockUrl,
  takePendingBlockUrl,
  clearPendingBlockUrl,
} from './pending-block-url';

describe('pending-block-url', () => {
  it('stores and takes a URL per tab', () => {
    setPendingBlockUrl(1, 'https://facebook.com/');
    expect(peekPendingBlockUrl(1)).toBe('https://facebook.com/');
    expect(takePendingBlockUrl(1)).toBe('https://facebook.com/');
    expect(takePendingBlockUrl(1)).toBeNull();
  });

  it('clears without returning', () => {
    setPendingBlockUrl(2, 'https://youtube.com/');
    clearPendingBlockUrl(2);
    expect(takePendingBlockUrl(2)).toBeNull();
  });
});
