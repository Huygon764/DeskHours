# Site Blocker Extension Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A personal Chrome (MV3) extension that blocks distracting sites on a fixed schedule with a password-protected unblock flow and a hideable ("masked") blocklist, plus an independent Pomodoro timer with session-change alarm sounds.

**Architecture:** Two decoupled subsystems sharing one background service worker and `chrome.storage.local`. The blocker evaluates a weekly schedule on a 1-minute `chrome.alarms` tick and syncs declarativeNetRequest (DNR) dynamic rules that redirect blocked domains to an in-extension `blocked.html`. The Pomodoro timer is a separate `chrome.alarms`-driven state machine that plays a sound (via an offscreen document) and shows a notification at each phase change. Pure logic lives in `lib/` and is unit-tested; entrypoints stay thin.

**Tech Stack:** WXT, TypeScript, Svelte 5 (runes + `mount()`), Web Crypto API (PBKDF2 + AES-GCM), `@zxcvbn-ts/core` for password strength, Vitest + `fakeBrowser` for tests.

---

## Reference: verified API facts (2026)

These were confirmed against current docs. Use them verbatim; do not invent alternatives.

- **WXT entrypoints**: `entrypoints/background.ts` exports `defineBackground(() => {...})`. UI pages are folders: `entrypoints/popup/index.html` + `main.ts` + `App.svelte`. Unlisted HTML pages (blocked, offscreen) follow the same folder pattern: `entrypoints/blocked/index.html`, `entrypoints/offscreen/index.html`. `index.html` contains `<div id="app"></div>` + `<script type="module" src="./main.ts"></script>`.
- **Svelte in WXT**: add module `@wxt-dev/module-svelte` to `wxt.config.ts` `modules: [...]`. Mount with Svelte 5 API: `import { mount } from 'svelte'; mount(App, { target: document.getElementById('app')! })`. (Do NOT use `new App({target})` — that is Svelte 4.)
- **Svelte 5 runes**: `$state(initial)` for reactive state, `$derived(expr)` for computed, `$effect(() => {... return cleanup})` for side effects, `$props()` for component props. No imports needed for runes.
- **WXT storage**: `import { storage } from '#imports';` then `const item = storage.defineItem<T>('local:key', { fallback: <default> })`. Use `await item.getValue()`, `await item.setValue(v)`, `item.watch(cb)`. Keys MUST have a `local:` prefix.
- **DNR dynamic rules**: `await browser.declarativeNetRequest.updateDynamicRules({ removeRuleIds: number[], addRules: Rule[] })`. Rule shape: `{ id: number>=1, priority: number, action: { type: 'redirect', redirect: { extensionPath: '/blocked.html' } }, condition: { requestDomains: string[], resourceTypes: ['main_frame'] } }`. `extensionPath` must start with `/`. The redirect target must be listed in `web_accessible_resources`.
- **Manifest permissions for blocking+redirect**: `permissions: ['declarativeNetRequest', 'alarms', 'offscreen', 'notifications', 'storage']`, `host_permissions: ['<all_urls>']` (needed so a redirect rule may fire on any blocked domain). `web_accessible_resources` must expose `blocked.html` to `<all_urls>`.
- **chrome.offscreen**: `permissions: ['offscreen']`. Create with `await browser.offscreen.createDocument({ url: 'offscreen.html', reasons: ['AUDIO_PLAYBACK'], justification: 'Play Pomodoro session-change alarm' })`. Guard with `await browser.offscreen.hasDocument()`. Send a `chrome.runtime.sendMessage` to tell it which sound to play. The offscreen doc auto-closes 30s after audio stops under `AUDIO_PLAYBACK`.
- **chrome.alarms**: `browser.alarms.create(name, { periodInMinutes })` for the recurring scheduler tick; `browser.alarms.create(name, { when: epochMs })` for one-shot Pomodoro phase ends. Listen with `browser.alarms.onAlarm.addListener(a => ...)`. Alarms survive service-worker eviction; never use `setTimeout`/`setInterval` in the background.
- **zxcvbn-ts**: install `@zxcvbn-ts/core @zxcvbn-ts/language-common @zxcvbn-ts/language-en`. Configure once via `zxcvbnOptions.setOptions({ translations, graphs, dictionary })`, then `zxcvbn(password)` returns `{ score: 0-4, feedback: { warning, suggestions } }`.
- **WXT testing**: `vitest.config.ts` uses `import { WxtVitest } from 'wxt/testing/vitest-plugin'; export default defineConfig({ plugins: [WxtVitest()] })`. In tests, `import { fakeBrowser } from 'wxt/testing/fake-browser'` and call `fakeBrowser.reset()` in `beforeEach`. `browser.*` and WXT `storage` work against the in-memory fake automatically.
- **WXT API access**: use the `browser` global (WXT auto-imports it via webextension-polyfill). All `chrome.*` examples above map to `browser.*`.

A pitfall to avoid: `requestDomains` matches the registrable domain and its subdomains, so `requestDomains: ['facebook.com']` also blocks `www.facebook.com`. Store bare domains (no scheme, no `www.`, no path).

---

## File Structure

```
wxt.config.ts                     # WXT config: manifest, modules, permissions
vitest.config.ts                  # Vitest + WxtVitest plugin
package.json                      # scripts + deps
tsconfig.json                     # extends .wxt/tsconfig.json

entrypoints/
  background.ts                   # SW: scheduler alarm, DNR sync, pomodoro alarms, offscreen audio
  popup/                          # Pomodoro timer + block status (Svelte)
    index.html
    main.ts
    App.svelte
  options/                        # config: blocklist, schedule, password, durations (Svelte)
    index.html
    main.ts
    App.svelte
    PasswordSetup.svelte
    BlocklistEditor.svelte
    ScheduleEditor.svelte
  blocked/                        # blocked page + unblock flow (Svelte)
    index.html
    main.ts
    App.svelte
  offscreen/                      # audio playback host
    index.html
    main.ts

lib/
  types.ts                        # shared TS types
  storage.ts                      # typed storage items (defineItem)
  schedule.ts                     # pure: isBlockingActive, activeWindow
  dnr-rules.ts                    # pure: buildRedirectRules from blocklist + temp unblocks
  pomodoro.ts                     # pure: nextPhase, remainingMs
  crypto.ts                       # PBKDF2 hash/verify, AES-GCM encrypt/decrypt, deriveKey
  password-policy.ts              # strength checks (rules + zxcvbn)
  messages.ts                     # runtime message type constants + helpers
  blocker-controller.ts           # impure: orchestrates schedule eval -> DNR update
  pomodoro-controller.ts          # impure: start/stop, schedules phase-end alarm, fires audio

public/
  sounds/
    work-start.mp3                # plays when entering work
    rest-start.mp3                # plays when entering rest
  icon/                           # 16/32/48/128 placeholder icons (room for publish)

tests/  (co-located *.test.ts next to lib files is also fine)
```

Split rationale: every file in `lib/` has one responsibility; the pure modules (`schedule`, `dnr-rules`, `pomodoro`, `crypto`, `password-policy`) carry the logic and are fully unit-tested. Controllers wire pure logic to `browser.*` side effects. Entrypoints only mount UI or register listeners.

---

## Task 0: Project scaffold

**Files:**
- Create: `package.json`, `wxt.config.ts`, `vitest.config.ts`, `tsconfig.json`, `.gitignore`

- [ ] **Step 1: Scaffold WXT + Svelte project**

Run (in repo root, which already has a `docs/` folder and git initialized):

```bash
npm install
```

If `package.json` does not exist yet, create it first (Step 2), then run install.

- [ ] **Step 2: Create `package.json`**

```json
{
  "name": "site-blocker",
  "description": "Schedule-based website blocker with password-protected unblock and Pomodoro timer",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "wxt",
    "build": "wxt build",
    "zip": "wxt zip",
    "compile": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest",
    "postinstall": "wxt prepare"
  },
  "devDependencies": {
    "@wxt-dev/module-svelte": "^2.0.0",
    "svelte": "^5.0.0",
    "typescript": "^5.6.0",
    "vitest": "^2.1.0",
    "wxt": "^0.20.0"
  },
  "dependencies": {
    "@zxcvbn-ts/core": "^3.0.4",
    "@zxcvbn-ts/language-common": "^3.0.4",
    "@zxcvbn-ts/language-en": "^3.0.2"
  }
}
```

Note: pin to the latest published majors at implementation time; the carets above allow minor upgrades. After editing, run `npm install`.

- [ ] **Step 3: Create `wxt.config.ts`**

```typescript
import { defineConfig } from 'wxt';

export default defineConfig({
  modules: ['@wxt-dev/module-svelte'],
  manifest: {
    name: 'Site Blocker',
    description: 'Block distracting sites on a schedule, with a Pomodoro timer',
    permissions: [
      'storage',
      'alarms',
      'declarativeNetRequest',
      'offscreen',
      'notifications',
    ],
    host_permissions: ['<all_urls>'],
    web_accessible_resources: [
      {
        resources: ['blocked.html'],
        matches: ['<all_urls>'],
      },
    ],
  },
});
```

