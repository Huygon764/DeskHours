# Execution Plan: Receipt Tape UI

Date: 2026-10-03

## Status

Completed 2026-11-24 (closed by the owner as the final UI update)

## Outcome

Popup, options, and blocked page share one Receipt Tape grammar: cream thermal paper, iron-gall ink, one vermilion Unlock, photographic torn tape on the few objects that earn it, and one settle animation. Feature set, copy, i18n (en/vi), and theme (system/light/dark) stay the product contract. Work is unfinished until a human-visible unpacked-extension pass and the Impeccable finish gate (review + `DESIGN.md`) are either completed or explicitly dropped.

## Context

- Product: `PRODUCT.md`, `docs/product/`
- Surface brief (same contract in two files): `.impeccable/receipt-tape-brief.md`, `.impeccable/surfaces/entrypoints-popup.md`
- Look law (visual, not layout): `.impeccable/mocks/decision/r5-receipt.webp`
- Impeccable session: `.impeccable/build/state.json` (`sessionId` receipt-tape; phase **hero** still open)
- Shipping UI: `entrypoints/popup/`, `entrypoints/options/`, `entrypoints/blocked/`, `assets/theme.css`, `components/Tape.svelte`
- Preview-only stub (not the extension): `lib/preview-browser.ts`

Impeccable does not auto-convert the mock into HTML. Comp-led here means: measure the mock, cut plates, then write Svelte/CSS. Do not regenerate the mock or restart `$impeccable shape`.

## Scope

In scope:

- Keep Receipt Tape as the committed world.
- Torn tape as a photographic plate (`assets/plates/tape-piece.png`), not a CSS clip-path or geometric mask.
- One `Tape` motif per surface, not every card.
- One authored motion: `tape-settle` on `components/Tape.svelte`.
- WCAG 2.2 AA, square corners, Overpass + Overpass Mono.

Out of scope unless the human reopens them:

- Changing block, wait, password, schedule, or timer behavior.
- Cloning the mock’s layout, tagline, History tab, lock glyph, pictured gadgets, or a false “reset after focus” footer.
- Inventing wait UI on the popup Block tab. Wait figures belong on the blocked page after the user starts the countdown.
- SaaS / shadcn / parental-control / landing-in-popup chrome.

## Approach

Resume from the current diff. Do not treat a white or black screenshot as proof the tokens are wrong until `data-theme` is known (system dark makes cream tokens look like a black app).

Tape placements that already match the last human ask (“a little, and animation”):

| Surface | What sits on torn tape | What does not |
|---|---|---|
| Popup Block | This-page line (`CurrentPage.svelte`) | Focus/Timer panels; settings footer |
| Blocked | Live wait figures after “I still need access” | The outline button before countdown |
| Options | Unlock banner while blocking is on | Settings cards (paper + `--tape` grain only) |

Dark theme hides `tape-piece` and drops the settle tilt; paper token is `--paper: none`.

## Risks And Recovery

- Static `http://` preview of `.output/chrome-mv3/*.html` mounts without `initTheme` and without real `storage` / `tabs`. Focus/Timer show “Loading…”. Tab URL may stay “Loading tab…”. Proof is an unpacked extension (`bun run build`, then load `.output/chrome-mv3`).
- WXT `#imports` storage throws outside `chrome-extension:`. Do not “fix” that by rewriting storage; the stub exists only to paint HTML.
- Geometric masks for torn edges are banned by the craft floor. If `tape-piece.png` is missing or wrong, rebuild the plate from `tape-edge.png` + `page-strip.png`; do not clip-path a rectangle.
- `--primary` and `--toggle-on` are `#151515`. The human already said this reads as a black theme, not cream-as-world. That token choice is unresolved (see Decisions). Do not silently flip it.

## Progress

- [x] Human locked Receipt Tape and `.impeccable/mocks/decision/r5-receipt.webp`
- [x] Human chose option 2: draw the 4-sided torn strip; keep product copy; do not ship History / wait-on-popup-Block / lock glyph from the mock
- [x] Human asked to spread that strip look a little across the app, plus animation
- [x] Theme tokens, paper plates, popup chrome (hairline tabs, square radius)
- [x] Shared `Tape.svelte` + settle keyframes + `prefers-reduced-motion`
- [x] Tape on popup this-page, blocked wait, options unlock banner
- [x] Card grain from `--tape` (light only); options/blocked `.page` uses `--paper`
- [-] Unpacked-extension verification of Focus, Timer, options-during-block, dark theme: dropped by the owner
- [x] Color tokens: left to the agent; `--primary` / `--toggle-on` stay ink fill `#151515`
- [-] Impeccable hero gate, finish review, `DESIGN.md`: dropped by the owner

## Decisions

These are human locks from the Receipt Tape build, not agent taste.

- 2026-09-26: Form is Receipt Tape. Comp is `r5-receipt.webp`. Seed `778b4d00`.
- 2026-09-26: Comp is look law, not a layout to clone. Product tabs stay Block / Focus / Timer. Wait is the blocked-page countdown, not a popup Block widget.
- 2026-09-26: This-page is a 4-sided photographic tape piece, not a rounded rectangle with a torn bottom.
- 2026-09-26: Spread the motif lightly (one tape object per surface) and add one settle animation. Do not wrap every card in torn tape.
- 2026-09-26: Cream `#f3efe6` is the world. `#151515` is print ink. Vermilion `#b42318` is Unlock only. **Unresolved:** whether `--primary` / `--toggle-on` stay ink-fill (current code) or stay outline/ink-only so the UI does not read as a black theme. Do not pick this for the human.

Do not promote these into `docs/decisions/` until the human wants them as lasting product policy. `DESIGN.md` is the Impeccable finish artifact, not a substitute for this plan.

## Validation

- Focused proof: visual check of Tape on the three surfaces; `prefers-reduced-motion` removes spatial settle and keeps the rest rotation.
- Integration or end-to-end proof: unpacked Chrome/Brave extension, light and dark, popup Block + Focus + Timer, options setup + options while blocking, blocked wait then Unlock.
- Repository-required checks: `bun run build` (last known success). `bun test` / `bun run compile` were not the proof for this UI pass.
- Static Python CORS servers on `127.0.0.1:8766+` are preview only. They are not product proof.

## Result

Shipped as code: Receipt Tape tokens, paper plates, `Tape.svelte` with one settle
motion, tape on popup this-page, blocked wait, and options unlock banner.
`bun run compile`, `bun run test` and `bun run build` pass. Not verified in an
unpacked extension; the owner dropped that check and the Impeccable finish
(2026-11-24: "this is final update"). The Impeccable working files
(`.impeccable/`, the preview stub `lib/preview-browser.ts`) were removed, so the
mock and brief paths above no longer exist.
