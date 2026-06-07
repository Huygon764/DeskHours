# Site Blocker Extension - Design

Date: 2026-06-07
Status: Approved (pending spec review)

## Goal

A Chrome extension for personal use that blocks distracting sites on a fixed
schedule, with a password-protected unblock flow, a hideable ("masked")
blocklist, and an independent Pomodoro timer with session-change alarms.

Personal use first, but keep the door open to publishing on the Chrome Web
Store later: stay within MV3 best practices, avoid store-policy-violating
patterns, and leave room for an icon set and privacy policy.

## Threat model

This is self-binding, not adversarial security. Any extension can be bypassed
by uninstalling it or disabling developer mode; we do not try to prevent that.
The password adds enough friction to stop an impulsive "just open Facebook for
a second" — the "moderately strict" level the user chose:

- Unblock requires confirm + a 30s forced wait + correct password.
- The config/options UI cannot be edited during an active block window without
  the password (so you cannot just delete a blocklist entry mid-session).
- Masked entries are encrypted at rest and unreadable without the password.

## Tech stack

- **WXT** (https://wxt.dev) - MV3-native web extension framework, Vite-based,
  built-in build/zip/publish. Chosen over Plasmo (maintenance mode) and CRXJS.
- **TypeScript**.
- **Svelte** as the UI framework (first-class in WXT; small bundle, reactive UI
  fits the live Pomodoro countdown).
- **Web Crypto API** for password hashing and encrypting masked entries.
- **zxcvbn** for password-strength enforcement.
- **Vitest** for unit tests of pure logic.

## Architecture: two independent subsystems

The blocker and the Pomodoro timer share storage and the background service
worker but are otherwise decoupled. Pomodoro never changes block state.

### A. Blocker (schedule-driven)

Data (in `chrome.storage.local`):

- `blocklist`: `Array<{ id: string; domain: string; masked: boolean }>`.
  For masked entries, `domain` is stored as ciphertext (AES-GCM); plaintext is
  only ever held in memory after a successful password unlock.
- `schedule`: `Array<{ days: number[]; start: "HH:MM"; end: "HH:MM" }>`.
  Default: Mon-Fri (`[1,2,3,4,5]`), windows `09:00-12:00` and `13:00-16:00`.
- `tempUnblocks`: `Array<{ domain: string; expiresAt: number }>` - active
  temporary unblocks granted via the password flow.
- `auth`: `{ pbkdf2Hash: string; salt: string; iterations: number }` - for
  verifying the master password. The AES key is re-derived from the password on
  demand; it is never stored.

Background service worker:

- A `chrome.alarms` tick (every 1 minute) plus run-on-startup recomputes
  "should we be blocking right now?" from `schedule` and `tempUnblocks`
  (expired temp unblocks are pruned).
- It then syncs **declarativeNetRequest dynamic rules**: when a window is
  active, add a redirect rule per blocked domain (minus active temp unblocks)
  pointing at the extension's `blocked.html`. When inactive, remove them.
- DNR redirect requires host permissions; the manifest requests
  `declarativeNetRequest` + host access.

Blocked page (`blocked.html`):

- Shows that the site is blocked and why (which schedule window).
- Unblock flow: button -> confirm dialog -> 30s countdown (button disabled) ->
  password field -> on correct password, add a `tempUnblock` for that domain
  for N minutes (configurable, default e.g. 5 min), then navigate back.
- Wrong password shows an explicit error and never partially unlocks.

Options page (`options.html`):

- Edit `blocklist`, `schedule`, password, Pomodoro durations, unblock minutes.
- During an active block window, editing the blocklist/schedule is locked
  behind a password prompt.
- Masked entries render as `•••• (locked)` until the password is entered for
  the current session; then they can be revealed/edited.
- Adding/marking an entry as masked encrypts its domain with the
  password-derived key.

### B. Pomodoro (independent)

Data (in `chrome.storage.local`):

- `pomodoro`: `{ workMinutes: number; restMinutes: number; state: "idle" |
  "work" | "rest"; phaseEndsAt: number | null }`. Defaults 25 / 5.

Behavior:

- State machine: `idle -> work -> rest -> work -> ...`. Start/stop from popup.
- Phase timing uses `chrome.alarms` so it survives service-worker eviction.
- On phase end: play a session-change sound + show a `chrome.notifications`
  toast ("Time to rest" / "Back to work"), then transition to the next phase.
- The popup shows a live countdown computed from `phaseEndsAt` (Svelte
  reactive), so it stays correct even though the SW may have been asleep.

Audio:

- MV3 service workers cannot play audio directly. A small **offscreen document**
  (`offscreen.html`) is created on demand to play the packaged sound files
  (work-start, rest-start) and closed afterward.

## Security / crypto

A single master password covers all three locks (unblock, edit-during-block,
decrypt masked entries).

- On first run, the user sets the master password. It must pass strength rules:
  minimum 12 characters, at least one each of uppercase/lowercase/digit/symbol,
  and a zxcvbn score requirement (reject score < 3). Weak/guessable passwords
  are rejected with specific feedback.
- Store only a PBKDF2-HMAC-SHA256 hash + random salt + iteration count to
  verify the password. The AES-GCM key for masked domains is derived from the
  password (PBKDF2) at unlock time and kept only in memory.
- Verification and decryption failures are raised explicitly; no silent unlock.

## Code structure

```
entrypoints/
  background.ts        # service worker: alarms, schedule eval, DNR sync, pomodoro
  popup/               # Pomodoro timer + quick block status (Svelte)
  options/             # config: blocklist, schedule, password, durations (Svelte)
  blocked/             # blocked page + unblock flow (Svelte)
  offscreen/           # audio playback host
lib/
  storage.ts           # typed wrappers over chrome.storage.local
  crypto.ts            # PBKDF2 hash/verify, AES-GCM encrypt/decrypt, key derive
  schedule.ts          # pure: isBlockingActive(schedule, now) etc.
  dnr-rules.ts         # pure: build DNR rule set from blocklist + temp unblocks
  pomodoro.ts          # pure: next-state transitions, remaining-time math
  password-policy.ts   # strength checks (zxcvbn + rules)
public/
  sounds/              # work-start, rest-start audio files
  icons/               # placeholder icon set (room for publish later)
```

Pure modules (`schedule`, `dnr-rules`, `pomodoro`, `crypto`, `password-policy`)
hold the logic and are unit-tested; entrypoints stay thin.

## Testing

- **Vitest** unit tests for the pure modules: schedule activeness across day/
  window boundaries, DNR rule generation, Pomodoro state transitions, crypto
  round-trips, password policy accept/reject cases.
- Extension behavior (DNR redirect, alarms, notifications, offscreen audio) is
  verified manually via `wxt dev` against a real Chrome profile.

## Error handling

- Wrong password / decryption failure: explicit error in the UI, no partial
  unlock.
- Storage read/write errors are raised, not swallowed.
- DNR rule sync failures are logged and surfaced; the worker retries on the
  next alarm tick.

## Known complexities / risks

1. Offscreen document lifecycle for audio (create-on-demand, close-after).
2. DNR dynamic-rule management and the per-domain redirect URL.
3. MV3 service-worker eviction - all timing relies on `chrome.alarms`, never
   on in-memory timers.

## Out of scope (YAGNI for v1)

- Background/ambient music during sessions (only session-change alarms).
- Block triggered by Pomodoro state (the two are independent by design).
- Sync across devices, multiple profiles, statistics/reporting.
- Defenses against uninstalling the extension.

## Future: publishing

- Provide a full icon set and a privacy policy.
- Verify no store-policy violations (the masked/encrypted blocklist and
  schedule-based blocking are standard productivity-extension features).
- Use WXT's built-in zip/publish pipeline.