- [ ] **Step 4: Create `vitest.config.ts`**

```typescript
import { defineConfig } from 'vitest/config';
import { WxtVitest } from 'wxt/testing/vitest-plugin';

export default defineConfig({
  plugins: [WxtVitest()],
});
```

- [ ] **Step 5: Create `tsconfig.json`**

```json
{
  "extends": "./.wxt/tsconfig.json",
  "compilerOptions": {
    "strict": true
  }
}
```

(`.wxt/tsconfig.json` is generated by `wxt prepare`, run via `postinstall`.)

- [ ] **Step 6: Create `.gitignore`**

```
node_modules
.wxt
.output
*.zip
```

- [ ] **Step 7: Verify the toolchain runs**

Run: `npm install && npm run compile`
Expected: install succeeds; `tsc --noEmit` exits 0 (no entrypoints yet, so nothing to compile — an empty success is fine).

- [ ] **Step 8: Commit**

```bash
git add package.json wxt.config.ts vitest.config.ts tsconfig.json .gitignore
git commit -m "chore: scaffold WXT + Svelte + Vitest project"
```

---

## Task 1: Shared types

**Files:**
- Create: `lib/types.ts`

- [ ] **Step 1: Write the types**

```typescript
// lib/types.ts

/** A single weekly time window during which blocking is active. */
export interface ScheduleWindow {
  /** ISO weekday numbers, Mon=1 ... Sun=7. */
  days: number[];
  /** "HH:MM" 24h, inclusive start. */
  start: string;
  /** "HH:MM" 24h, exclusive end. */
  end: string;
}

/** One blocked site. `domain` is plaintext for normal entries; for masked
 *  entries it holds the AES-GCM ciphertext and plaintext lives only in memory. */
export interface BlockEntry {
  id: string;
  /** Bare registrable domain, e.g. "facebook.com" (no scheme/www/path).
   *  When `masked` is true this is the encrypted payload string instead. */
  domain: string;
  masked: boolean;
}

/** A temporary password-granted unblock for one domain. */
export interface TempUnblock {
  domain: string;
  /** epoch ms when the unblock expires. */
  expiresAt: number;
}

/** Stored material to verify the master password (no key is ever stored). */
export interface AuthRecord {
  /** base64 PBKDF2-HMAC-SHA256 output. */
  hash: string;
  /** base64 random salt. */
  salt: string;
  iterations: number;
}

/** AES-GCM encrypted payload, all base64. */
export interface EncryptedPayload {
  iv: string;
  ciphertext: string;
}

export type PomodoroPhase = 'idle' | 'work' | 'rest';

export interface PomodoroState {
  workMinutes: number;
  restMinutes: number;
  phase: PomodoroPhase;
  /** epoch ms when the current phase ends; null when idle. */
  phaseEndsAt: number | null;
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npm run compile`
Expected: exits 0.

- [ ] **Step 3: Commit**

```bash
git add lib/types.ts
git commit -m "feat: add shared domain types"
```

---

## Task 2: Schedule logic (pure)

**Files:**
- Create: `lib/schedule.ts`
- Test: `lib/schedule.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// lib/schedule.test.ts
import { describe, it, expect } from 'vitest';
import { isBlockingActive, DEFAULT_SCHEDULE } from './schedule';
import type { ScheduleWindow } from './types';

// 2026-06-08 is a Monday.
const mon = (h: number, m = 0) => new Date(2026, 5, 8, h, m).getTime();
const sat = (h: number, m = 0) => new Date(2026, 5, 13, h, m).getTime(); // Saturday

const sched: ScheduleWindow[] = [
  { days: [1, 2, 3, 4, 5], start: '09:00', end: '12:00' },
  { days: [1, 2, 3, 4, 5], start: '13:00', end: '16:00' },
];

describe('isBlockingActive', () => {
  it('is active inside a weekday morning window', () => {
    expect(isBlockingActive(sched, mon(10, 30))).toBe(true);
  });
  it('is inactive during lunch gap', () => {
    expect(isBlockingActive(sched, mon(12, 30))).toBe(false);
  });
  it('is active inside afternoon window', () => {
    expect(isBlockingActive(sched, mon(15, 59))).toBe(true);
  });
  it('treats start as inclusive and end as exclusive', () => {
    expect(isBlockingActive(sched, mon(9, 0))).toBe(true);
    expect(isBlockingActive(sched, mon(12, 0))).toBe(false);
  });
  it('is inactive on weekends', () => {
    expect(isBlockingActive(sched, sat(10))).toBe(false);
  });
  it('is inactive when schedule empty', () => {
    expect(isBlockingActive([], mon(10))).toBe(false);
  });
  it('default schedule blocks Mon 09:00-12:00 and 13:00-16:00', () => {
    expect(isBlockingActive(DEFAULT_SCHEDULE, mon(9, 30))).toBe(true);
    expect(isBlockingActive(DEFAULT_SCHEDULE, mon(12, 30))).toBe(false);
    expect(isBlockingActive(DEFAULT_SCHEDULE, mon(14, 0))).toBe(true);
    expect(isBlockingActive(DEFAULT_SCHEDULE, mon(16, 0))).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- schedule`
Expected: FAIL — `isBlockingActive`/`DEFAULT_SCHEDULE` not found.

- [ ] **Step 3: Implement**

```typescript
// lib/schedule.ts
import type { ScheduleWindow } from './types';

export const DEFAULT_SCHEDULE: ScheduleWindow[] = [
  { days: [1, 2, 3, 4, 5], start: '09:00', end: '12:00' },
  { days: [1, 2, 3, 4, 5], start: '13:00', end: '16:00' },
];

/** Minutes since midnight for "HH:MM". */
function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

/** ISO weekday: Mon=1 ... Sun=7 (JS getDay() is Sun=0). */
function isoWeekday(d: Date): number {
  const js = d.getDay();
  return js === 0 ? 7 : js;
}

/** True if `at` falls inside any window. Start inclusive, end exclusive. */
export function isBlockingActive(schedule: ScheduleWindow[], at: number): boolean {
  const d = new Date(at);
  const day = isoWeekday(d);
  const minutes = d.getHours() * 60 + d.getMinutes();
  return schedule.some(
    (w) =>
      w.days.includes(day) &&
      minutes >= toMinutes(w.start) &&
      minutes < toMinutes(w.end),
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- schedule`
Expected: PASS (all 7 cases).

- [ ] **Step 5: Commit**

```bash
git add lib/schedule.ts lib/schedule.test.ts
git commit -m "feat: schedule activeness logic"
```

---

## Task 3: DNR rule builder (pure)

**Files:**
- Create: `lib/dnr-rules.ts`
- Test: `lib/dnr-rules.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// lib/dnr-rules.test.ts
import { describe, it, expect } from 'vitest';
import { buildRedirectRules } from './dnr-rules';

describe('buildRedirectRules', () => {
  it('builds one main_frame redirect rule per domain', () => {
    const rules = buildRedirectRules(['facebook.com', 'youtube.com']);
    expect(rules).toHaveLength(2);
    expect(rules[0]).toEqual({
      id: 1,
      priority: 1,
      action: { type: 'redirect', redirect: { extensionPath: '/blocked.html' } },
      condition: { requestDomains: ['facebook.com'], resourceTypes: ['main_frame'] },
    });
    expect(rules[1].id).toBe(2);
    expect(rules[1].condition.requestDomains).toEqual(['youtube.com']);
  });

  it('returns empty array for no domains', () => {
    expect(buildRedirectRules([])).toEqual([]);
  });

  it('assigns sequential ids starting at 1', () => {
    const rules = buildRedirectRules(['a.com', 'b.com', 'c.com']);
    expect(rules.map((r) => r.id)).toEqual([1, 2, 3]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- dnr-rules`
Expected: FAIL — `buildRedirectRules` not found.

- [ ] **Step 3: Implement**

```typescript
// lib/dnr-rules.ts

/** A DNR dynamic rule that redirects a domain's top-level navigation to the
 *  extension's blocked page. Typed loosely to avoid depending on chrome types. */
export interface RedirectRule {
  id: number;
  priority: number;
  action: { type: 'redirect'; redirect: { extensionPath: string } };
  condition: { requestDomains: string[]; resourceTypes: ['main_frame'] };
}

export const BLOCKED_PAGE_PATH = '/blocked.html';

/** Build sequential redirect rules (ids 1..N) for the given effective
 *  block domains. Caller is responsible for passing the already-filtered list
 *  (schedule active, temp-unblocks removed). */
export function buildRedirectRules(domains: string[]): RedirectRule[] {
  return domains.map((domain, i) => ({
    id: i + 1,
    priority: 1,
    action: { type: 'redirect', redirect: { extensionPath: BLOCKED_PAGE_PATH } },
    condition: { requestDomains: [domain], resourceTypes: ['main_frame'] },
  }));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- dnr-rules`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/dnr-rules.ts lib/dnr-rules.test.ts
