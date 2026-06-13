/** Last blocked destination per tab before DNR redirect (no query param on blocked page). */
const pendingByTab = new Map<number, string>();

export function setPendingBlockUrl(tabId: number, url: string): void {
  pendingByTab.set(tabId, url);
}

export function peekPendingBlockUrl(tabId: number): string | null {
  return pendingByTab.get(tabId) ?? null;
}

export function takePendingBlockUrl(tabId: number): string | null {
  const url = pendingByTab.get(tabId) ?? null;
  pendingByTab.delete(tabId);
  return url;
}

export function clearPendingBlockUrl(tabId: number): void {
  pendingByTab.delete(tabId);
}
