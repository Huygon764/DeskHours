# 0005 Session-Only Unmask And Separate Enc Key Salt

Date: 2026-09-17

## Status

Accepted

## Context

Masked domains must stay unreadable at rest. Using the password hash as the AES
key would make the stored verifier the key.

## Decision

Encrypt masked plaintext with AES-GCM. Derive the key from the password plus
`encKeySalt`, independent of the PBKDF2 verifier salt. Hold plaintext only in
`session:unmaskedDomains`. Backup import clears that session list; hidden
entries stay unenforced until unlock.

## Alternatives Considered

1. Store plaintext after first unlock in `local`.
2. Derive AES from the same salt as the password hash.

## Consequences

Positive:

- Browser restart hides masked sites again.
- Stored hash is not the masking key.

Tradeoffs:

- Masked sites do not block until unlocked this session.

## Follow-Up

- None.
