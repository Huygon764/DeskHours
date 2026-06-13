import { describe, it, expect } from 'vitest';
import { buildRedirectRules } from './dnr-rules';
import type { BlockPattern } from './blocklist';

const BLOCKED_BASE = 'chrome-extension://test-id/blocked.html';

describe('buildRedirectRules', () => {
  it('builds one main_frame redirect rule per domain', () => {
    const patterns: BlockPattern[] = [
      { pattern: 'facebook.com', kind: 'site' },
      { pattern: 'youtube.com', kind: 'site' },
    ];
    const rules = buildRedirectRules(patterns, BLOCKED_BASE);
    expect(rules).toHaveLength(2);
    expect(rules[0]).toEqual({
      id: 1,
      priority: 1,
      action: {
        type: 'redirect',
        redirect: { regexSubstitution: `${BLOCKED_BASE}?url=\\0` },
      },
      condition: {
        regexFilter: '^https?://([^/]*\\.)?facebook\\.com(/.*)?$',
        resourceTypes: ['main_frame'],
      },
    });
    expect(rules[1].id).toBe(2);
    expect(rules[1].condition.regexFilter).toBe('^https?://([^/]*\\.)?youtube\\.com(/.*)?$');
  });

  it('builds regex rules for path patterns', () => {
    const rules = buildRedirectRules([{ pattern: 'youtube.com/shorts/*', kind: 'site' }], BLOCKED_BASE);
    expect(rules).toHaveLength(1);
    expect(rules[0].condition.regexFilter).toBe('^https?://([^/]*\\.)?youtube\\.com/shorts(/.*)?$');
  });

  it('builds regex rules for URL keywords', () => {
    const rules = buildRedirectRules([{ pattern: 'shorts', kind: 'keyword' }], BLOCKED_BASE);
    expect(rules).toHaveLength(1);
    expect(rules[0].condition.regexFilter).toBe('^.*shorts.*$');
    expect(rules[0].condition.isUrlFilterCaseSensitive).toBe(false);
  });

  it('escapes special characters in keywords', () => {
    const rules = buildRedirectRules([{ pattern: 'a*b', kind: 'keyword' }], BLOCKED_BASE);
    expect(rules[0].condition.regexFilter).toBe('^.*a\\*b.*$');
  });

  it('returns empty array for no patterns', () => {
    expect(buildRedirectRules([], BLOCKED_BASE)).toEqual([]);
  });

  it('assigns sequential ids starting at 1', () => {
    const patterns: BlockPattern[] = [
      { pattern: 'a.com', kind: 'site' },
      { pattern: 'b.com', kind: 'site' },
      { pattern: 'c.com', kind: 'site' },
    ];
    const rules = buildRedirectRules(patterns, BLOCKED_BASE);
    expect(rules.map((r) => r.id)).toEqual([1, 2, 3]);
  });
});
