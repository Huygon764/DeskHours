import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { resolveTheme } from './theme';

describe('resolveTheme', () => {
  beforeEach(() => {
    vi.stubGlobal('window', {
      matchMedia: vi.fn((query: string) => ({
        matches: query === '(prefers-color-scheme: dark)',
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns light or dark directly when not system', () => {
    expect(resolveTheme('light')).toBe('light');
    expect(resolveTheme('dark')).toBe('dark');
  });

  it('follows prefers-color-scheme when system', () => {
    expect(resolveTheme('system')).toBe('dark');
    vi.stubGlobal('window', {
      matchMedia: vi.fn(() => ({
        matches: false,
        media: '',
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
    expect(resolveTheme('system')).toBe('light');
  });
});
