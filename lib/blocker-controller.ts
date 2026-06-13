import { blocklistItem, pomodoroItem, scheduleItem, tempUnblocksItem, unmaskedDomainsItem } from './storage';
import { isSiteBlockingEnabled } from './schedule';
import { BLOCKED_PAGE_PATH, buildRedirectRules } from './dnr-rules';
import { entryToBlockPattern, normalizeEntry, type BlockPattern } from './blocklist';
import { isEncryptedMaskedDomain } from './masking';
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

/** Active block patterns when blocking is enabled, minus temp unblocks. */
export async function getActiveBlockPatterns(now = Date.now()): Promise<BlockPattern[]> {
  const liveUnblocks = await pruneExpired();
  const [schedule, pomodoro] = await Promise.all([scheduleItem.getValue(), pomodoroItem.getValue()]);
  if (!isSiteBlockingEnabled(schedule, now, pomodoro)) return [];

  const blocklist = (await blocklistItem.getValue()).map(normalizeEntry);
  const patterns = await collectActivePatterns(blocklist);
  return patterns.filter((p) => !liveUnblocks.has(p.pattern));
}

async function collectActivePatterns(blocklist: BlockEntry[]): Promise<BlockPattern[]> {
  const unmasked = await unmaskedDomainsItem.getValue();
  const patterns: BlockPattern[] = [];

  for (const e of blocklist) {
    if (e.enabled === false) continue;
    if (!e.masked) {
      patterns.push(entryToBlockPattern(e));
      continue;
    }
    if (!isEncryptedMaskedDomain(e.domain)) {
      patterns.push(entryToBlockPattern(e));
    }
  }

  for (const p of unmasked) {
    if (!patterns.some((x) => x.pattern === p && x.kind === 'site')) {
      patterns.push({ pattern: p, kind: 'site' });
    }
  }

  return patterns;
}

/** Recompute DNR rules from blocklist, schedule, focus state, and temp unblocks. */
let syncQueue: Promise<void> = Promise.resolve();

export async function syncBlocker(): Promise<void> {
  const run = syncQueue.then(() => syncBlockerInner());
  syncQueue = run.catch(() => undefined);
  return run;
}

async function syncBlockerInner(): Promise<void> {
  await pruneExpired();
  const patterns = await getActiveBlockPatterns();

  const blockedPageBase = browser.runtime.getURL(BLOCKED_PAGE_PATH);
  const addRules = buildRedirectRules(patterns, blockedPageBase);
  const existing = await browser.declarativeNetRequest.getDynamicRules();
  try {
    await browser.declarativeNetRequest.updateDynamicRules({
      removeRuleIds: existing.map((r) => r.id),
      addRules: addRules as Browser.declarativeNetRequest.Rule[],
    });
  } catch (err) {
    console.error('[deskhours] DNR update failed:', err, addRules);
    throw err;
  }
  console.info(
    '[deskhours] DNR sync:',
    patterns.length,
    'rule(s)',
    patterns.map((p) => (p.kind === 'keyword' ? `kw:${p.pattern}` : p.pattern)),
  );
}

/** Temporarily allow one pattern, then resync DNR rules. */
export async function grantUnblock(pattern: string, minutes: number): Promise<void> {
  const list = await tempUnblocksItem.getValue();
  const expiresAt = Date.now() + Math.max(1, minutes || 5) * 60_000;
  const normalized = list
    .map((u) => ({ pattern: tempUnblockPattern(u), expiresAt: u.expiresAt }))
    .filter((u) => u.pattern !== pattern);
  normalized.push({ pattern, expiresAt });
  await tempUnblocksItem.setValue(normalized);
  try {
    await syncBlocker();
  } catch (err) {
    await tempUnblocksItem.setValue(list);
    throw err;
  }
}
