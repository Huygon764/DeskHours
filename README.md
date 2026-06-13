# DeskHours

A schedule-based website blocker with a built-in focus timer, built as a Chrome
(MV3) extension. Block distracting sites during the hours you choose, hide sensitive
entries behind a master password, and run focus/pomodoro sessions.

## Features

- **Scheduled blocking** — define weekly time windows (incl. overnight windows that
  cross midnight); sites are blocked only during those windows.
- **Blocklist** — block whole domains, URL path patterns (`youtube.com/shorts/*`),
  or URL keywords. Accepts adblock (`||example.com^`) and hosts-file formats on input.
- **Hidden (masked) entries** — entries encrypted with AES-GCM; their plaintext is
  never stored and is only revealed in-session after entering the master password.
- **Master password** — PBKDF2-derived; gates temporary unblocks and reveals.
- **Temporary unblock** — password-grant timed access to a blocked pattern.
- **Focus timer** — independent pomodoro (work/rest) and countdown timers with sound
  alerts and notifications; focus sessions can enforce blocking outside the schedule.
- **Backup** — export/import all settings as JSON.
- **i18n & theming** — English/Vietnamese, light/dark/system theme.

## Tech stack

- [WXT](https://wxt.dev/) (extension framework) + Svelte 5 (runes)
- TypeScript, Vitest
- Chrome `declarativeNetRequest` for blocking, `offscreen` for audio
- Bun as package manager

## Development

```sh
bun install          # install dependencies
bun run dev          # start WXT dev server (HMR)
bun run build        # production build -> .output/chrome-mv3
bun run test         # run the Vitest suite (use this, not `bun test`)
bun run compile      # type-check (tsc --noEmit)
bun run zip          # package a distributable zip
```

### Load the unpacked extension

1. `bun run build`
2. Open `chrome://extensions`, enable **Developer mode**
3. **Load unpacked** → select `.output/chrome-mv3`

## Project structure

```
entrypoints/
  background.ts      service worker: alarms, tab guards, message router
  popup/             toolbar popup (block / focus / timer tabs)
  options/           settings page (schedule, blocklist, password, backup, theme)
  blocked/           the interception page shown for blocked sites
  offscreen/         offscreen document for alarm sound playback
lib/                 core logic: blocking, schedule, crypto, timers, backup, i18n
components/          shared Svelte components
public/_locales/     en / vi message catalogs
```

## How blocking works

`lib/blocker-controller.ts` computes the active block patterns from the blocklist,
schedule, focus state, and temporary unblocks, then writes Chrome
`declarativeNetRequest` dynamic rules that redirect matching navigations to the
blocked page. A 1-minute alarm and storage changes keep the rules in sync.
