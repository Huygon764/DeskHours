import type { BlockEntry, BlockEntryKind } from './types';
import { isEncryptedMaskedDomain } from './masking';

export interface BlockPattern {
  pattern: string;
  kind: BlockEntryKind;
}

const MAX_KEYWORD_LENGTH = 200;

/** Plain copy for chrome.storage — do not pass Svelte $state proxies to setValue. */
export function cloneBlocklist(entries: BlockEntry[]): BlockEntry[] {
  return entries.map((e) => ({
    id: e.id,
    domain: e.domain,
    masked: e.masked,
    kind: e.kind ?? 'site',
    enabled: e.enabled !== false,
  }));
}

/** Ensure legacy entries without `enabled` default to active. */
export function normalizeEntry(entry: BlockEntry): BlockEntry {
  const kind = entry.kind ?? 'site';
  let domain = entry.domain;
  if (kind === 'site' && !isEncryptedMaskedDomain(domain)) {
    domain = normalizePattern(domain);
  }
  return { ...entry, domain, enabled: entry.enabled !== false, kind };
}

export function entryToBlockPattern(entry: BlockEntry): BlockPattern {
  return { pattern: entry.domain, kind: entry.kind ?? 'site' };
}

/** Normalize a URL keyword for storage and matching (DNR filters must be ASCII). */
export function normalizeKeyword(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return '';
  const ascii = trimmed.replace(/[^\x20-\x7E]/g, '');
  if (!ascii) return '';
  return ascii.length > MAX_KEYWORD_LENGTH ? ascii.slice(0, MAX_KEYWORD_LENGTH) : ascii;
}

/** Escape DNR urlFilter specials: * | ^ (prefix with |). */
export function escapeUrlFilterLiteral(value: string): string {
  return value.replace(/[*|^]/g, (c) => `|${c}`);
}

/** DNR urlFilter substring match for URLs containing `keyword`. */
export function keywordToUrlFilter(keyword: string): string {
  const escaped = escapeUrlFilterLiteral(keyword);
  if (!escaped) throw new Error('keyword urlFilter must not be empty');
  return escaped;
}

/** True when the pattern targets a URL path rather than a whole host. */
export function isPathPattern(pattern: string): boolean {
  if (pattern.includes('*')) return true;
  const slash = pattern.indexOf('/');
  if (slash === -1) return false;
  const path = pattern.slice(slash + 1).replace(/\/+$/, '');
  return path.length > 0;
}

/** Normalize user input to a domain or path pattern. */
export function normalizePattern(raw: string): string {
  let s = raw.trim();

  // Adblock Plus: ||example.com^ or ||example.com/path^
  if (s.startsWith('||')) {
    s = s.slice(2);
    if (s.endsWith('^')) s = s.slice(0, -1);
  }

  // Hosts file: 0.0.0.0 example.com
  const hostsMatch = s.match(/^(?:0\.0\.0\.0|127\.0\.0\.1)\s+(\S+)/);
  if (hostsMatch) s = hostsMatch[1];

  s = s.replace(/^https?:\/\//, '').replace(/^www\./, '');
  s = s.replace(/\/+$/, '');

  const slash = s.indexOf('/');
  if (slash === -1) return s.toLowerCase();
  return s.slice(0, slash).toLowerCase() + s.slice(slash);
}

/** DNR urlFilter for a host-only pattern (domain + subdomains, all paths). */
export function hostToUrlFilter(host: string): string {
  const h = host.replace(/^www\./, '').toLowerCase();
  return `||${escapeUrlFilterLiteral(h)}/`;
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

/** True if a non-masked site entry already uses this exact pattern. */
export function hasPlainPattern(entries: BlockEntry[], pattern: string): boolean {
  return entries.some((e) => !e.masked && (e.kind ?? 'site') === 'site' && e.domain === pattern);
}

/** True if a keyword entry already exists (case-insensitive). */
export function hasKeywordPattern(entries: BlockEntry[], keyword: string): boolean {
  const lower = keyword.toLowerCase();
  return entries.some(
    (e) => !e.masked && e.kind === 'keyword' && e.domain.toLowerCase() === lower,
  );
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
