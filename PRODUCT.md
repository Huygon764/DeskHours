# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Primary user is a person with ADHD / impulse: they work at a computer, want sites blocked during work or focus, and need friction (master password, escalating wait) so they cannot casually unbreak the block in-session. This is self-binding, not a parent, admin, or shared-household controller.

## Product Purpose

DeskHours is a Chrome MV3 extension that blocks chosen sites during weekly schedule windows and during a pomodoro **work** phase, with independent countdown and wall-clock alarms. Success is staying on task without leaking browsing data off-device.

## Positioning

Friction against the same person who set the rules. The password and wait are impulse brakes, not protection against a determined user who can uninstall the extension. Neighbors that only hide a tab or rely on willpower cannot truthfully claim this.

## Operating Context

Used as a toolbar popup (current page, focus, timer) plus a full options page and a full-tab blocked intercept. Blocking is on when the local clock is in a schedule window **or** a focus work phase is active (including paused work). Rest, idle, countdown, and alarms do not enable blocking. English and Vietnamese; theme follows system, light, or dark.

## Capabilities and Constraints

- Block hosts, URL paths, and URL keywords; hidden entries stay encrypted until unlocked this session.
- Temp unblock is password-granted for a pattern, after a wait that doubles per grant today.
- Data stays in local extension storage. No analytics, no remote servers, no cross-device sync.
- Current shipping form is this Chrome MV3 codebase (`deskhours` 0.1.0). Other browsers and native apps are not confirmed.
- Not in product: multiple profiles, usage statistics, block-on-rest, uninstall defense.

## Brand Commitments

Name: **DeskHours**. Voice in product copy is instructional and bilingual (en/vi). No other identity constraints were confirmed.

## Evidence on Hand

Authoritative current behavior: `README.md`, `PRIVACY.md`, `docs/product/` (`overview.md`, `features.md`, `blocking.md`, `timers.md`, `security.md`, `backup.md`). UI lives in `entrypoints/popup/`, `entrypoints/options/`, `entrypoints/blocked/`. Do not invent testimonials, usage numbers, or reviews.

## Product Principles

- Keep the user’s data on this machine.
- Make impulse expensive; do not pretend to stop a determined bypass.
- Blocking follows schedule and focus work only, never rest or timer/alarms by themselves.
- UI stays bilingual and theme-aware.
- Meet WCAG 2.2 AA (contrast, keyboard, labels) on user-facing surfaces.

## Accessibility & Inclusion

Target WCAG 2.2 AA: contrast, keyboard access, and visible labels on popup, options, and blocked page.