git commit -m "feat: DNR redirect rule builder"
```

---

## Task 4: Pomodoro logic (pure)

**Files:**
- Create: `lib/pomodoro.ts`
- Test: `lib/pomodoro.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// lib/pomodoro.test.ts
import { describe, it, expect } from 'vitest';
import { nextPhase, remainingMs, DEFAULT_POMODORO } from './pomodoro';
import type { PomodoroState } from './types';

const base: PomodoroState = { workMinutes: 25, restMinutes: 5, phase: 'idle', phaseEndsAt: null };

describe('nextPhase', () => {
  it('idle -> work, sets phaseEndsAt 25min ahead', () => {
    const now = 1_000_000;
    const s = nextPhase(base, now);
    expect(s.phase).toBe('work');
    expect(s.phaseEndsAt).toBe(now + 25 * 60_000);
  });
  it('work -> rest, 5min ahead', () => {
    const now = 2_000_000;
    const s = nextPhase({ ...base, phase: 'work' }, now);
    expect(s.phase).toBe('rest');
    expect(s.phaseEndsAt).toBe(now + 5 * 60_000);
  });
  it('rest -> work, 25min ahead', () => {
    const now = 3_000_000;
    const s = nextPhase({ ...base, phase: 'rest' }, now);
    expect(s.phase).toBe('work');
    expect(s.phaseEndsAt).toBe(now + 25 * 60_000);
  });
  it('respects custom durations', () => {
    const s = nextPhase({ ...base, workMinutes: 50, phase: 'idle' }, 0);
    expect(s.phaseEndsAt).toBe(50 * 60_000);
  });
});

describe('remainingMs', () => {
  it('returns ms until phaseEndsAt, clamped at 0', () => {
    expect(remainingMs({ ...base, phase: 'work', phaseEndsAt: 5000 }, 1000)).toBe(4000);
    expect(remainingMs({ ...base, phase: 'work', phaseEndsAt: 1000 }, 5000)).toBe(0);
  });
  it('returns 0 when idle', () => {
    expect(remainingMs(base, 1000)).toBe(0);
  });
});

