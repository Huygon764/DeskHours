import { getActiveBlockPatterns } from './blocker-controller';
import { findMatchingPattern } from './pattern-match';
import { setPendingBlockUrl } from './pending-block-url';
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

/** Active block pattern matching `url`, or null when blocking is off or unblocked. */
export async function matchingBlockedPattern(url: string): Promise<string | null> {
  const patterns = await getActiveBlockPatterns();
  return findMatchingPattern(url, patterns);
}

async function tabUrl(tabId: number, url?: string): Promise<string | null> {
  if (url) return url;
  try {
    const tab = await browser.tabs.get(tabId);
    return tab.url ?? null;
  } catch {
    return null;
  }
}

/** Store the last http(s) navigation target before DNR redirect (sync — no async race). */
export function rememberNavigationTarget(tabId: number, url: string): void {
  if (!isInspectableWebUrl(url) || isExtensionBlockedPage(url)) return;
  setPendingBlockUrl(tabId, url);
}

/** Redirect tabs DNR misses (SPA navigations, back/forward cache, etc.). */
export async function maybeRedirectBlockedTab(tabId: number, url?: string): Promise<void> {
  const resolved = await tabUrl(tabId, url);
  if (!resolved || !isInspectableWebUrl(resolved) || isExtensionBlockedPage(resolved)) return;

  const matched = await matchingBlockedPattern(resolved);
  if (!matched) return;

  try {
    setPendingBlockUrl(tabId, resolved);
    await browser.tabs.update(tabId, { url: blockedPageUrlFor(resolved) });
  } catch (err) {
    console.error('[deskhours] tab redirect failed:', err);
  }
}
