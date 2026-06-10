import {
  hostToUrlFilter,
  isPathPattern,
  keywordToUrlFilter,
  patternToUrlFilter,
  type BlockPattern,
} from './blocklist';

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

/** Build sequential redirect rules (ids 1..N) for site, path, and keyword patterns. */
export function buildRedirectRules(patterns: BlockPattern[]): RedirectRule[] {
  return patterns.map((item, i) => {
    const base = {
      id: i + 1,
      priority: 1,
      action: { type: 'redirect' as const, redirect: { extensionPath: BLOCKED_PAGE_PATH } },
      condition: { resourceTypes: ['main_frame'] as ['main_frame'] },
    };

    if (item.kind === 'keyword') {
      return {
        ...base,
        condition: {
          ...base.condition,
          urlFilter: keywordToUrlFilter(item.pattern),
          isUrlFilterCaseSensitive: false,
        },
      };
    }

    if (isPathPattern(item.pattern)) {
      return {
        ...base,
        condition: {
          ...base.condition,
          urlFilter: patternToUrlFilter(item.pattern),
          isUrlFilterCaseSensitive: false,
        },
      };
    }

    return {
      ...base,
      condition: {
        ...base.condition,
        urlFilter: hostToUrlFilter(item.pattern),
        isUrlFilterCaseSensitive: false,
      },
    };
  });
}
