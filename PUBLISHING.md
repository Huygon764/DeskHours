# Publishing DeskHours to the Chrome Web Store

A step-by-step checklist to publish (and update) DeskHours. Follow top to bottom.
Most of the text you need to paste into the dashboard is included verbatim below.

> Context that shapes this guide: DeskHours requests `<all_urls>` host access and
> uses `declarativeNetRequest`, so it gets extra review scrutiny. It is **local-only**
> (no servers, no analytics, no data leaves the device) — that is a strength; disclose
> it, do not change it. Do **not** add analytics or remote code before publishing.

---

## 0. One-time account setup (~10 min, costs $5)

1. Go to the [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole).
2. Sign in with the Google account you want to publish under.
3. Pay the **one-time $5 registration fee** (covers all future extensions).
4. Set your **publisher display name** and verify a **contact email** (required).

## 1. Host the privacy policy (required before submitting)

Google requires a public privacy policy URL for extensions with broad permissions.
The policy lives in [`PRIVACY.md`](./PRIVACY.md) in this repo.
1. Fill in the `<your-contact-email>` placeholder in `PRIVACY.md`.
2. Make sure it is reachable at a public URL. Either of these works:
   - this repo's file URL (public repo): `https://github.com/<you>/<repo>/blob/main/PRIVACY.md`
   - a public Gist or GitHub Pages copy
3. Copy that public URL — you paste it in the Privacy tab (step 3).

## 2. Prepare the package

1. Bump the version in `package.json` (first release: `1.0.0`).
2. Build the store zip:
   ```sh
   bun run zip
   ```
   The packaged zip is written under `.output/`.
3. (Optional, helps review) Avoid shipping hard-to-review minified code where
   practical — reviewers favor readable code.

## 3. Create the listing — "Add new item"

In the dashboard: **Add new item** → upload the `.output/*.zip`.

### Store Listing tab

- **Category:** Productivity
- **Language:** English (default locale is `en`)
- **Store icon:** 128×128 PNG — already in `public/icon/128.png`
- **Screenshots:** at least one **1280×800** (or 640×400) PNG/JPEG; up to 5
- **Promo tiles (optional):** small 440×280, marquee 1400×560
- **Short description / summary:** see copy below
- **Detailed description:** see copy below

Suggested **summary** (max ~132 chars):
```
Block distracting sites on a schedule, hide entries behind a password, and stay on task with a built-in focus timer. No tracking.
```

Suggested **description**:
```
DeskHours blocks the websites you choose during the hours you set, and helps you stay
focused with a built-in pomodoro and countdown timer.

Features
- Scheduled blocking with weekly time windows (including overnight windows)
- Block whole domains, URL path patterns, or URL keywords
- Hidden entries encrypted with a master password (plaintext is never stored)
- Temporary password-granted unblocks
- Focus and pomodoro timers that can enforce blocking outside your schedule
- Backup and restore all settings as a JSON file
- Light/dark themes, English and Vietnamese

Privacy
DeskHours runs entirely on your device. It does not collect, transmit, or sell any
data. There is no analytics and no remote server. It uses Chrome's declarativeNetRequest
API, which blocks by rule without reading the content of your network requests.
```

### Privacy tab (the part most likely to cause rejection — fill carefully)

- **Single purpose** (paste):
  ```
  DeskHours blocks user-selected websites according to a schedule and provides a focus timer.
  ```
- **Permission justifications** — paste each:

  | Permission | Justification |
  |---|---|
  | `storage` | Save the user's blocklist, schedule, and settings locally. |
  | `alarms` | Re-evaluate the schedule each minute and fire focus/timer end events. |
  | `declarativeNetRequest` | Redirect navigations to blocked sites to the extension's blocked page. |
  | `declarativeNetRequestWithHostAccess` | Apply the redirect rules across the sites the user chooses to block. |
  | `downloads` | Export the user's settings backup as a JSON file. |
  | `offscreen` | Play alarm sounds (MV3 service workers cannot play audio). |
  | `notifications` | Notify the user when a focus or timer session ends. |
  | `tabs` | Read the active tab URL to show its block status and catch SPA navigations DNR misses. |
  | `webNavigation` | Detect in-page navigations to redirect blocked sites. |

- **Host permission `<all_urls>` justification** (paste):
  ```
  Users add arbitrary websites to their blocklist at runtime, so the extension must be
  able to match and redirect any URL. Narrower host permissions cannot cover sites the
  user has not chosen yet, so all-sites access is required for the core blocking feature.
  ```

- **Data usage disclosures:**
  - Personally identifiable info: **No**
  - Health / financial / authentication / personal communications / location / web
    history / user activity: **No** (nothing is collected or sent)
  - Check: *"I do not sell or transfer user data to third parties, outside of the
    approved use cases."*
  - Check: *"I do not use or transfer user data for purposes unrelated to my item's
    single purpose."*
  - Check: *"I do not use or transfer user data to determine creditworthiness or for
    lending purposes."*
  - **Privacy policy URL:** paste the URL from step 1.

### Distribution tab

- **Pricing:** Free
- **Regions:** all (or as desired)
- **Visibility:** Public (or Unlisted for a private first test)

## 4. Submit

- Click **Submit for review** and confirm.
- Optionally enable **deferred publishing** (review now, you press publish within 30 days).

## 5. Review expectations

- Typical: a few days; broad permissions + a new developer account push it longer
  (up to a few weeks). If it exceeds ~3 weeks, contact Web Store support.
- Common rejection reasons to avoid: broad permission without justification (covered
  above), hard-to-review/minified code, remote-hosted code (DeskHours bundles
  everything — OK), listing that overstates what the extension does.

---

## Pre-submit checklist

- [ ] $5 developer account active, contact email verified
- [ ] Privacy policy hosted at a public URL
- [ ] Version bumped in `package.json`
- [ ] `bun run zip` produced a fresh package
- [ ] `bun run test` and `bun run build` pass
- [ ] Manually smoke-tested the built extension (block a site, unlock a hidden entry,
      blocked page shows the original URL, timers count down, backup export/import)
- [ ] 128×128 icon + at least one 1280×800 screenshot ready
- [ ] Single purpose + all 9 permission justifications + `<all_urls>` justification filled
- [ ] Data disclosures filled (all "No collection") and certifications checked
- [ ] Privacy policy URL pasted

---

## Appendix: privacy policy

The privacy policy text lives in [`PRIVACY.md`](./PRIVACY.md). Fill in the contact
email, host it at a public URL, and paste that URL into the Privacy tab.
