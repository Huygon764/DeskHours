import type { BlockEntry } from './types';

/** Plain copy for chrome.storage — do not pass Svelte $state proxies to setValue. */
export function cloneBlocklist(entries: BlockEntry[]): BlockEntry[] {
  return entries.map((e) => ({
    id: e.id,
    domain: e.domain,
    masked: e.masked,
    enabled: e.enabled !== false,
  }));
}

/** Ensure legacy entries without `enabled` default to active. */
export function normalizeEntry(entry: BlockEntry): BlockEntry {
  return { ...entry, enabled: entry.enabled !== false };
}

/** True when the pattern targets a URL path rather than a whole host. */
export function isPathPattern(pattern: string): boolean {
  return pattern.includes('/') || pattern.includes('*');
}

/** Normalize user input to a domain or path pattern. */
export function normalizePattern(raw: string): string {
  let s = raw.trim().replace(/^https?:\/\//, '').replace(/^www\./, '');
  s = s.replace(/\/+$/, '');
  return s;
}

/** @deprecated Use normalizePattern — kept for callers that only accept domains. */
export function normalizeDomain(raw: string): string {
  return normalizePattern(raw).split('/')[0];
}

/** Hostname from a URL, without www. */
export function hostFromUrl(url: string): string {
  return new URL(url).hostname.replace(/^www\./, '');
}

/** Domain-only pattern for the current tab, e.g. "youtube.com". */
export function domainPatternFromUrl(url: string): string {
  return hostFromUrl(url);
}

/** Path wildcard pattern from the current tab, e.g. "youtube.com/shorts/*". */
export function pathPatternFromUrl(url: string): string | null {
  try {
    const u = new URL(url);
    const segments = u.pathname.split('/').filter(Boolean);
    if (segments.length === 0) return null;
    const host = u.hostname.replace(/^www\./, '');
    return `${host}/${segments[0]}/*`;
  } catch {
    return null;
  }
}

/** True if a non-masked entry already uses this exact pattern. */
export function hasPlainPattern(entries: BlockEntry[], pattern: string): boolean {
  return entries.some((e) => !e.masked && e.domain === pattern);
}

/** @deprecated Use hasPlainPattern. */
export function hasPlainDomain(entries: BlockEntry[], domain: string): boolean {
  return hasPlainPattern(entries, domain);
}

/** Convert a stored pattern to a DNR urlFilter (path patterns only). */
export function patternToUrlFilter(pattern: string): string {
  const slash = pattern.indexOf('/');
  if (slash === -1) throw new Error('host-only patterns use requestDomains');
  const host = pattern.slice(0, slash).replace(/^www\./, '');
  const path = pattern.slice(slash + 1);
  return `*://*.${host}/${path}`;
}
