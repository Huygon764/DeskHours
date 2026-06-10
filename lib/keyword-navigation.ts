import { blocklistItem, scheduleItem } from './storage';
import { isBlockingActive } from './schedule';
import { pruneExpired } from './blocker-controller';
import { entryToBlockPattern, normalizeEntry } from './blocklist';
import { findMatchingPattern } from './pattern-match';
import { BLOCKED_PAGE_PATH } from './dnr-rules';

export const BLOCKED_URL_PARAM = 'url';

export function blockedPageUrlFor(targetUrl: string): string {
  const page = browser.runtime.getURL(BLOCKED_PAGE_PATH);
  return `${page}?${BLOCKED_URL_PARAM}=${encodeURIComponent(targetUrl)}`;
}

function isInspectableWebUrl(url: string): boolean {
  return url.startsWith('http://') || url.startsWith('https://');
}

function isExtensionBlockedPage(url: string): boolean {
  return url.includes(BLOCKED_PAGE_PATH);
}

/** Active keyword pattern matching `url`, or null when blocking is off or unblocked. */
export async function matchingKeyword(url: string): Promise<string | null> {
  const now = Date.now();
  const liveUnblocks = await pruneExpired();
  const schedule = await scheduleItem.getValue();
  if (!isBlockingActive(schedule, now)) return null;

  const blocklist = (await blocklistItem.getValue()).map(normalizeEntry);
  const keywords = blocklist
    .filter((e) => e.enabled !== false && !e.masked && e.kind === 'keyword')
    .map(entryToBlockPattern)
    .filter((k) => !liveUnblocks.has(k.pattern));

  return findMatchingPattern(url, keywords);
}

/** Redirect SPA navigations that DNR does not intercept (e.g. YouTube Shorts). */
export async function maybeRedirectKeywordTab(tabId: number, url: string | undefined): Promise<void> {
  if (!url || !isInspectableWebUrl(url) || isExtensionBlockedPage(url)) return;

  const matched = await matchingKeyword(url);
  if (!matched) return;

  try {
    await browser.tabs.update(tabId, { url: blockedPageUrlFor(url) });
  } catch (err) {
    console.error('[site-blocker] keyword tab redirect failed:', err);
  }
}
