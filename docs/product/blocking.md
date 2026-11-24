# Blocking

Current behavior from `lib/schedule.ts`, `lib/blocklist.ts`, `lib/dnr-rules.ts`,
`lib/blocker-controller.ts`, `lib/keyword-navigation.ts`, `lib/unblock-wait.ts`.

## When blocking is on

`isSiteBlockingEnabled` is true when **either**:

- the current local time falls in a schedule window, or
- pomodoro `phase === 'work'` (including paused work).

Rest and idle do not enable blocking by themselves.

Windows: start inclusive, end exclusive. `23:59` / `24:00` mean end-of-day so
all-day windows have no last-minute gap. If `end <= start` and the window is
not zero-length, it wraps midnight; the post-midnight tail belongs to the
previous day's window.

Default schedule is the `office-hours` preset: Mon–Fri `08:00–12:00` and
`13:30–17:00` (`lib/schedule.ts`).

## What gets blocked

Each `BlockEntry` is `site` (default) or `keyword`. `enabled === false` stays
in the list but is not enforced. Legacy entries without `enabled` are treated
as enabled.

Site patterns: host or path. User input is normalized (strip `https://`, `www.`,
adblock `||…^`, hosts-file `0.0.0.0` / `127.0.0.1`). Path patterns contain `/`
plus a path or `*`.

Keyword patterns match URL text (DNR regex, case-insensitive, ASCII, max 200
chars).

Masked ciphertext entries are **not** enforced until their plaintext is in
`session:unmaskedDomains` (or a legacy unencrypted masked value). After backup
import, hidden entries stay unenforced until the user unlocks again.

## Enforcement

Active patterns minus live temp unblocks become DNR dynamic redirect rules to
`blocked.html?url=<original>` (`main_frame` only). Rule ids are `1..N` rebuilt
on every sync.

A 500ms in-memory pattern cache accelerates tab-guard checks; `syncBlocker`
invalidates it. DNR remains the primary enforcement.

Tab `onUpdated` / `onActivated` and `webNavigation.onBeforeNavigate` redirect
http(s) tabs that still match, covering SPA and similar DNR misses. Pending
URLs are stored per tab for the blocked page.

Scheduler alarm `blocker-scheduler` runs every 1 minute and resyncs.

## Temp unblock

Blocked page: confirm → wait → password → grant. Wait starts at 30s and
doubles per successful grant **today** (local calendar), cap 300s, reset at
local midnight. Refreshing the blocked page does not shorten the wait already
resolved on load.

Grant writes `local:tempUnblocks` for that **pattern** (not the page URL) for
`local:unblockMinutes` minutes (default 5, minimum 1). If DNR sync fails, the
temp-unblock write is rolled back. A successful grant appends to
`local:unblockTimestamps`.

## Options lock

While blocking is on and the options page is not unlocked, schedule edits and
blocklist pause/remove are password-gated (`entrypoints/options/App.svelte`).
Adding a site or keyword is not gated, in options or the popup: it only
tightens the list.
