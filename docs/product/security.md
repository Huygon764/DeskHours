# Password, Masking, And Threat Model

Current behavior from `lib/crypto.ts`, `lib/password-policy.ts`,
`lib/masking.ts`, `lib/password-change.ts`, `PRIVACY.md`.

## Threat model

Self-binding, not adversarial. Uninstalling or disabling the extension bypasses
it. The password is friction against impulse, not protection against a
determined user on the same machine.

## Master password

One password covers temp unblock, options unlock during a block window, and
decrypting masked entries.

First-run sets the password. Policy (`checkPassword`): length ≥ 12; upper,
lower, digit, symbol; zxcvbn score ≥ 3. Failures return explicit errors.

Stored `local:auth`: PBKDF2-HMAC-SHA256 hash, salt, iterations (current
`600_000`), and a **separate** `encKeySalt`. The AES key is derived from the
password + `encKeySalt`, never from the stored hash. Verify uses
constant-time compare. Legacy records missing `encKeySalt` are migrated on
unlock.

The password itself is never stored. Wrong password / decrypt failure is an
explicit error; no partial unlock.

## Masked entries

AES-GCM payloads live in `BlockEntry.domain` when `masked` is true. Plaintext
is held in `session:unmaskedDomains` after a successful unlock and is cleared
when the browser session ends (and on backup import).

## Permissions

Manifest (`wxt.config.ts`): `storage`, `alarms`, `declarativeNetRequest`,
`declarativeNetRequestWithHostAccess`, `downloads`, `offscreen`,
`notifications`, `tabs`, `webNavigation`, host `<all_urls>`. Host access is
for blocking chosen sites, not for reading or transmitting browsing.

## Privacy

`PRIVACY.md`: nothing is collected or sent. No analytics, no remote servers.
DNR matches locally and does not read request bodies.
