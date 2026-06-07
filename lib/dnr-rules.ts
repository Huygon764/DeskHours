/** A DNR dynamic rule that redirects a domain's top-level navigation to the
 *  extension's blocked page. Typed loosely to avoid depending on chrome types. */
export interface RedirectRule {
  id: number;
  priority: number;
  action: { type: 'redirect'; redirect: { extensionPath: string } };
  condition: { requestDomains: string[]; resourceTypes: ['main_frame'] };
}

export const BLOCKED_PAGE_PATH = '/blocked.html';

/** Build sequential redirect rules (ids 1..N) for the given effective
 *  block domains. Caller is responsible for passing the already-filtered list
 *  (schedule active, temp-unblocks removed). */
export function buildRedirectRules(domains: string[]): RedirectRule[] {
  return domains.map((domain, i) => ({
    id: i + 1,
    priority: 1,
    action: { type: 'redirect', redirect: { extensionPath: BLOCKED_PAGE_PATH } },
    condition: { requestDomains: [domain], resourceTypes: ['main_frame'] },
  }));
}
