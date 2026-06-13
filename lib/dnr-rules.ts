import {
  hostToRegexFilter,
  isPathPattern,
  keywordToRegexFilter,
  patternToRegexFilter,
  type BlockPattern,
} from './blocklist';

/** A DNR dynamic rule that redirects navigation to the extension blocked page. */
export interface RedirectRule {
  id: number;
  priority: number;
  action: { type: 'redirect'; redirect: { regexSubstitution: string } };
  condition: {
    regexFilter: string;
    isUrlFilterCaseSensitive?: boolean;
    resourceTypes: ['main_frame'];
  };
}

export const BLOCKED_PAGE_PATH = '/blocked.html';

/** Must match `BLOCKED_URL_PARAM` in keyword-navigation.ts. */
const BLOCKED_URL_QUERY_KEY = 'url';

/** Build sequential redirect rules (ids 1..N) for site, path, and keyword patterns. */
export function buildRedirectRules(patterns: BlockPattern[], blockedPageBase: string): RedirectRule[] {
  const redirectSubstitution = `${blockedPageBase}?${BLOCKED_URL_QUERY_KEY}=\\0`;

  return patterns.map((item, i) => {
    const isKeyword = item.kind === 'keyword';
    const regexFilter = isKeyword
      ? keywordToRegexFilter(item.pattern)
      : isPathPattern(item.pattern)
        ? patternToRegexFilter(item.pattern)
        : hostToRegexFilter(item.pattern);

    return {
      id: i + 1,
      priority: 1,
      action: { type: 'redirect' as const, redirect: { regexSubstitution: redirectSubstitution } },
      condition: {
        regexFilter,
        resourceTypes: ['main_frame'] as ['main_frame'],
        // Keyword matches are case-insensitive; host/path filters are already lowercased.
        ...(isKeyword && { isUrlFilterCaseSensitive: false }),
      },
    };
  });
}
