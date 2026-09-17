# DeskHours Overview

Current advertised product. Source: root `README.md`, `PRIVACY.md`,
`package.json` (`deskhours` `0.1.0`).

Chrome MV3 extension: schedule-based site blocking, a master-password-gated
hidden blocklist, and independent focus/countdown timers plus wall-clock
alarms. Data stays on-device. No analytics or remote servers.

## Features (current)

- Weekly schedule windows, including overnight windows that cross midnight.
- Block hosts, URL path patterns (`youtube.com/shorts/*`), or URL keywords.
  Input also accepts adblock (`||example.com^`) and hosts-file lines.
- Masked entries encrypted with AES-GCM; plaintext is session-only after unlock.
- Master password (PBKDF2) gates temp unblocks and reveal of masked entries.
- Temporary unblock of one pattern for N minutes (default 5).
- Focus (pomodoro) and countdown timers with sound and notifications. A focus
  **work** phase enforces the blocklist outside the schedule.
- Wall-clock alarms (once or weekly) with badge and popup banner.
- JSON backup/restore.
- English / Vietnamese and light / dark / system theme.

## Out of current product

Not implemented as product features: cross-device sync, multiple profiles,
usage statistics, block-on-rest, or defenses against uninstalling the
extension.

## Historical spec

`docs/superpowers/` (removed from the tree; still in git history, dated
2026-06-07) described an earlier design. It is stale. Use these product files
and the code, not that spec.
