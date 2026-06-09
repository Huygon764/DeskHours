import { isPathPattern } from './blocklist';

/** True if `url` is matched by `pattern` (domain or path wildcard). */
export function urlMatchesPattern(url: string, pattern: string): boolean {
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

/** Most specific matching pattern for `url`, preferring longer (more specific) patterns. */
export function findMatchingPattern(url: string, patterns: string[]): string | null {
  const matches = patterns.filter((p) => urlMatchesPattern(url, p));
  if (matches.length === 0) return null;
  matches.sort((a, b) => b.length - a.length);
  return matches[0];
}
