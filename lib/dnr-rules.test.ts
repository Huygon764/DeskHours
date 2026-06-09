import { describe, it, expect } from 'vitest';
import { buildRedirectRules } from './dnr-rules';

describe('buildRedirectRules', () => {
  it('builds one main_frame redirect rule per domain', () => {
    const rules = buildRedirectRules(['facebook.com', 'youtube.com']);
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
    const rules = buildRedirectRules(['youtube.com/shorts/*']);
    expect(rules).toHaveLength(1);
    expect(rules[0].condition.urlFilter).toBe('*://*.youtube.com/shorts/*');
    expect(rules[0].condition.isUrlFilterCaseSensitive).toBe(false);
    expect(rules[0].condition.requestDomains).toBeUndefined();
  });

  it('returns empty array for no domains', () => {
    expect(buildRedirectRules([])).toEqual([]);
  });

  it('assigns sequential ids starting at 1', () => {
    const rules = buildRedirectRules(['a.com', 'b.com', 'c.com']);
    expect(rules.map((r) => r.id)).toEqual([1, 2, 3]);
  });
});
