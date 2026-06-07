import { blocklistItem, scheduleItem, tempUnblocksItem, unmaskedDomainsItem } from './storage';
import { isBlockingActive } from './schedule';
import { buildRedirectRules } from './dnr-rules';

/** Drop expired temp unblocks, persisting the pruned list. Returns the live set of domains. */
export async function pruneExpired(): Promise<Set<string>> {
  const now = Date.now();
  const all = await tempUnblocksItem.getValue();
  const live = all.filter((u) => u.expiresAt > now);
  if (live.length !== all.length) await tempUnblocksItem.setValue(live);
  return new Set(live.map((u) => u.domain));
}

/** Recompute the effective block list and replace all dynamic rules. */
export async function syncBlocker(): Promise<void> {
  const now = Date.now();
  const liveUnblocks = await pruneExpired();
  const schedule = await scheduleItem.getValue();

  let domains: string[] = [];
  if (isBlockingActive(schedule, now)) {
    const blocklist = await blocklistItem.getValue();
    const unmasked = await unmaskedDomainsItem.getValue();
    domains = blocklist
      .filter((e) => !e.masked)
      .map((e) => e.domain)
      .concat(unmasked)
      .filter((d) => !liveUnblocks.has(d));
  }

  const addRules = buildRedirectRules(domains);
  const existing = await browser.declarativeNetRequest.getDynamicRules();
  await browser.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: existing.map((r) => r.id),
    addRules: addRules as Browser.declarativeNetRequest.Rule[],
  });
  console.info('[site-blocker] DNR sync:', domains.length, 'rule(s)', domains);
}

/** Add a temp unblock for `domain` lasting `minutes`, then resync. */
export async function grantUnblock(domain: string, minutes: number): Promise<void> {
  const list = await tempUnblocksItem.getValue();
  const expiresAt = Date.now() + minutes * 60_000;
  const next = [...list.filter((u) => u.domain !== domain), { domain, expiresAt }];
  await tempUnblocksItem.setValue(next);
  await syncBlocker();
}
