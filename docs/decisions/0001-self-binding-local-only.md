# 0001 Self-Binding And Local-Only

Date: 2026-09-17

## Status

Accepted

## Context

The extension is a personal productivity lock. Chrome lets the user uninstall
or disable any extension. A remote backend would change the privacy story and
store-review surface (`PRIVACY.md`, `PUBLISHING.md`).

## Decision

Treat bypass by uninstall/disable as out of scope. Keep all user data on-device.
No analytics, no remote servers, no reading request bodies. DNR + local storage
only.

## Alternatives Considered

1. Adversarial hardening (prevent disable/uninstall).
2. Sync or a backend for settings.

## Consequences

Positive:

- Matches store listing and privacy policy.
- Password is friction, not a security boundary against the device owner.

Tradeoffs:

- A determined user can always turn it off.

## Follow-Up

- Do not add analytics or remote code before a CWS publish (`PUBLISHING.md`).
