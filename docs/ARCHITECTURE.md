# DeskHours Architecture

Current layout and ownership as implemented. Product behavior lives in
`docs/product/`. Lasting choices live in `docs/decisions/`.

The 2026-06-07 superpowers spec in git history is stale. Do not treat it as
operating authority.

## Surfaces

| Surface | Path | Role |
| --- | --- | --- |
| Service worker | `entrypoints/background.ts` | Alarms, DNR sync, tab guard, message router, alarm badge |
| Popup | `entrypoints/popup/` | Block / focus / timer tabs, current-page actions, alarms |
| Options | `entrypoints/options/` | Schedule, blocklist, focus+timer, password, backup, theme, locale |
| Blocked page | `entrypoints/blocked/` | Interception UI and password-granted temp unblock |
| Offscreen | `entrypoints/offscreen/` | Packaged alert-sound playback (MV3 workers cannot play audio) |
| Shared UI | `components/` | Logo, toggle |
| Logic | `lib/` | Pure modules plus Chrome-API controllers |
| i18n | `public/_locales/{en,vi}/` | Message catalogs; default locale `en` |

## Subsystems

Blocking and the focus timer share `chrome.storage` and the service worker.
They are not independent: a pomodoro **work** phase enforces the blocklist even
outside a schedule window. Rest and idle do not. The countdown timer and
wall-clock alarms do not change block state.

Enforcement is dual:

1. `declarativeNetRequest` dynamic rules redirect matching `main_frame`
   navigations to `blocked.html`.
2. Tab / `webNavigation` guards catch cases DNR misses (SPA, back/forward).

Timing uses `chrome.alarms`, not in-memory timers, so it survives service-worker
eviction.

## State

WXT `storage.defineItem` keys (see `lib/storage.ts`):

| Key | Area | Notes |
| --- | --- | --- |
| `local:blocklist` | blocking | Site/path/keyword entries; masked ciphertext in `domain` |
| `local:schedule` | blocking | Weekly windows; default office-hours preset |
| `local:tempUnblocks` | blocking | Password-granted timed exceptions; not backed up |
| `local:unblockTimestamps` | blocking | Today's successful grants; drives wait escalation |
| `local:unblockMinutes` | blocking | Temp-unblock duration; default 5 |
| `local:auth` | security | PBKDF2 verifier only; password never stored |
| `session:unmaskedDomains` | security | Plaintext masked sites for this browser session |
| `local:pomodoro` | focus | Phase + durations; work phase enables blocking |
| `local:countdownTimer` | timer | Independent countdown; does not block |
| `local:alarms` | alarms | Once/weekly reminders |
| `local:ringingAlarms` | alarms | Transient badge/banner state; not backed up |
| `local:theme` | UI | `system` / `light` / `dark` |
| `local:locale` | UI | `system` / `en` / `vi` |
| `local:optionsTab` | UI | Last-open options tab |

## Update path

Blocker resync (`syncBlocker`) rebuilds DNR rules from schedule, pomodoro work
phase, enabled blocklist entries, session unmask list, and live temp unblocks.
It runs on worker start, a 1-minute scheduler alarm, and after storage/UI
mutations that call `SYNC_BLOCKER`.

## Validation owner

- Unit tests: `bun run test` (Vitest via `vitest.config.ts`; not `bun test`).
- Typecheck: `bun run compile`.
- Extension DNR, alarms, notifications, and offscreen audio have no automated
  E2E in-repo; README documents manual load of `.output/chrome-mv3`.
- No CI workflows are checked in.