describe('DEFAULT_POMODORO', () => {
  it('is idle 25/5', () => {
    expect(DEFAULT_POMODORO).toEqual({ workMinutes: 25, restMinutes: 5, phase: 'idle', phaseEndsAt: null });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- pomodoro`
Expected: FAIL — exports not found.

- [ ] **Step 3: Implement**

```typescript
// lib/pomodoro.ts
import type { PomodoroState } from './types';

export const DEFAULT_POMODORO: PomodoroState = {
  workMinutes: 25,
  restMinutes: 5,
  phase: 'idle',
  phaseEndsAt: null,
};

/** Advance to the next phase. idle->work, work->rest, rest->work.
 *  Sets phaseEndsAt = now + duration of the new phase. */
export function nextPhase(state: PomodoroState, now: number): PomodoroState {
  const newPhase = state.phase === 'work' ? 'rest' : 'work';
  const minutes = newPhase === 'work' ? state.workMinutes : state.restMinutes;
  return { ...state, phase: newPhase, phaseEndsAt: now + minutes * 60_000 };
}

/** Milliseconds left in the current phase, clamped at 0; 0 when idle. */
export function remainingMs(state: PomodoroState, now: number): number {
  if (state.phase === 'idle' || state.phaseEndsAt == null) return 0;
  return Math.max(0, state.phaseEndsAt - now);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- pomodoro`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/pomodoro.ts lib/pomodoro.test.ts
git commit -m "feat: pomodoro state-machine logic"
```

---

## Task 5: Crypto (PBKDF2 + AES-GCM)

**Files:**
- Create: `lib/crypto.ts`
- Test: `lib/crypto.test.ts`

Notes: uses the global `crypto.subtle` (Web Crypto), available in both the SW and Vitest's Node environment (Node 18+). PBKDF2 iterations default 600_000 (OWASP 2023+ guidance for PBKDF2-HMAC-SHA256).

- [ ] **Step 1: Write the failing test**

```typescript
// lib/crypto.test.ts
import { describe, it, expect } from 'vitest';
import { hashPassword, verifyPassword, deriveKey, encrypt, decrypt } from './crypto';

describe('password hashing', () => {
  it('verifies a correct password and rejects a wrong one', async () => {
    const rec = await hashPassword('Correct-Horse-9!');
    expect(await verifyPassword('Correct-Horse-9!', rec)).toBe(true);
    expect(await verifyPassword('wrong', rec)).toBe(false);
  });
  it('uses a random salt (two hashes of same password differ)', async () => {
    const a = await hashPassword('Correct-Horse-9!');
    const b = await hashPassword('Correct-Horse-9!');
    expect(a.salt).not.toBe(b.salt);
    expect(a.hash).not.toBe(b.hash);
  });
});

describe('AES-GCM encrypt/decrypt', () => {
  it('round-trips plaintext with a password-derived key', async () => {
    const key = await deriveKey('Correct-Horse-9!', 'c2FsdHNhbHQ='); // base64 salt
    const payload = await encrypt('facebook.com', key);
    expect(payload.iv).toBeTruthy();
    expect(payload.ciphertext).not.toContain('facebook');
    expect(await decrypt(payload, key)).toBe('facebook.com');
  });
  it('fails to decrypt with the wrong key', async () => {
    const k1 = await deriveKey('Correct-Horse-9!', 'c2FsdHNhbHQ=');
    const k2 = await deriveKey('different-pass', 'c2FsdHNhbHQ=');
    const payload = await encrypt('secret.com', k1);
    await expect(decrypt(payload, k2)).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- crypto`
Expected: FAIL — exports not found.

- [ ] **Step 3: Implement**

```typescript
// lib/crypto.ts
import type { AuthRecord, EncryptedPayload } from './types';

const ITERATIONS = 600_000;
const enc = new TextEncoder();
const dec = new TextDecoder();

function toB64(buf: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buf)));
}
function fromB64(b64: string): Uint8Array {
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

async function pbkdf2Bits(password: string, salt: Uint8Array, iterations: number): Promise<ArrayBuffer> {
  const baseKey = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  return crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
    baseKey,
    256,
  );
}

/** Hash a new password with a fresh random salt. */
export async function hashPassword(password: string): Promise<AuthRecord> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const bits = await pbkdf2Bits(password, salt, ITERATIONS);
  return { hash: toB64(bits), salt: toB64(salt.buffer), iterations: ITERATIONS };
}

/** Constant-effort verification against a stored AuthRecord. */
export async function verifyPassword(password: string, rec: AuthRecord): Promise<boolean> {
  const bits = await pbkdf2Bits(password, fromB64(rec.salt), rec.iterations);
  return toB64(bits) === rec.hash;
}

/** Derive an AES-GCM key from the password + a base64 salt. */
export async function deriveKey(password: string, saltB64: string): Promise<CryptoKey> {
  const baseKey = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: fromB64(saltB64), iterations: ITERATIONS, hash: 'SHA-256' },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

export async function encrypt(plaintext: string, key: CryptoKey): Promise<EncryptedPayload> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(plaintext));
  return { iv: toB64(iv.buffer), ciphertext: toB64(ct) };
}

export async function decrypt(payload: EncryptedPayload, key: CryptoKey): Promise<string> {
  const pt = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: fromB64(payload.iv) },
    key,
    fromB64(payload.ciphertext),
  );
  return dec.decode(pt);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- crypto`
Expected: PASS (4 cases). The wrong-key case passes because AES-GCM raises an `OperationError` on a bad auth tag.

- [ ] **Step 5: Commit**

```bash
git add lib/crypto.ts lib/crypto.test.ts
git commit -m "feat: PBKDF2 password hashing and AES-GCM crypto"
```

---

## Task 6: Password policy (strong-password enforcement)

**Files:**
- Create: `lib/password-policy.ts`
- Test: `lib/password-policy.test.ts`

Requirement (from spec): min 12 chars, at least one each of upper/lower/digit/symbol, and zxcvbn score >= 3. Reject otherwise with specific messages.

- [ ] **Step 1: Write the failing test**

```typescript
// lib/password-policy.test.ts
import { describe, it, expect } from 'vitest';
import { checkPassword } from './password-policy';

describe('checkPassword', () => {
  it('rejects short passwords', () => {
    const r = checkPassword('Ab1!');
    expect(r.ok).toBe(false);
    expect(r.errors).toContain('Must be at least 12 characters');
  });
  it('rejects missing character classes', () => {
    const r = checkPassword('alllowercaseletters');
    expect(r.ok).toBe(false);
    expect(r.errors).toEqual(
      expect.arrayContaining([
        'Must include an uppercase letter',
        'Must include a digit',
        'Must include a symbol',
      ]),
    );
  });
  it('rejects a guessable password even if it meets char rules', () => {
    const r = checkPassword('Password1234!');
    expect(r.ok).toBe(false);
    expect(r.errors.some((e) => e.toLowerCase().includes('weak'))).toBe(true);
  });
  it('accepts a strong, long, varied password', () => {
    const r = checkPassword('vT7$mq!Lz29wPx');
    expect(r.ok).toBe(true);
    expect(r.errors).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- password-policy`
Expected: FAIL — `checkPassword` not found.

- [ ] **Step 3: Implement**

```typescript
// lib/password-policy.ts
import { zxcvbn, zxcvbnOptions } from '@zxcvbn-ts/core';
import * as common from '@zxcvbn-ts/language-common';
import * as en from '@zxcvbn-ts/language-en';

let configured = false;
function configure(): void {
  if (configured) return;
  zxcvbnOptions.setOptions({
    translations: en.translations,
    graphs: common.adjacencyGraphs,
    dictionary: { ...common.dictionary, ...en.dictionary },
  });
  configured = true;
}

export interface PolicyResult {
  ok: boolean;
  errors: string[];
  /** zxcvbn score 0-4, exposed for a UI strength meter. */
  score: number;
}

const MIN_LENGTH = 12;
const MIN_SCORE = 3;

export function checkPassword(password: string): PolicyResult {
  configure();
  const errors: string[] = [];
  if (password.length < MIN_LENGTH) errors.push('Must be at least 12 characters');
  if (!/[A-Z]/.test(password)) errors.push('Must include an uppercase letter');
  if (!/[a-z]/.test(password)) errors.push('Must include a lowercase letter');
  if (!/[0-9]/.test(password)) errors.push('Must include a digit');
  if (!/[^A-Za-z0-9]/.test(password)) errors.push('Must include a symbol');

  const { score, feedback } = zxcvbn(password);
  if (score < MIN_SCORE) {
    const hint = feedback.warning || feedback.suggestions[0] || 'too guessable';
    errors.push(`Password is too weak: ${hint}`);
  }
  return { ok: errors.length === 0, errors, score };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- password-policy`
Expected: PASS. If `'vT7$mq!Lz29wPx'` happens to score < 3 in the installed zxcvbn version, replace the test password with another random 14-char string that scores >= 3 and re-run; do not lower `MIN_SCORE`.

- [ ] **Step 5: Commit**

```bash
git add lib/password-policy.ts lib/password-policy.test.ts
git commit -m "feat: strong-password policy with zxcvbn"
```

---

## Task 7: Storage layer

**Files:**
- Create: `lib/storage.ts`
- Test: `lib/storage.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// lib/storage.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { blocklistItem, scheduleItem, pomodoroItem, tempUnblocksItem, authItem } from './storage';
import { DEFAULT_SCHEDULE } from './schedule';
import { DEFAULT_POMODORO } from './pomodoro';

describe('storage items', () => {
  beforeEach(() => fakeBrowser.reset());

  it('blocklist defaults to empty array', async () => {
    expect(await blocklistItem.getValue()).toEqual([]);
  });
  it('schedule defaults to DEFAULT_SCHEDULE', async () => {
    expect(await scheduleItem.getValue()).toEqual(DEFAULT_SCHEDULE);
  });
  it('pomodoro defaults to DEFAULT_POMODORO', async () => {
    expect(await pomodoroItem.getValue()).toEqual(DEFAULT_POMODORO);
  });
  it('tempUnblocks defaults to empty array', async () => {
    expect(await tempUnblocksItem.getValue()).toEqual([]);
  });
  it('auth defaults to null', async () => {
    expect(await authItem.getValue()).toBeNull();
  });
  it('round-trips a blocklist write', async () => {
    await blocklistItem.setValue([{ id: 'a', domain: 'facebook.com', masked: false }]);
    expect(await blocklistItem.getValue()).toEqual([{ id: 'a', domain: 'facebook.com', masked: false }]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- storage`
Expected: FAIL — storage items not found.

- [ ] **Step 3: Implement**

```typescript
// lib/storage.ts
import { storage } from '#imports';
import type { AuthRecord, BlockEntry, PomodoroState, ScheduleWindow, TempUnblock } from './types';
import { DEFAULT_SCHEDULE } from './schedule';
import { DEFAULT_POMODORO } from './pomodoro';

export const blocklistItem = storage.defineItem<BlockEntry[]>('local:blocklist', {
  fallback: [],
});

export const scheduleItem = storage.defineItem<ScheduleWindow[]>('local:schedule', {
  fallback: DEFAULT_SCHEDULE,
});

export const pomodoroItem = storage.defineItem<PomodoroState>('local:pomodoro', {
  fallback: DEFAULT_POMODORO,
});

export const tempUnblocksItem = storage.defineItem<TempUnblock[]>('local:tempUnblocks', {
  fallback: [],
});

export const authItem = storage.defineItem<AuthRecord | null>('local:auth', {
  fallback: null,
});

/** Default minutes a password-granted unblock lasts. */
export const unblockMinutesItem = storage.defineItem<number>('local:unblockMinutes', {
  fallback: 5,
});
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- storage`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/storage.ts lib/storage.test.ts
git commit -m "feat: typed storage items"
```

---

## Task 8: Message contract

**Files:**
- Create: `lib/messages.ts`

These constants are the runtime-message contract between entrypoints and the background worker. No test (constants only); they are exercised by later integration.

- [ ] **Step 1: Implement**

```typescript
// lib/messages.ts

/** Messages sent TO the background worker. */
export type BgMessage =
  | { type: 'SYNC_BLOCKER' }                               // recompute + apply DNR rules now
  | { type: 'GRANT_UNBLOCK'; domain: string }              // add temp unblock then resync
  | { type: 'POMODORO_START' }
  | { type: 'POMODORO_STOP' };

/** Messages sent TO the offscreen document. */
export type OffscreenMessage = { type: 'PLAY_SOUND'; sound: 'work-start' | 'rest-start' };

export async function sendBg(msg: BgMessage): Promise<void> {
  await browser.runtime.sendMessage(msg);
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npm run compile`
Expected: exits 0.

- [ ] **Step 3: Commit**

```bash
git add lib/messages.ts
git commit -m "feat: runtime message contract"
```

---

## Task 9: Blocker controller (schedule eval -> DNR sync)

**Files:**
- Create: `lib/blocker-controller.ts`
- Test: `lib/blocker-controller.test.ts`

This is the impure orchestrator. It reads storage, decides the effective block-domain list, and calls `browser.declarativeNetRequest.updateDynamicRules`. `fakeBrowser` provides `declarativeNetRequest` with in-memory dynamic rules.

- [ ] **Step 1: Write the failing test**

```typescript
// lib/blocker-controller.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { syncBlocker, pruneExpired } from './blocker-controller';
import { blocklistItem, scheduleItem, tempUnblocksItem } from './storage';

// Force a known "now": a Monday 10:30 (inside default morning window).
const MON_1030 = new Date(2026, 5, 8, 10, 30).getTime();

describe('syncBlocker', () => {
  beforeEach(async () => {
    fakeBrowser.reset();
    vi.spyOn(Date, 'now').mockReturnValue(MON_1030);
    await blocklistItem.setValue([
      { id: '1', domain: 'facebook.com', masked: false },
      { id: '2', domain: 'youtube.com', masked: false },
    ]);
  });

  it('applies redirect rules for all blocked domains during an active window', async () => {
    await syncBlocker();
    const rules = await fakeBrowser.declarativeNetRequest.getDynamicRules();
    expect(rules.map((r) => r.condition.requestDomains?.[0]).sort()).toEqual(['facebook.com', 'youtube.com']);
  });

  it('clears all rules outside an active window', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(new Date(2026, 5, 8, 12, 30).getTime()); // lunch gap
    await syncBlocker();
    expect(await fakeBrowser.declarativeNetRequest.getDynamicRules()).toEqual([]);
  });

  it('excludes a domain with an active temp unblock', async () => {
    await tempUnblocksItem.setValue([{ domain: 'facebook.com', expiresAt: MON_1030 + 60_000 }]);
    await syncBlocker();
    const rules = await fakeBrowser.declarativeNetRequest.getDynamicRules();
    expect(rules.map((r) => r.condition.requestDomains?.[0])).toEqual(['youtube.com']);
  });

  it('ignores an expired temp unblock', async () => {
    await tempUnblocksItem.setValue([{ domain: 'facebook.com', expiresAt: MON_1030 - 1 }]);
    await syncBlocker();
    const rules = await fakeBrowser.declarativeNetRequest.getDynamicRules();
    expect(rules.map((r) => r.condition.requestDomains?.[0]).sort()).toEqual(['facebook.com', 'youtube.com']);
  });
});

describe('pruneExpired', () => {
  it('removes only expired temp unblocks', async () => {
    fakeBrowser.reset();
    vi.spyOn(Date, 'now').mockReturnValue(1000);
    await tempUnblocksItem.setValue([
      { domain: 'a.com', expiresAt: 500 },
      { domain: 'b.com', expiresAt: 5000 },
    ]);
    await pruneExpired();
    expect(await tempUnblocksItem.getValue()).toEqual([{ domain: 'b.com', expiresAt: 5000 }]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- blocker-controller`
Expected: FAIL — exports not found.

- [ ] **Step 3: Implement**

```typescript
// lib/blocker-controller.ts
import { blocklistItem, scheduleItem, tempUnblocksItem } from './storage';
import { isBlockingActive } from './schedule';
import { buildRedirectRules } from './dnr-rules';

/** Drop expired temp unblocks, persisting the pruned list. Returns the live set of domains. */
export async function pruneExpired(): Promise<Set<string>> {
  const now = Date.now();
  const all = await tempUnblocksItem.getValue();
  const live = all.filter((u) => u.expiresAt > now);
  if (live.length !== all.length) await tempUnblocksItem.setValue(live);
  return new Set(live.map((u) => u.domain));
}

/** Recompute the effective block list and replace all dynamic rules. */
export async function syncBlocker(): Promise<void> {
  const now = Date.now();
  const liveUnblocks = await pruneExpired();
  const schedule = await scheduleItem.getValue();

  let domains: string[] = [];
  if (isBlockingActive(schedule, now)) {
    const blocklist = await blocklistItem.getValue();
    // NOTE: masked entries are excluded here because their `domain` field is
    // ciphertext, not a real domain. Masked-domain blocking is handled in Task 14.
    domains = blocklist
      .filter((e) => !e.masked && !liveUnblocks.has(e.domain))
      .map((e) => e.domain);
  }

  const addRules = buildRedirectRules(domains);
  // Replace strategy: remove every existing dynamic rule, then add the fresh set.
  const existing = await browser.declarativeNetRequest.getDynamicRules();
  await browser.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: existing.map((r) => r.id),
    addRules: addRules as unknown as chrome.declarativeNetRequest.Rule[],
  });
}

/** Add a temp unblock for `domain` lasting `minutes`, then resync. */
export async function grantUnblock(domain: string, minutes: number): Promise<void> {
  const list = await tempUnblocksItem.getValue();
  const expiresAt = Date.now() + minutes * 60_000;
  const next = [...list.filter((u) => u.domain !== domain), { domain, expiresAt }];
  await tempUnblocksItem.setValue(next);
  await syncBlocker();
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- blocker-controller`
Expected: PASS (5 cases). If `fakeBrowser.declarativeNetRequest.getDynamicRules` is unavailable in the installed WXT version, mock it: `vi.spyOn(browser.declarativeNetRequest, 'updateDynamicRules')` and assert the call args instead — but try the real fake first.

- [ ] **Step 5: Commit**

```bash
git add lib/blocker-controller.ts lib/blocker-controller.test.ts
git commit -m "feat: blocker controller syncing DNR rules"
```

---

## Task 10: Pomodoro controller (alarm + audio + notification)

**Files:**
- Create: `lib/pomodoro-controller.ts`
- Test: `lib/pomodoro-controller.test.ts`

Behavior: `startPomodoro` moves idle->work and schedules a one-shot alarm at `phaseEndsAt`. `onPhaseAlarm` advances the phase, plays the matching sound, shows a notification, and reschedules the next alarm. `stopPomodoro` clears the alarm and resets to idle.

- [ ] **Step 1: Write the failing test**

```typescript
// lib/pomodoro-controller.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { startPomodoro, stopPomodoro, onPhaseAlarm, POMODORO_ALARM } from './pomodoro-controller';
import { pomodoroItem } from './storage';

describe('pomodoro controller', () => {
  beforeEach(() => {
    fakeBrowser.reset();
    vi.spyOn(Date, 'now').mockReturnValue(1_000_000);
  });

  it('start moves idle->work and creates a one-shot alarm at phaseEndsAt', async () => {
    await startPomodoro();
    const state = await pomodoroItem.getValue();
    expect(state.phase).toBe('work');
    expect(state.phaseEndsAt).toBe(1_000_000 + 25 * 60_000);
    const alarm = await fakeBrowser.alarms.get(POMODORO_ALARM);
    expect(alarm?.scheduledTime).toBe(state.phaseEndsAt);
  });

  it('phase alarm advances work->rest and reschedules', async () => {
    await startPomodoro();                       // work
    vi.spyOn(Date, 'now').mockReturnValue(2_000_000);
    await onPhaseAlarm();                         // -> rest
    const state = await pomodoroItem.getValue();
    expect(state.phase).toBe('rest');
    expect(state.phaseEndsAt).toBe(2_000_000 + 5 * 60_000);
    const alarm = await fakeBrowser.alarms.get(POMODORO_ALARM);
    expect(alarm?.scheduledTime).toBe(state.phaseEndsAt);
  });

  it('stop clears the alarm and returns to idle', async () => {
    await startPomodoro();
    await stopPomodoro();
    const state = await pomodoroItem.getValue();
    expect(state.phase).toBe('idle');
    expect(state.phaseEndsAt).toBeNull();
    expect(await fakeBrowser.alarms.get(POMODORO_ALARM)).toBeFalsy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- pomodoro-controller`
Expected: FAIL — exports not found.

- [ ] **Step 3: Implement**

```typescript
// lib/pomodoro-controller.ts
import { pomodoroItem } from './storage';
import { nextPhase, DEFAULT_POMODORO } from './pomodoro';
import type { OffscreenMessage } from './messages';

export const POMODORO_ALARM = 'pomodoro-phase-end';
const OFFSCREEN_URL = 'offscreen.html';

async function scheduleAlarm(at: number): Promise<void> {
  await browser.alarms.create(POMODORO_ALARM, { when: at });
}

/** idle -> work, persist, schedule the phase-end alarm. */
export async function startPomodoro(): Promise<void> {
  const current = await pomodoroItem.getValue();
  const started = nextPhase({ ...current, phase: 'idle' }, Date.now());
  await pomodoroItem.setValue(started);
  if (started.phaseEndsAt) await scheduleAlarm(started.phaseEndsAt);
}

/** Reset to idle, clear the alarm. */
export async function stopPomodoro(): Promise<void> {
  const current = await pomodoroItem.getValue();
  await pomodoroItem.setValue({ ...current, phase: 'idle', phaseEndsAt: null });
  await browser.alarms.clear(POMODORO_ALARM);
}

/** Called when the phase-end alarm fires: advance, alert, reschedule. */
export async function onPhaseAlarm(): Promise<void> {
  const current = await pomodoroItem.getValue();
  if (current.phase === 'idle') return;
  const advanced = nextPhase(current, Date.now());
  await pomodoroItem.setValue(advanced);
  await alert(advanced.phase === 'work' ? 'work-start' : 'rest-start');
  if (advanced.phaseEndsAt) await scheduleAlarm(advanced.phaseEndsAt);
}

async function alert(sound: 'work-start' | 'rest-start'): Promise<void> {
  await showNotification(sound);
  await playSound(sound);
}

async function showNotification(sound: 'work-start' | 'rest-start'): Promise<void> {
  const isWork = sound === 'work-start';
  await browser.notifications.create({
    type: 'basic',
    iconUrl: browser.runtime.getURL('/icon/128.png'),
    title: isWork ? 'Back to work' : 'Time to rest',
    message: isWork ? 'Work session started.' : 'Take a short break.',
  });
}

async function playSound(sound: 'work-start' | 'rest-start'): Promise<void> {
  if (!(await browser.offscreen.hasDocument())) {
    await browser.offscreen.createDocument({
      url: OFFSCREEN_URL,
      reasons: ['AUDIO_PLAYBACK'],
      justification: 'Play Pomodoro session-change alarm',
    });
  }
  const msg: OffscreenMessage = { type: 'PLAY_SOUND', sound };
  await browser.runtime.sendMessage(msg);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- pomodoro-controller`
Expected: PASS (3 cases). `fakeBrowser` stubs `notifications`/`offscreen`; if `offscreen` is missing in the fake, guard the test by spying: `vi.spyOn(browser.offscreen, 'hasDocument').mockResolvedValue(true)` so `playSound` only sends a message. Try the fake first.

- [ ] **Step 5: Commit**

```bash
git add lib/pomodoro-controller.ts lib/pomodoro-controller.test.ts
git commit -m "feat: pomodoro controller with alarm, notification, audio"
```

---

## Task 11: Background service worker

**Files:**
- Create: `entrypoints/background.ts`

Wires alarms and runtime messages to the controllers. No automated test (thin glue exercised manually); logic is in tested controllers.

- [ ] **Step 1: Implement**

```typescript
// entrypoints/background.ts
import { syncBlocker } from '@/lib/blocker-controller';
import { onPhaseAlarm, startPomodoro, stopPomodoro, POMODORO_ALARM } from '@/lib/pomodoro-controller';
import { grantUnblock } from '@/lib/blocker-controller';
import { unblockMinutesItem } from '@/lib/storage';
import type { BgMessage } from '@/lib/messages';

const SCHEDULER_ALARM = 'blocker-scheduler';

export default defineBackground(() => {
  // Run once on SW startup and install.
  void syncBlocker();

  // Recurring 1-minute scheduler tick.
  browser.alarms.create(SCHEDULER_ALARM, { periodInMinutes: 1 });

  browser.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === SCHEDULER_ALARM) void syncBlocker();
    else if (alarm.name === POMODORO_ALARM) void onPhaseAlarm();
  });

  browser.runtime.onMessage.addListener((message: BgMessage) => {
    // Return a promise so callers can await completion.
    switch (message.type) {
      case 'SYNC_BLOCKER':
        return syncBlocker();
      case 'GRANT_UNBLOCK':
        return unblockMinutesItem.getValue().then((m) => grantUnblock(message.domain, m));
      case 'POMODORO_START':
        return startPomodoro();
      case 'POMODORO_STOP':
        return stopPomodoro();
    }
  });
});
```

- [ ] **Step 2: Verify it compiles**

Run: `npm run compile`
Expected: exits 0. (Note: `@/` resolves to repo root via WXT's generated tsconfig paths; if compile complains, use relative `../lib/...` imports instead.)

- [ ] **Step 3: Commit**

```bash
git add entrypoints/background.ts
git commit -m "feat: background worker wiring alarms and messages"
```

---

## Task 12: Offscreen audio document

**Files:**
- Create: `entrypoints/offscreen/index.html`, `entrypoints/offscreen/main.ts`
- Create: `public/sounds/work-start.mp3`, `public/sounds/rest-start.mp3`

- [ ] **Step 1: Add sound assets**

Place two short (1-2s) mp3 files at `public/sounds/work-start.mp3` and `public/sounds/rest-start.mp3`. If you do not have assets yet, generate placeholders, e.g.:

```bash
mkdir -p public/sounds
# Requires ffmpeg; produces a 1s sine beep as a placeholder.
ffmpeg -f lavfi -i "sine=frequency=880:duration=1" public/sounds/work-start.mp3
ffmpeg -f lavfi -i "sine=frequency=440:duration=1" public/sounds/rest-start.mp3
```

If `ffmpeg` is unavailable, drop any two short mp3 files at those exact paths.

- [ ] **Step 2: Create `entrypoints/offscreen/index.html`**

```html
<!doctype html>
<html>
  <head><meta charset="utf-8" /></head>
  <body>
    <script type="module" src="./main.ts"></script>
  </body>
</html>
```

- [ ] **Step 3: Create `entrypoints/offscreen/main.ts`**

```typescript
import type { OffscreenMessage } from '@/lib/messages';

browser.runtime.onMessage.addListener((msg: OffscreenMessage) => {
  if (msg.type !== 'PLAY_SOUND') return;
  const url = browser.runtime.getURL(`/sounds/${msg.sound}.mp3`);
  const audio = new Audio(url);
  void audio.play();
});
```

- [ ] **Step 4: Verify it builds**

Run: `npm run build`
Expected: build succeeds; `.output/chrome-mv3/offscreen.html` and `sounds/` exist in the output.

- [ ] **Step 5: Commit**

```bash
git add entrypoints/offscreen public/sounds
git commit -m "feat: offscreen audio document and sound assets"
```

---

## Task 13: Blocked page + unblock flow (Svelte)

**Files:**
- Create: `entrypoints/blocked/index.html`, `entrypoints/blocked/main.ts`, `entrypoints/blocked/App.svelte`

Unblock flow (spec, "moderately strict"): show blocked message -> "Unblock" button -> confirm checkbox -> 30s countdown (input disabled) -> password field -> on correct password, send `GRANT_UNBLOCK` and navigate to the originally requested site.

Note on the original URL: a DNR redirect to an extension page does not preserve the source URL in the address bar. Resolve the intended domain from `document.referrer` when present; otherwise show a domain picker listing currently-blocked domains so the user chooses which to unblock. Keep it simple: read referrer host, fall back to a text input.

- [ ] **Step 1: Create `entrypoints/blocked/index.html`**

```html
<!doctype html>
<html>
  <head><meta charset="utf-8" /><title>Blocked</title></head>
  <body>
    <div id="app"></div>
    <script type="module" src="./main.ts"></script>
  </body>
</html>
```

- [ ] **Step 2: Create `entrypoints/blocked/main.ts`**

```typescript
import { mount } from 'svelte';
import App from './App.svelte';

mount(App, { target: document.getElementById('app')! });
```

- [ ] **Step 3: Create `entrypoints/blocked/App.svelte`**

```svelte
<script lang="ts">
  import { authItem } from '@/lib/storage';
  import { verifyPassword } from '@/lib/crypto';
  import { sendBg } from '@/lib/messages';

  // Best-effort guess of which domain the user was heading to.
  function referrerHost(): string {
    try {
      return document.referrer ? new URL(document.referrer).hostname.replace(/^www\./, '') : '';
    } catch {
      return '';
    }
  }

  let domain = $state(referrerHost());
  let confirmed = $state(false);
  let countdown = $state(0);
  let password = $state('');
  let error = $state('');
  let busy = $state(false);

  const WAIT_SECONDS = 30;

  function startCountdown() {
    confirmed = true;
    countdown = WAIT_SECONDS;
    const id = setInterval(() => {
      countdown -= 1;
      if (countdown <= 0) clearInterval(id);
    }, 1000);
  }

  async function submit() {
    error = '';
    if (!domain) { error = 'Enter the domain to unblock'; return; }
    busy = true;
    try {
      const auth = await authItem.getValue();
      if (!auth) { error = 'No password set. Set one in extension options.'; return; }
      const ok = await verifyPassword(password, auth);
      if (!ok) { error = 'Wrong password'; return; }
      await sendBg({ type: 'GRANT_UNBLOCK', domain: domain.replace(/^www\./, '') });
      // Navigate to the now-unblocked site.
      window.location.href = `https://${domain}`;
    } finally {
      busy = false;
    }
  }
</script>

<main>
  <h1>This site is blocked</h1>
  <p>Blocking is active right now per your schedule.</p>

  <label>Domain
    <input bind:value={domain} placeholder="facebook.com" />
  </label>

  {#if !confirmed}
    <button onclick={startCountdown}>I really need to unblock this</button>
  {:else if countdown > 0}
    <p>Wait {countdown}s before you can unblock…</p>
  {:else}
    <label>Password
      <input type="password" bind:value={password} />
    </label>
    <button onclick={submit} disabled={busy}>Unblock temporarily</button>
  {/if}

  {#if error}<p class="error">{error}</p>{/if}
</main>

<style>
  main { max-width: 28rem; margin: 4rem auto; font-family: system-ui; }
  .error { color: #c0392b; }
  label { display: block; margin: 0.75rem 0; }
  input { display: block; width: 100%; padding: 0.5rem; }
</style>
```

- [ ] **Step 4: Verify it builds**

Run: `npm run build`
Expected: build succeeds; `.output/chrome-mv3/blocked.html` exists.

- [ ] **Step 5: Commit**

```bash
git add entrypoints/blocked
git commit -m "feat: blocked page with 30s-delay password unblock flow"
```

---

## Task 14: Masked-entry encryption helper

**Files:**
- Create: `lib/masking.ts`
- Test: `lib/masking.test.ts`

Provides reveal/encrypt helpers used by the options UI. A masked `BlockEntry` stores `JSON.stringify(EncryptedPayload)` in its `domain` field. To make masked domains actually block, `syncBlocker` needs them decrypted — but the worker has no password. Decision (documented here so it is explicit): masked domains are enforced only while the user has unlocked the session in the options page, which writes the decrypted domain into a session-only storage item `local:unmaskedDomains` (cleared on browser restart via `session:` area). Update `syncBlocker` to include these.

- [ ] **Step 1: Add a session storage item for unmasked domains**

Modify: `lib/storage.ts` — add:

```typescript
// Session-scoped: decrypted masked domains, cleared when the browser restarts.
export const unmaskedDomainsItem = storage.defineItem<string[]>('session:unmaskedDomains', {
  fallback: [],
});
```

- [ ] **Step 2: Write the failing test**

```typescript
// lib/masking.test.ts
import { describe, it, expect } from 'vitest';
import { maskDomain, revealEntry } from './masking';
import type { BlockEntry } from './types';
import { deriveKey } from './crypto';

describe('masking', () => {
  it('mask then reveal round-trips through an entry', async () => {
    const key = await deriveKey('Correct-Horse-9!', 'c2FsdHNhbHQ=');
    const entry: BlockEntry = { id: 'x', domain: await maskDomain('reddit.com', key), masked: true };
    expect(entry.domain).not.toContain('reddit');
    expect(await revealEntry(entry, key)).toBe('reddit.com');
  });

  it('revealEntry returns plaintext domain unchanged for non-masked entries', async () => {
    const key = await deriveKey('Correct-Horse-9!', 'c2FsdHNhbHQ=');
    const entry: BlockEntry = { id: 'y', domain: 'twitter.com', masked: false };
    expect(await revealEntry(entry, key)).toBe('twitter.com');
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npm test -- masking`
Expected: FAIL — exports not found.

- [ ] **Step 4: Implement**

```typescript
// lib/masking.ts
import type { BlockEntry, EncryptedPayload } from './types';
import { encrypt, decrypt } from './crypto';

/** Encrypt a domain into the string stored in a masked entry's `domain` field. */
export async function maskDomain(domain: string, key: CryptoKey): Promise<string> {
  const payload = await encrypt(domain, key);
  return JSON.stringify(payload);
}

/** Decrypt a masked entry's domain; pass-through for non-masked entries. */
export async function revealEntry(entry: BlockEntry, key: CryptoKey): Promise<string> {
  if (!entry.masked) return entry.domain;
  const payload = JSON.parse(entry.domain) as EncryptedPayload;
  return decrypt(payload, key);
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- masking`
Expected: PASS.

- [ ] **Step 6: Update `syncBlocker` to include unmasked session domains**

Modify: `lib/blocker-controller.ts`. Add the import and extend the domain computation inside the `isBlockingActive` branch:

```typescript
import { blocklistItem, scheduleItem, tempUnblocksItem, unmaskedDomainsItem } from './storage';
```

Replace the domain-building block with:

```typescript
  let domains: string[] = [];
  if (isBlockingActive(schedule, now)) {
    const blocklist = await blocklistItem.getValue();
    const unmasked = await unmaskedDomainsItem.getValue(); // decrypted masked domains for this session
    domains = blocklist
      .filter((e) => !e.masked)
      .map((e) => e.domain)
      .concat(unmasked)
      .filter((d) => !liveUnblocks.has(d));
  }
```

- [ ] **Step 7: Extend the blocker-controller test for masked domains**

Add to `lib/blocker-controller.test.ts` (inside the `syncBlocker` describe):

```typescript
  it('blocks session-unmasked domains during an active window', async () => {
    const { unmaskedDomainsItem } = await import('./storage');
    await unmaskedDomainsItem.setValue(['reddit.com']);
    await syncBlocker();
    const rules = await fakeBrowser.declarativeNetRequest.getDynamicRules();
    expect(rules.map((r) => r.condition.requestDomains?.[0])).toContain('reddit.com');
  });
```

- [ ] **Step 8: Run tests**

Run: `npm test -- masking blocker-controller`
Expected: PASS (masking 2 cases + blocker-controller 6 cases).

- [ ] **Step 9: Commit**

```bash
git add lib/masking.ts lib/masking.test.ts lib/storage.ts lib/blocker-controller.ts lib/blocker-controller.test.ts
git commit -m "feat: masked-entry encryption and session unmasking"
```

---

## Task 15: Options page (Svelte)

**Files:**
- Create: `entrypoints/options/index.html`, `main.ts`, `App.svelte`, `PasswordSetup.svelte`, `BlocklistEditor.svelte`, `ScheduleEditor.svelte`

This is the largest UI. Build it from focused child components. Each renders and saves one storage slice. The config-lock rule: while blocking is active, the blocklist and schedule editors are read-only until the user enters the password (which also unmasks masked entries for the session).

- [ ] **Step 1: Create `entrypoints/options/index.html`**

```html
<!doctype html>
<html>
  <head><meta charset="utf-8" /><title>Site Blocker Options</title></head>
  <body>
    <div id="app"></div>
    <script type="module" src="./main.ts"></script>
  </body>
</html>
```

- [ ] **Step 2: Create `entrypoints/options/main.ts`**

```typescript
import { mount } from 'svelte';
import App from './App.svelte';

mount(App, { target: document.getElementById('app')! });
```

- [ ] **Step 3: Create `PasswordSetup.svelte`**

```svelte
<script lang="ts">
  import { authItem } from '@/lib/storage';
  import { hashPassword } from '@/lib/crypto';
  import { checkPassword } from '@/lib/password-policy';

  let { onset = () => {} }: { onset?: () => void } = $props();

  let password = $state('');
  let confirm = $state('');
  let errors = $state<string[]>([]);
  let score = $state(0);
  let saved = $state(false);

  function onInput() {
    const r = checkPassword(password);
    errors = r.errors;
    score = r.score;
  }

  async function save() {
    const r = checkPassword(password);
    if (!r.ok) { errors = r.errors; return; }
    if (password !== confirm) { errors = ['Passwords do not match']; return; }
    await authItem.setValue(await hashPassword(password));
    saved = true;
    password = '';
    confirm = '';
    onset();
  }
</script>

<section>
  <h2>Master password</h2>
  <p>Set a strong password. It guards unblocking, editing during blocked hours, and masked sites.</p>
  <label>Password <input type="password" bind:value={password} oninput={onInput} /></label>
  <label>Confirm <input type="password" bind:value={confirm} /></label>
  <p>Strength: {score}/4</p>
  <ul>{#each errors as e}<li class="error">{e}</li>{/each}</ul>
  <button onclick={save} disabled={errors.length > 0 || !password}>Save password</button>
  {#if saved}<p>Password saved.</p>{/if}
</section>

<style>.error { color: #c0392b; }</style>
```

- [ ] **Step 4: Create `ScheduleEditor.svelte`**

```svelte
<script lang="ts">
  import { scheduleItem } from '@/lib/storage';
  import type { ScheduleWindow } from '@/lib/types';

  let { locked = false }: { locked?: boolean } = $props();

  let windows = $state<ScheduleWindow[]>([]);
  const DAYS = [['Mon',1],['Tue',2],['Wed',3],['Thu',4],['Fri',5],['Sat',6],['Sun',7]] as const;

  $effect(() => { void scheduleItem.getValue().then((w) => (windows = w)); });

  function addWindow() {
    windows = [...windows, { days: [1,2,3,4,5], start: '09:00', end: '12:00' }];
  }
  function removeWindow(i: number) { windows = windows.filter((_, idx) => idx !== i); }
  function toggleDay(i: number, day: number) {
    const w = windows[i];
    w.days = w.days.includes(day) ? w.days.filter((d) => d !== day) : [...w.days, day];
    windows = [...windows];
  }
  async function save() { await scheduleItem.setValue(windows); }
</script>

<section>
  <h2>Schedule</h2>
  {#each windows as w, i}
    <div class="row">
      {#each DAYS as [label, day]}
        <label><input type="checkbox" checked={w.days.includes(day)} disabled={locked} onchange={() => toggleDay(i, day)} />{label}</label>
      {/each}
      <input type="time" bind:value={w.start} disabled={locked} />
      <input type="time" bind:value={w.end} disabled={locked} />
      <button onclick={() => removeWindow(i)} disabled={locked}>Remove</button>
    </div>
  {/each}
  <button onclick={addWindow} disabled={locked}>Add window</button>
  <button onclick={save} disabled={locked}>Save schedule</button>
</section>

<style>.row { display: flex; gap: 0.5rem; align-items: center; margin: 0.5rem 0; flex-wrap: wrap; }</style>
```

- [ ] **Step 5: Create `BlocklistEditor.svelte`**

```svelte
<script lang="ts">
  import { blocklistItem, unmaskedDomainsItem } from '@/lib/storage';
  import { revealEntry, maskDomain } from '@/lib/masking';
  import type { BlockEntry } from '@/lib/types';

  let { locked = false, cryptoKey = null }: { locked?: boolean; cryptoKey?: CryptoKey | null } = $props();

  let entries = $state<BlockEntry[]>([]);
  let revealed = $state<Record<string, string>>({});
  let newDomain = $state('');
  let newMasked = $state(false);

  $effect(() => { void load(); });

  async function load() {
    entries = await blocklistItem.getValue();
    if (cryptoKey) {
      const map: Record<string, string> = {};
      for (const e of entries) map[e.id] = await revealEntry(e, cryptoKey);
      revealed = map;
      await unmaskedDomainsItem.setValue(
        entries.filter((e) => e.masked).map((e) => map[e.id]),
      );
    }
  }

  function display(e: BlockEntry): string {
    if (!e.masked) return e.domain;
    return revealed[e.id] ?? '•••• (locked)';
  }

  async function add() {
    const domain = newDomain.trim().replace(/^www\./, '');
    if (!domain) return;
    const id = crypto.randomUUID();
    let stored = domain;
    if (newMasked) {
      if (!cryptoKey) return; // must unlock to add masked entries
      stored = await maskDomain(domain, cryptoKey);
    }
    entries = [...entries, { id, domain: stored, masked: newMasked }];
    await blocklistItem.setValue(entries);
    newDomain = '';
    newMasked = false;
    await load();
  }

  async function remove(id: string) {
    entries = entries.filter((e) => e.id !== id);
    await blocklistItem.setValue(entries);
    await load();
  }
</script>

<section>
  <h2>Blocked sites</h2>
  <ul>
    {#each entries as e}
      <li>
        {display(e)} {#if e.masked}<em>(masked)</em>{/if}
        <button onclick={() => remove(e.id)} disabled={locked || (e.masked && !cryptoKey)}>Remove</button>
      </li>
    {/each}
  </ul>
  <input bind:value={newDomain} placeholder="facebook.com" disabled={locked} />
  <label><input type="checkbox" bind:checked={newMasked} disabled={locked || !cryptoKey} /> Masked</label>
  <button onclick={add} disabled={locked}>Add</button>
</section>
```

- [ ] **Step 6: Create `App.svelte` (ties it together with the config lock)**

```svelte
<script lang="ts">
  import PasswordSetup from './PasswordSetup.svelte';
  import ScheduleEditor from './ScheduleEditor.svelte';
  import BlocklistEditor from './BlocklistEditor.svelte';
  import { authItem, scheduleItem } from '@/lib/storage';
  import { verifyPassword, deriveKey } from '@/lib/crypto';
  import { isBlockingActive } from '@/lib/schedule';
  import { sendBg } from '@/lib/messages';

  let hasPassword = $state(false);
  let blockingNow = $state(false);
  let unlocked = $state(false);
  let cryptoKey = $state<CryptoKey | null>(null);
  let pw = $state('');
  let unlockError = $state('');

  $effect(() => { void init(); });

  async function init() {
    hasPassword = (await authItem.getValue()) != null;
    blockingNow = isBlockingActive(await scheduleItem.getValue(), Date.now());
  }

  // Editing is locked when blocking is active and the session is not unlocked.
  const locked = $derived(blockingNow && !unlocked);

  async function unlock() {
    unlockError = '';
    const auth = await authItem.getValue();
    if (!auth) return;
    if (!(await verifyPassword(pw, auth))) { unlockError = 'Wrong password'; return; }
    cryptoKey = await deriveKey(pw, auth.salt);
    unlocked = true;
    pw = '';
    await sendBg({ type: 'SYNC_BLOCKER' }); // re-apply rules now that masked domains are revealed
  }
</script>

<main>
  <h1>Site Blocker</h1>

  {#if !hasPassword}
    <PasswordSetup onset={init} />
  {:else}
    {#if locked}
      <section class="lock">
        <p>Blocking is active. Enter your password to edit settings or reveal masked sites.</p>
        <input type="password" bind:value={pw} />
        <button onclick={unlock}>Unlock</button>
        {#if unlockError}<p class="error">{unlockError}</p>{/if}
      </section>
    {:else if !unlocked}
      <section class="lock">
        <p>Enter your password to reveal masked sites (optional).</p>
        <input type="password" bind:value={pw} />
        <button onclick={unlock}>Unlock masked</button>
        {#if unlockError}<p class="error">{unlockError}</p>{/if}
      </section>
    {/if}

    <ScheduleEditor {locked} />
    <BlocklistEditor {locked} {cryptoKey} />
  {/if}
</main>

<style>
  main { max-width: 40rem; margin: 2rem auto; font-family: system-ui; }
  .lock { background: #fff3cd; padding: 1rem; border-radius: 6px; }
  .error { color: #c0392b; }
</style>
```

- [ ] **Step 7: Verify it builds**

Run: `npm run build`
Expected: build succeeds; `.output/chrome-mv3/options.html` exists.

- [ ] **Step 8: Commit**

```bash
git add entrypoints/options
git commit -m "feat: options page with config lock, schedule, blocklist, masking"
```

---

## Task 16: Popup (Pomodoro timer + status, Svelte)

**Files:**
- Create: `entrypoints/popup/index.html`, `main.ts`, `App.svelte`

- [ ] **Step 1: Create `entrypoints/popup/index.html`**

```html
<!doctype html>
<html>
  <head><meta charset="utf-8" /><title>Site Blocker</title></head>
  <body>
    <div id="app"></div>
    <script type="module" src="./main.ts"></script>
  </body>
</html>
```

- [ ] **Step 2: Create `entrypoints/popup/main.ts`**

```typescript
import { mount } from 'svelte';
import App from './App.svelte';

mount(App, { target: document.getElementById('app')! });
```

- [ ] **Step 3: Create `entrypoints/popup/App.svelte`**

```svelte
<script lang="ts">
  import { pomodoroItem, scheduleItem } from '@/lib/storage';
  import { remainingMs } from '@/lib/pomodoro';
  import { isBlockingActive } from '@/lib/schedule';
  import { sendBg } from '@/lib/messages';
  import type { PomodoroState } from '@/lib/types';

  let state = $state<PomodoroState | null>(null);
  let now = $state(Date.now());
  let blockingNow = $state(false);

  // Keep state in sync with storage and tick the clock every second.
  $effect(() => {
    const unwatch = pomodoroItem.watch((v) => (state = v));
    void pomodoroItem.getValue().then((v) => (state = v));
    void scheduleItem.getValue().then((s) => (blockingNow = isBlockingActive(s, Date.now())));
    const id = setInterval(() => (now = Date.now()), 1000);
    return () => { unwatch(); clearInterval(id); };
  });

  const remaining = $derived(state ? remainingMs(state, now) : 0);
  const mmss = $derived(() => {
    const total = Math.ceil(remaining / 1000);
    const m = String(Math.floor(total / 60)).padStart(2, '0');
    const s = String(total % 60).padStart(2, '0');
    return `${m}:${s}`;
  });

  function openOptions() { browser.runtime.openOptionsPage(); }
</script>

<main>
  <p>Blocking: <strong>{blockingNow ? 'ON (scheduled)' : 'off'}</strong></p>

  <section>
    <h2>Pomodoro</h2>
    {#if state && state.phase !== 'idle'}
      <p class="phase">{state.phase === 'work' ? 'Work' : 'Rest'}</p>
      <p class="time">{mmss()}</p>
      <button onclick={() => sendBg({ type: 'POMODORO_STOP' })}>Stop</button>
    {:else}
      <button onclick={() => sendBg({ type: 'POMODORO_START' })}>Start</button>
    {/if}
  </section>

  <button onclick={openOptions}>Settings</button>
</main>

<style>
  main { width: 16rem; padding: 1rem; font-family: system-ui; }
  .phase { text-transform: uppercase; letter-spacing: 0.1em; color: #555; }
  .time { font-size: 2.5rem; font-variant-numeric: tabular-nums; margin: 0.25rem 0; }
</style>
```

- [ ] **Step 4: Verify it builds**

Run: `npm run build`
Expected: build succeeds; `.output/chrome-mv3/popup.html` exists.

- [ ] **Step 5: Commit**

```bash
git add entrypoints/popup
git commit -m "feat: popup with live Pomodoro timer and block status"
```

---

## Task 17: Full test + build gate

**Files:** none (verification task)

- [ ] **Step 1: Run the whole test suite**

Run: `npm test`
Expected: all suites PASS (schedule, dnr-rules, pomodoro, crypto, password-policy, storage, blocker-controller, pomodoro-controller, masking).

- [ ] **Step 2: Type-check**

Run: `npm run compile`
Expected: exits 0.

- [ ] **Step 3: Production build**

Run: `npm run build`
Expected: `.output/chrome-mv3/` contains `manifest.json`, `background.js`, `popup.html`, `options.html`, `blocked.html`, `offscreen.html`, `sounds/`, `icon/`.

- [ ] **Step 4: Commit any fixes, then tag the milestone**

```bash
git add -A
git commit -m "test: green suite and successful MV3 build"
```

---

## Task 18: Manual verification in Chrome

**Files:** none (manual QA — record results, do not skip).

- [ ] **Step 1: Launch dev mode**

Run: `npm run dev`
WXT opens a Chrome instance with the extension loaded (or load `.output/chrome-mv3` via `chrome://extensions` > Developer mode > Load unpacked).

- [ ] **Step 2: Set a master password** in the options page; confirm weak passwords are rejected with messages and a strong one saves.

- [ ] **Step 3: Add `facebook.com` to the blocklist** (non-masked). Set a schedule window covering the current time. Visit `https://facebook.com` — expect a redirect to the blocked page.

- [ ] **Step 4: Unblock flow** — on the blocked page, click unblock, confirm, wait 30s, enter the correct password; expect navigation to the site and that it stays reachable for the configured minutes. Re-test with a wrong password (expect explicit error, no unblock).

- [ ] **Step 5: Config lock** — during an active window, confirm the options editors are disabled until the password is entered.

- [ ] **Step 6: Masked entry** — unlock, add a masked domain, confirm it shows `(masked)`/`••••` when locked and blocks while unmasked in-session.

- [ ] **Step 7: Pomodoro** — start from the popup; confirm the countdown ticks, and at phase end you get a notification + sound and the phase flips. Set short durations (e.g. 1 min) in options to test quickly. Stop returns to idle.

- [ ] **Step 8: Schedule edge** — set a window that ends in ~1 minute; confirm the 1-minute scheduler tick removes the block when the window closes.

- [ ] **Step 9: Record results** in the PR/commit description: which steps passed, any deviations.

---

## Self-review notes (coverage vs spec)

- Feature 1 (block on schedule): Tasks 2, 3, 9, 11, 15 (schedule editor), 18.
- Feature 2 (unblock needs confirm + 30s + password): Task 13; config-lock in Task 15.
- Feature 3 (session-change alarm sound + notification): Tasks 10, 12.
- Feature 4 (independent Pomodoro 25/5): Tasks 4, 10, 16.
- Feature 5 (masked entries, password to reveal): Tasks 5, 6, 14, 15.
- Strong-password enforcement: Task 6, used in Tasks 13/15.
- Two-subsystem decoupling, MV3 alarms-only timing, offscreen audio: Tasks 10, 11, 12.
- Future publishing (icons/web_accessible_resources/zip): Task 0 config + `wxt zip` script.

Known follow-ups deliberately left for after v1 (out of scope per spec): ambient background music, Pomodoro-driven blocking, cross-device sync, statistics.
