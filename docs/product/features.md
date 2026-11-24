# DeskHours feature catalog

UI inventory for regenerating or extending frontend surfaces. Behavior details
live in the other files in this directory. This page lists what each surface
shows and what the user can do.

Product: Chrome MV3 extension. Data stays on-device. English and Vietnamese.
Theme: system, light, or dark.

## Surfaces

| Surface | Path | Role |
| --- | --- | --- |
| Toolbar popup | `entrypoints/popup/` | 320px. Current-tab block actions, focus, countdown, upcoming alarms |
| Options (full page) | `entrypoints/options/` | First-run password, then schedule, blocklist, focus/timer/alarms, settings |
| Blocked page | `entrypoints/blocked/` | Full-tab intercept when a matching navigation is redirected |
| Toolbar badge | service worker | Ringing-alarm count (color `#d92d20`) |

Copy comes from `public/_locales/{en,vi}/`. Do not hard-code user-visible
strings when generating UI.

## Shared rules

- Blocking is on when the local clock is inside a schedule window **or** a
  pomodoro **work** phase is active (including paused work). Rest, idle, the
  countdown timer, and wall-clock alarms do not enable blocking.
- While blocking is on and the user has not unlocked, schedule edits and
  blocklist pause/remove require the master password (popup Block tab and
  options Schedule / Sites tabs). Adding a site or keyword never needs the
  password: it only tightens the list.
- First launch: options shows only password setup. No other tabs until a
  password exists.
- Password policy: length ≥ 12; upper, lower, digit, symbol; zxcvbn score ≥ 3.
  Strength meter: weak / fair / good / strong.
- Not in product: cross-device sync, multiple profiles, usage statistics,
  block-on-rest, uninstall protection.

---

## Popup (`entrypoints/popup/`)

Fixed width **320px**. No nested card chrome; the extension window is the frame.

### Chrome

1. Header: logo, app name, badge **Blocking on** or **Blocking off**.
2. Ringing-alarm banner (only if any alarm is ringing): label + **Dismiss**.
3. Tabs: **Block** | **Focus** | **Timer**. A live dot on Focus when a pomodoro
   session is not idle; on Timer when the countdown is running or just finished.
4. Body for the active tab.
5. On the Block tab only, hint rows if focus or countdown is live, with a link
   to that tab.
6. Footer: **Open settings** → options page.

First-open tab: a live pomodoro → Focus; else countdown running or finished →
Timer; else Block.

### Block tab

Section **This page**. Uses the active http(s) tab.

| State | UI |
| --- | --- |
| Loading | muted “loading tab” copy |
| Not an http(s) tab | “open a website tab” copy |
| Blocking on, locked, page listed | password field + **Unlock** before the pause toggle works |
| Listed and enabled | status (Blocked vs On list) + pattern + toggle to pause the entry |
| Listed and disabled | “on list, paused” + toggle to re-enable |
| Not listed | **Block {domain}**; if the URL has a path, also **Block {domain/path}**. No password, even while locked |

Actions mutate the blocklist. Path patterns are offered only when
`pathPatternFromUrl` returns a value.

### Focus tab

Idle:

- Large preview of work duration (`MM:00`).
- **Start focus**.
- Presets **classic 25/5** and **deep 50/10** (idle only).
- Work / rest steppers, 1–120 minutes. Changing durations is idle-only and
  resets the session to idle.

Running or paused:

- Phase label (Focus / Rest, or Paused — work/rest).
- Countdown `MM:SS` (dimmed when paused).
- **Pause** or **Resume**.
- **End session**.

Work phase turns site blocking on even outside the schedule.

### Timer tab

Independent countdown. Does not change block state. Default 5 minutes. Range
1 second–24 hours.

| State | UI |
| --- | --- |
| Idle | tap time to edit `HH:MM:SS`; **+30s / +1m / +5m**; **Start timer** |
| Running | countdown + **Pause** + **Reset** |
| Paused | dimmed time + **Resume** + **Reset** |
| Finished | amber “times up” panel `00:00:00` + **Reset** |

Below the countdown: **Alarms** list of the next **3** upcoming alarms (label,
next occurrence, enable toggle). Empty copy when none. Create/edit lives on
the options Focus & timer tab.

`soundEnabled` exists in timer storage and backup. There is no popup control
for it.

---

## Options / full page (`entrypoints/options/`)

Full browser tab. Header: title + subtitle.

### First run

If no password is stored: setup form only (new password, confirm, policy
errors, strength). After save, the four tabs appear.

