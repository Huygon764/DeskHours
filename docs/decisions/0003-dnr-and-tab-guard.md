# 0003 DNR Plus Tab Guard

Date: 2026-09-17

## Status

Accepted

## Context

`declarativeNetRequest` does not see every client-side navigation. Keyword and
path blocking still need a blocked-page URL for the unblock flow.

## Decision

Primary enforcement: DNR dynamic redirects of `main_frame` to `blocked.html`.
Secondary: tab and `webNavigation` guards redirect leftover http(s) tabs.
Capture the pre-redirect URL per tab so the blocked page can show and unblock
the right pattern.

## Alternatives Considered

1. DNR only.
2. `webRequest` blocking (heavier review, MV3 limits).

## Consequences

Positive:

- SPA / bfcache navigations still hit the blocked page.

Tradeoffs:

- Two paths must stay consistent with `getActiveBlockPatterns`.

## Follow-Up

- None.
