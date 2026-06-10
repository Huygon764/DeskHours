import { isPathPattern } from './blocklist';
import type { BlockEntryKind } from './types';
import type { BlockPattern } from './blocklist';

/** True if `url` is matched by `pattern` for the given entry kind. */
export function urlMatchesPattern(
  url: string,
  pattern: string,
  kind: BlockEntryKind = 'site',
): boolean {
  if (kind === 'keyword') {
    return url.toLowerCase().includes(pattern.toLowerCase());
  }

  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, '');
    const barePatternHost = pattern.split('/')[0].replace(/^www\./, '');

    if (!isPathPattern(pattern)) {
      return host === barePatternHost;
    }

    if (host !== barePatternHost) return false;

    const slash = pattern.indexOf('/');
    let pathPart = pattern.slice(slash + 1);
    if (pathPart.endsWith('/*')) {
      pathPart = pathPart.slice(0, -2);
    }
    const prefix = `/${pathPart}`;
    return u.pathname === prefix || u.pathname.startsWith(`${prefix}/`);
  } catch {
    return false;
  }
}

/** Most specific matching pattern for `url`, preferring longer patterns. */
export function findMatchingPattern(url: string, patterns: BlockPattern[]): string | null {
  const matches = patterns.filter((p) => urlMatchesPattern(url, p.pattern, p.kind));
  if (matches.length === 0) return null;
  matches.sort((a, b) => b.pattern.length - a.pattern.length);
  return matches[0].pattern;
}

/** Whether a blocklist entry corresponds to a matched pattern string. */
export function entryMatchesPattern(
  entry: { domain: string; kind?: BlockEntryKind; masked: boolean },
  matched: string,
  revealedDomain = entry.domain,
): boolean {
  if ((entry.kind ?? 'site') === 'keyword') {
    return revealedDomain.toLowerCase() === matched.toLowerCase();
  }
  return revealedDomain === matched;
}