### Unlock banner

When blocking is on and this page is locked: banner with password + **Unlock**.
Gates Schedule edits and Sites pause/remove; adding sites and keywords stays
open. Focus, timer, alarms, language, theme,
backup, and password change are not gated by this banner.

Last-open tab is persisted (`local:optionsTab`).

### Schedule

Presets (apply replaces the window list):

| Id | Windows |
| --- | --- |
| `office-hours` (default) | Mon–Fri 08:00–12:00 and 13:30–17:00 |
| `full-workday` | Mon–Fri 08:00–17:00 |
| `evenings` | Mon–Fri 18:00–22:00 |
| `weekends` | Sat–Sun 08:00–22:00 |
| `all-day-weekdays` | Mon–Fri 00:00–23:59 |
| `always-on` | every day 00:00–23:59 |

Custom windows: day pills (Mon=1 … Sun=7), start/end times, add/remove,
**Save**. Overnight windows (`end` ≤ `start`, non-zero) wrap midnight.
`23:59` / `24:00` mean end of day.

### Sites

Visible site patterns and URL keywords, each with enable toggle and remove.

Add site: domain or path field + optional **add as hidden**. Accepts pasted
`https://`, `www.`, adblock `||example.com^`, and hosts-file `0.0.0.0` /
`127.0.0.1` lines.

Add keyword: URL-substring match (ASCII, case-insensitive, max 200 chars) +
optional **add as hidden**.

Hidden lists (sites and keywords, separate): collapsed until the user enters
the master password to reveal. Ciphertext stays in storage; plaintext is
session-only. Hidden entries are not enforced until revealed this session.
After backup import, they stay unenforced until unlock again.

Disabled entries stay in the list but are not enforced.

### Focus & timer

Same Focus and Timer panels as the popup, in cards, plus the full **Alarms**
editor:

- Cap **20** alarms.
- Per alarm: time, label, enable, delete.
- Repeat: **once** (date) or **weekly** (day pills).
- **Add alarm**. One-time alarms stay in the list after firing, disabled.

### Settings

- Language: system / English / Vietnamese.
- Appearance: system / light / dark.
- Backup: export JSON `deskhours-backup-YYYY-MM-DD.json`; import with a
  summary confirmation before replace. Schema version 2.
- Change master password (verify current, then same policy as first-run).

Export includes blocklist, schedule, auth record, unblock minutes, theme,
locale, pomodoro durations, timer duration + `soundEnabled`, and the alarm
list. It does not include live sessions, temp unblocks, unmask session state,
or ringing alarms.

There is no dedicated control for temp-unblock duration. Stored default is
**5 minutes** (minimum 1), restored via backup.

---

## Blocked page (`entrypoints/blocked/`)

Full-tab replacement after DNR (or tab-guard) redirect to
`blocked.html?url=<original>`. Centered card, max-width **480px**.

Headline: blocked pattern, else hostname, else generic “site blocked”.
Subtext explains the intercept.

Two steps:

1. **Wait.** User confirms they still need access. Countdown starts at **30s**
   and doubles per successful grant **today** (local calendar), cap **300s**,
   reset at local midnight. Refreshing the page does not shorten a wait already
   resolved on load.
2. **Password.** After the wait: master password + grant for that **pattern**
   (not the page URL). Then navigate back to the original URL. Blocking
   resumes when the grant expires.

Errors: missing URL, unknown rule, no password set, wrong password, grant
failed.

---

## Cross-cutting (no extra screen)

- **Enforcement:** `declarativeNetRequest` redirects matching `main_frame`
  navigations; tab / `webNavigation` guards cover SPA and similar misses.
- **Scheduler:** 1-minute alarm resyncs blocking and checks wall-clock alarms.
- **Sounds:** offscreen document. Focus phase-end uses `work-start` /
  `rest-start`. Due wall-clock alarms play `rest-start` five times (once per
  batch).
- **Notifications:** focus phase end, countdown end, due alarms. Clicking a
  countdown notification resets the timer. Clicking `alarm-<id>` dismisses
  that ringing id.

## Authority

| Topic | Doc |
| --- | --- |
| Product surface and non-goals | `overview.md` |
| Schedule, patterns, DNR, temp unblock | `blocking.md` |
| Pomodoro, countdown, alarms | `timers.md` |
| Password, masking, privacy | `security.md` |
| Export / import | `backup.md` |
| Code layout | `docs/ARCHITECTURE.md` |
