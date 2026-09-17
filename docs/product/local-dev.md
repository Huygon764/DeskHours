# Local Development Runbook

Commands below are from root `README.md` and `package.json`. This is the
current documented local path, not a CI path (no workflows are checked in).

## Scope

Build, unit-test, and load the unpacked Chrome MV3 extension on a developer
machine.

## Prerequisites

- Bun (`package.json` `packageManager` is `bun@1.3.12`)
- A Chromium browser to load unpacked builds

Optional: copy `web-ext.config.example.ts` → `web-ext.config.ts` (gitignored)
to point WXT at a local browser binary. The example uses Brave on macOS. That
file is machine-local; it is not the documented load-unpacked path.

## Start

```sh
bun install          # also runs `wxt prepare` via postinstall
bun run dev          # WXT dev server with HMR
```

Production-shaped load (README):

```sh
bun run build        # writes `.output/chrome-mv3`
```

Then Chrome → `chrome://extensions` → Developer mode → Load unpacked →
`.output/chrome-mv3`.

Writable state this run uses: `node_modules/`, `.wxt/`, `.output/` (all
gitignored). Extension settings live in the browser profile that loaded the
extension, not in the repo.

## Readiness

- `bun run dev`: WXT reports the extension is being served / reloaded.
- Unpacked load: the extension appears on `chrome://extensions` with no load
  error.

Exact WXT dev port is not documented in-repo.

## Deterministic state

No in-repo fixture resets the loaded extension's `chrome.storage`. Tests use
Vitest + WXT's fake browser (`lib/test-setup.ts`), not a real profile.

## Interface

Popup, options, and blocked page are the real UI. Blocking, alarms, and
offscreen audio are verified manually per README.

## Runtime evidence

Service worker logs prefix `[deskhours]`. DNR sync logs rule count and
patterns. Failures (`DNR update failed`, `tab guard failed`, message-router
errors) go to `console.error` and are not swallowed.

No log correlation id is defined.

## Ownership and cleanup

Stopping `bun run dev` stops the WXT process. It does not uninstall a loaded
unpacked extension or clear profile storage. Whether to remove the extension
after a session is not specified.

## Validation

```sh
bun run test         # Vitest; do not use `bun test`
bun run compile      # tsc --noEmit
bun run zip          # store zip under `.output/`
```

## Unknowns

- Which Chromium binary is required locally (README says Chrome; example
  config shows Brave).
- WXT dev server host/port.
- Cleanup obligation after a failed or successful manual session.
