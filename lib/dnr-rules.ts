import { isPathPattern, patternToUrlFilter } from './blocklist';

/** A DNR dynamic rule that redirects navigation to the extension blocked page. */
export interface RedirectRule {
  id: number;
  priority: number;
  action: { type: 'redirect'; redirect: { extensionPath: string } };
  condition: {
    requestDomains?: string[];
    urlFilter?: string;
    isUrlFilterCaseSensitive?: boolean;
    resourceTypes: ['main_frame'];
  };
}

export const BLOCKED_PAGE_PATH = '/blocked.html';

/** Build sequential redirect rules (ids 1..N) for path or domain patterns. */
export function buildRedirectRules(patterns: string[]): RedirectRule[] {
  return patterns.map((pattern, i) => {
    const base = {
      id: i + 1,
      priority: 1,
      action: { type: 'redirect' as const, redirect: { extensionPath: BLOCKED_PAGE_PATH } },
      condition: { resourceTypes: ['main_frame'] as ['main_frame'] },
    };

    if (isPathPattern(pattern)) {
      return {
        ...base,
        condition: {
          ...base.condition,
          urlFilter: patternToUrlFilter(pattern),
          isUrlFilterCaseSensitive: false,
        },
      };
    }

    return {
      ...base,
      condition: {
        ...base.condition,
        requestDomains: [pattern.replace(/^www\./, '')],
      },
    };
  });
}
