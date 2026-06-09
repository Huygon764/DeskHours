import { blocklistItem, scheduleItem, tempUnblocksItem, unmaskedDomainsItem } from './storage';
import { isBlockingActive } from './schedule';
import { buildRedirectRules } from './dnr-rules';
import { normalizeEntry } from './blocklist';
import { revealEntry } from './masking';
import type { BlockEntry } from './types';

/** Legacy temp-unblock records used `domain` instead of `pattern`. */
function tempUnblockPattern(entry: { pattern?: string; domain?: string }): string {
  return entry.pattern ?? entry.domain ?? '';
}

/** Drop expired temp unblocks, persisting the pruned list. Returns live pattern set. */
export async function pruneExpired(): Promise<Set<string>> {
  const now = Date.now();
  const all = await tempUnblocksItem.getValue();
  const live = all.filter((u) => u.expiresAt > now);
  if (live.length !== all.length) {
    await tempUnblocksItem.setValue(live.map((u) => ({ pattern: tempUnblockPattern(u), expiresAt: u.expiresAt })));
  }
  return new Set(live.map((u) => tempUnblockPattern(u)));
}

async function collectActivePatterns(blocklist: BlockEntry[]): Promise<string[]> {
  const unmasked = await unmaskedDomainsItem.getValue();
  const patterns: string[] = [];

  for (const e of blocklist) {
    if (e.enabled === false) continue;
    if (!e.masked) patterns.push(e.domain);
  }

  for (const p of unmasked) {
    if (!patterns.includes(p)) patterns.push(p);
  }

  return patterns;
}

/** Plaintext patterns for masked entries when a crypto key is available. */
export async function revealedPatterns(entries: BlockEntry[], key: CryptoKey): Promise<string[]> {
  const patterns: string[] = [];
  for (const e of entries) {
    if (e.masked) patterns.push(await revealEntry(e, key));
  }
  return patterns;
}

/** Recompute DNR rules from blocklist, schedule, and temp unblocks. */
export async function syncBlocker(): Promise<void> {
  const now = Date.now();
  const liveUnblocks = await pruneExpired();
  const schedule = await scheduleItem.getValue();

  let patterns: string[] = [];
  if (isBlockingActive(schedule, now)) {
    const blocklist = (await blocklistItem.getValue()).map(normalizeEntry);
    patterns = await collectActivePatterns(blocklist);
    patterns = patterns.filter((p) => !liveUnblocks.has(p));
  }

  const addRules = buildRedirectRules(patterns);
  const existing = await browser.declarativeNetRequest.getDynamicRules();
  await browser.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: existing.map((r) => r.id),
    addRules: addRules as Browser.declarativeNetRequest.Rule[],
  });
  console.info('[site-blocker] DNR sync:', patterns.length, 'rule(s)', patterns);
}

/** Temporarily allow one pattern, then resync DNR rules. */
export async function grantUnblock(pattern: string, minutes: number): Promise<void> {
  const list = await tempUnblocksItem.getValue();
  const expiresAt = Date.now() + minutes * 60_000;
  const normalized = list
    .map((u) => ({ pattern: tempUnblockPattern(u), expiresAt: u.expiresAt }))
    .filter((u) => u.pattern !== pattern);
  normalized.push({ pattern, expiresAt });
  await tempUnblocksItem.setValue(normalized);
  await syncBlocker();
}
