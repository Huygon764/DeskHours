import { describe, it, expect } from 'vitest';
import { buildRedirectRules } from './dnr-rules';
import type { BlockPattern } from './blocklist';

describe('buildRedirectRules', () => {
  it('builds one main_frame redirect rule per domain', () => {
    const patterns: BlockPattern[] = [
      { pattern: 'facebook.com', kind: 'site' },
      { pattern: 'youtube.com', kind: 'site' },
    ];
    const rules = buildRedirectRules(patterns);
    expect(rules).toHaveLength(2);
    expect(rules[0]).toEqual({
      id: 1,
      priority: 1,
      action: { type: 'redirect', redirect: { extensionPath: '/blocked.html' } },
      condition: { requestDomains: ['facebook.com'], resourceTypes: ['main_frame'] },
    });
    expect(rules[1].id).toBe(2);
    expect(rules[1].condition.requestDomains).toEqual(['youtube.com']);
  });

  it('builds urlFilter rules for path patterns', () => {
    const rules = buildRedirectRules([{ pattern: 'youtube.com/shorts/*', kind: 'site' }]);
    expect(rules).toHaveLength(1);
    expect(rules[0].condition.urlFilter).toBe('*://*.youtube.com/shorts/*');
    expect(rules[0].condition.isUrlFilterCaseSensitive).toBe(false);
    expect(rules[0].condition.requestDomains).toBeUndefined();
  });

  it('builds urlFilter rules for URL keywords', () => {
    const rules = buildRedirectRules([{ pattern: 'shorts', kind: 'keyword' }]);
    expect(rules).toHaveLength(1);
    expect(rules[0].condition.urlFilter).toBe('shorts');
    expect(rules[0].condition.isUrlFilterCaseSensitive).toBe(false);
  });

  it('escapes special characters in keywords', () => {
    const rules = buildRedirectRules([{ pattern: 'a*b', kind: 'keyword' }]);
    expect(rules[0].condition.urlFilter).toBe('a|*b');
  });

  it('returns empty array for no patterns', () => {
    expect(buildRedirectRules([])).toEqual([]);
  });

  it('assigns sequential ids starting at 1', () => {
    const patterns: BlockPattern[] = [
      { pattern: 'a.com', kind: 'site' },
      { pattern: 'b.com', kind: 'site' },
      { pattern: 'c.com', kind: 'site' },
    ];
    const rules = buildRedirectRules(patterns);
    expect(rules.map((r) => r.id)).toEqual([1, 2, 3]);
  });
});
