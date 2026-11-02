# Release readiness — Phase 5 verification

Status: **verified, including CI confirmation; release is gated on the real-Safari manual check and
explicit deployment authorization.** This report records observed evidence only — nothing here is
marked passed from an assumption.

Verified tree: ui-dev's design-handoff/accessibility commit `454c4cd6`, the Phase 5 tooling and this
report committed as `d71e7d80`, and the design handoff step-2 record in `7d0db026`. A docs-only
progress commit `6811b8c1` follows them without code changes. Commit and CI details are under
[CI confirmation](#ci-confirmation).

## Verification environment

| Item | Value |
| --- | --- |
| Node.js | local v24.22.1; project targets Node 22 (`engines: >=22.13.0`), CI uses Node 22 |
| pnpm | 11.7.0 (`--ignore-workspace` is required inside this nested worktree) |
| Playwright | `@playwright/test` 1.64.1 — Chromium 1248, WebKit 27.2 (Playwright build), Firefox 157.0 |
| Accessibility | `@axe-core/playwright` 4.14.0, WCAG tags 2.0 A/AA, 2.1 A/AA, 2.2 AA |
| Production build | `pnpm build` served by `vite preview` on `http://127.0.0.1:4173` |
| CI | `.github/workflows/ci.yml`: `ci` job plus the new `e2e` job (committed in `d71e7d80`, runs after `ci`); both green in [run 41412783455](https://github.com/davidcai/scoundrel/actions/runs/41412783455) |

Local browser cache note: the sandbox cannot write `~/Library/Caches/ms-playwright`, so local runs
use `PLAYWRIGHT_BROWSERS_PATH=<worktree>/.artifacts/ms-playwright`. CI uses the default cache path
with `actions/cache`.

## Gates (final tree)

Evidence: `.artifacts/task39/gate-*.log`.

| Gate | Command | Result |
| --- | --- | --- |
| Typecheck | `pnpm typecheck` | pass — 0 errors |
| Lint | `pnpm lint` | pass — 0 errors, 2 accepted react-refresh warnings |
| Formatting | `pnpm format:check` | pass — all matched files use Prettier style |
| Unit/integration tests | `pnpm test` | pass — 47 files, 492 tests |
| Production build | `pnpm build` | pass — entry JS 330.62 kB (98.34 kB gzip), CSS 29.36 kB (5.82 kB gzip), built 82 ms |
| Bundle budgets | `pnpm bundle-size` | pass — entry JS 94.97/250 KiB, total JS 94.97/350 KiB, total CSS 5.64/50 KiB |
| Release assets | `pnpm check:release-assets` | pass — 47 dist files, 44/44 current PNGs with verified hashes, 105.76 MiB artwork, `vercel.json` static-safe |
| Browser e2e | `pnpm e2e` (matrix; CI and local) | per-project results below; full matrix green in CI, Firefox blocked locally by the sandbox |
| Accessibility scans | part of `pnpm e2e` (strict axe, no allowlist) | pass — zero WCAG 2.2 AA violations |

## CI confirmation

The pushed tooling tree `d71e7d80` was verified by GitHub Actions **run
[41412783455](https://github.com/davidcai/scoundrel/actions/runs/41412783455)** (push event, completed
**success**, 2026-11-02T08:24:04Z–08:29:06Z, Node 22, frozen pnpm install):

- `ci` job — success: install, lint, formatting, typecheck, unit/integration tests (47 files, 492
  tests), production build, bundle-size budget.
- `e2e` job — success: Playwright browser cache and install (Chromium, WebKit, Firefox), production
  build, full `pnpm e2e` matrix (all projects, including Firefox), and Playwright report artifact
  upload.

This is the observed Firefox-on-Ubuntu confirmation. The local sandbox Firefox limitation described
below is an environment note only. The later docs-only commit `6811b8c1` had no observed CI run when
this report was updated, so it is not claimed here.

## Browser and viewport coverage

Local evidence: `.artifacts/task39/e2e-<project>.log`; CI evidence: the `e2e` job in run 41412783455.
All runs use the production build served by
`pnpm preview`; strict axe scans have **no known-violation allowlist** — any violation fails the
run.

| Project | Lane | Result |
| --- | --- | --- |
| chromium-wide (1440×900) | full flows, axe scans, keyboard-only win, visual evidence | **23 passed, 1 skipped** (touch-only spec skipped) |
| webkit-wide (1440×900) | full flows, axe scans | **18 passed, 6 skipped** |
| chromium-medium (1024×768) | layout, axe scans, visual evidence | **6 passed** |
| chromium-compact (390×844, touch) | full touch flow, visual evidence | **2 passed** |
| webkit-compact (390×844, touch) | touch smoke | **1 passed** |
| chromium-narrow (320×568) | reflow and metadata fallback, visual evidence | **1 passed** |
| firefox-wide (1440×900) | complete-flow smoke | **pass in CI** (Ubuntu, run 41412783455); **blocked locally** — 17 failed / 7 skipped because the sandbox browser process exits `Could not find profile folder` (environment note, not a release condition) |
| chrome-wide-local (branded Chrome 156) | optional local smoke | added as an optional project; not run in this pass |

Per-project coverage: complete-run (winning fixture replay and doomed-policy loss through the real
interface), continuity (active-run resume after reload, completed-result reload, invalid
seed/link/route no-ops, corrupt and newer-version recovery with raw payload preservation,
session-only mode), persistence (replacement records exactly one abandoned loss, discard requires
confirmation, statistics recorded once across reload and a second tab, history replay starts a
fresh attempt, replay-link copy and fresh-profile deck round-trip), preferences (language and
reduce-motion persistence, unsupported browser-language fallback), keyboard-only complete winning
playthrough with visible focus and dialog focus trapping, compact touch targets and sheet
placement, and strict axe scans on title, help, statistics, settings, play, selected preview, and
result screens.

**WebKit is not Safari.** Playwright's WebKit build is an engine-regression signal only; it does
not validate Safari's shell, versions, iOS behaviours, media/storage, or assistive technology
integration. Real Safari remains a separate manual check.

### Real Safari — blocked, manual checklist required

Safari 26.6 is installed but "Allow Remote Automation" is off, so the real-Safari smoke check could
not run. The user must enable it:

1. Safari → Settings → Advanced → enable "Show features for web developers".
2. Develop menu → "Allow Remote Automation" (an admin-only `safaridriver --enable` is only needed
   if driver automation is wanted later).

Manual checklist once enabled (record Safari/macOS versions and screenshots in this report):

- Seeded win and seeded loss runs end with the correct result, score, health and remaining monsters.
- Keyboard-only playthrough: visible focus, no traps outside dialogs, Escape closes dialogs and
  restores focus.
- Help and dialogs open, trap focus, and restore focus.
- 200% browser zoom and a narrowed window keep every action reachable without horizontal page
  scrolling.
- System reduced motion and the in-app reduce-motion preference both remove non-essential motion.
- English and Simplified Chinese, plus the unsupported-language English fallback.
- Reload on the title/play/result routes behaves as expected (resume, completed result, no
  duplicate statistics).
- Web Inspector console and network are clean: no errors, no 404s, only current PNG artwork.

### Unverified device coverage

iOS Safari and Android Chrome on physical devices are unavailable in this environment and remain an
explicitly unverified item for release sign-off.

## Acceptance and requirement traceability

| Acceptance check | Evidence |
| --- | --- |
| AC-001 Complete a default run (REQ-001/002/003/007/009) | engine and UI unit tests; e2e complete-run win fixture replayed through the real interface; result screen assertions |
| AC-002 Trust decisions and continuity (REQ-004/005/006/008/010) | preview/confirm tests; e2e keyboard undo; persistence/recovery/session-only e2e; store tests |
| AC-003 Review and reproduce runs (REQ-009/013/014) | e2e result reload; statistics/history e2e; replay and share round-trip e2e; store history/stats tests |
| AC-004 Respect preferences (REQ-010/011/012) | settings/preferences tests; e2e language and reduce-motion persistence; engine house-rule tests |
| AC-005 Play and learn across devices and access needs (REQ-012/015/016/017/DEC-001) | Playwright matrix (Chromium/WebKit/Firefox lanes, 1440/1024/390/320, touch), strict axe scans, keyboard-only win, help/About tests |

| Requirement | Primary evidence | Status |
| --- | --- | --- |
| REQ-001 start and resume | `tests/title-entry.test.tsx`, e2e continuity (resume, invalid seed/link no-op) | automated — passing |
| REQ-002 play by rules | `src/engine/*.test.ts`, e2e complete-run (win + loss through the UI) | automated — passing |
| REQ-003 rooms and final room | engine room tests, e2e complete-run | automated — passing |
| REQ-004 state visibility | UI tests from Phase 3, strict axe scans | automated — passing |
| REQ-005 preview and confirm | preview tests, e2e select-then-confirm | automated — passing |
| REQ-006 explain item outcomes | preview and card tests | automated — passing |
| REQ-007 run away | engine escape tests, winning fixture includes a run-away step | automated — passing |
| REQ-008 undo to room start | engine undo tests, e2e keyboard and touch undo | automated — passing |
| REQ-009 finish and review | result tests, e2e result reload, replay-link copy | automated — passing |
| REQ-010 preserve progress and preferences | store persistence tests, e2e continuity/recovery/session-only | automated — passing |
| REQ-011 house rules | engine house-rule tests, title tests | automated — passing |
| REQ-012 language and motion | preferences tests, e2e preferences spec | automated — passing |
| REQ-013 statistics and history | `tests/stats.test.tsx`, store stats tests, e2e abandonment/once-only/history | automated — passing (51-run trim unit-tested only) |
| REQ-014 share and replay | share tests, e2e replay link round-trip | automated — passing (same-profile edge noted below) |
| REQ-015 contextual help | help tests, e2e axe scans | automated — passing |
| REQ-016 browsers and layouts | matrix above | Chromium/WebKit/medium/compact/narrow pass locally; Firefox confirmed in CI; real Safari manual pending |
| REQ-017 accessibility | strict axe WCAG 2.2 AA scans, keyboard and touch checks | automated scans pass; manual Safari/AT spot checks pending |

DEC-001 (browser/platform scope) is reflected in the matrix and Safari limitation above. DEC-003
(fresh product save, preference, seed, and replay formats) is respected: the v1 schema and replay
format were independently reviewed in Phase 4a and are reused without cross-product import or
compatibility work.

## Accessibility evidence

- Strict axe WCAG 2.2 AA scans pass with zero violations on title, help dialog, statistics, settings,
  play, selected-card preview, and result screens in Chromium and WebKit; the temporary
  known-violation allowlist was removed from the e2e spec (`e2e/a11y.spec.ts` now fails on any
  violation).
- The Phase 4b review's two pre-existing defects (live-region `aria-label` without a role, and the
  selected-card label/caption order) were fixed in `454c4cd6` and are covered by those scans.
- Keyboard-only complete winning playthrough with visible focus, dialog focus trap and restore, and
  Escape handling passes in Chromium wide.
- Touch targets: compact action-bar controls and sheet close button measure ≥44×44 CSS px; room
  cards stay ≥132 px wide; no horizontal page scrolling at 390 px.
- Reduced motion: in-app preference persists across reloads and is applied via `data-motion`; system
  preference handling is unit-tested.
- Languages: English and Simplified Chinese render; unsupported browser languages fall back to
  English; `html lang` tracks the preference.
- Deferred lower-priority follow-ups per REQ-017: formal audit/certification, extensive
  screen-reader testing, and 200% zoom/reflow screenshots captured as artifacts (manual Safari
  checklist includes the zoom check).

## Visual evidence

- 32 screenshots in `.artifacts/phase5/screens/` with `.artifacts/phase5/screens/sha256.txt`:
  Chromium wide (10) and compact (10) covering title, play, selected, settings, stats empty,
  stats with history, win result, loss result, recovery, and final; Chromium medium (6) and narrow
  (6) covering the layout states.
- Captured from the fixed UI in `454c4cd6`; no pixel-diff baselines are used (per the approved
  plan). Evidence is artifact-only; no large binaries are committed.
- Design handoff step 2 (statistics, settings, result scorecard) is recorded as completed on
  2026-11-02 in `docs/design-plan.md`; one accepted deviation is recorded there: the result
  breakdown shows "Potions wasted" because the engine tracks wasted potions only, while the
  guide's illustrative "potion used/wasted" wording does not require a used-potions count.

## Saved-data format-change scenario

The current schema is v1 — the first release, so there is no older production format to migrate.
Unit tests cover the migration seam, unreadable-payload preservation, and the ledger/history limits.
E2E covers a raw corrupt payload and a future `{"schemaVersion":99,...}` payload: the recovery
notice appears, the raw value is preserved unchanged, and no run is silently discarded or rewritten.

## Artwork and payload audit

Fresh production build: 47 dist files = 44 current PNG assets + hashed JS + hashed CSS + `index.html`.
All 44 PNGs are 1024×1536, total 105.76 MiB, all SHA-256 hashes match `assets/`; no archived JPEG or
`assets-old` files are present, and `vercel.json` is static-safe. Entry JS 322.88 KiB raw / 94.97 KiB
gzip; entry CSS 28.68 KiB raw / 5.64 KiB gzip; total dist 106.11 MiB. The largest room card is
1314.73 KiB, which dominates first-room transfer — budgets pass, but the hosting payload remains an
owner-accepted limitation for Vercel.

## Release build and hosting

`pnpm build` produces a static `dist/` compatible with `vercel.json` (Vite framework, immutable
asset headers). Deployment, deployed-URL smoke checks, merge requests, and merges are **not
authorized** and were not performed.

## Known limitations and open items

- **Firefox**: confirmed green in CI on Ubuntu (run 41412783455). Local runs remain blocked by the
  staging sandbox (`Could not find profile folder` on every launch, also outside the worktree with
  overridden HOME/TMPDIR) — an environment note only, not a release condition.
- **Real Safari**: blocked until the user enables Develop ▸ Allow Remote Automation; the manual
  checklist above must be completed and recorded. WebKit automation is not a Safari substitute.
- **Physical devices**: iOS Safari and Android Chrome are unavailable and remain unverified.
- **Asset weight**: 106.11 MiB dist / 105.76 MiB artwork; the largest room card is 1.31 MiB.
  Acceptable to the product owner or addressed before public hosting.
- **Cross-tab**: adoption of another tab's replacement/finish is covered by unit/integration tests,
  not by an e2e two-tab scenario; the e2e second-tab check covers statistics once-only.
- **History trim**: the 51-run trim is unit-tested but not exercised end-to-end.
- **Same-profile replay link**: opening your own replay link in the same profile restores the saved
  completed result instead of starting a fresh attempt; a fresh profile replays correctly. Recorded
  as a known limitation/follow-up candidate.
- **Potion wording**: "Potions wasted" is the recorded accepted deviation from the guide's
  illustrative "potion used/wasted" wording.
- **Screen reader**: basic semantics/labels are covered by axe and automated checks; extensive
  screen-reader testing and formal certification remain lower-priority follow-ups per REQ-017.
- **Deployment/merge/publishing** require explicit user authorization.

## Phase 5 verdict

**Ready for release once the real-Safari manual check is completed and recorded, and deployment is
explicitly authorized.** The automated gates, strict accessibility scans, the locally runnable
browser lanes, and the full CI matrix (including Firefox on Ubuntu, run 41412783455) pass on the
committed tree. The remaining release conditions are the real-Safari manual check, the
physical-device decision, acceptance of the asset weight, and explicit deployment/merge
authorization — not open product work.

## Sign-off checklist

- [x] Typecheck, lint, formatting, unit/integration tests, build, bundle budgets, release assets pass.
- [x] Strict axe WCAG 2.2 AA scans pass with no allowlist (Chromium and WebKit).
- [x] Chromium/WebKit/medium/compact/narrow lanes pass locally; Firefox lane passes in CI.
- [x] Design handoff step 2 recorded; accepted potion-wording deviation documented.
- [x] Full CI matrix green on push, including Firefox on Ubuntu (run 41412783455).
- [ ] Real Safari manual smoke completed and recorded.
- [ ] Physical iOS/Android spot check (or explicitly accepted as unverified).
- [ ] Asset-weight limitation accepted for hosting.
- [ ] Explicit deployment/merge/publish authorization.

## Files for the Phase 5 commit

The Phase 5 tooling and this report were committed as `d71e7d80` on top of `454c4cd6` (design
handoff step-2 record in `7d0db026`; docs-only status update in `6811b8c1`). This CI-evidence
revision of the report is the only uncommitted change. Files that make up the Phase 5 commit, for
traceability:

- `package.json`, `pnpm-lock.yaml` (Playwright/axe devDependencies and e2e scripts)
- `playwright.config.ts`
- `e2e/a11y.spec.ts`, `e2e/complete-run.spec.ts`, `e2e/continuity.spec.ts`, `e2e/keyboard.spec.ts`,
  `e2e/persistence.spec.ts`, `e2e/preferences.spec.ts`, `e2e/touch.spec.ts`, `e2e/visual.spec.ts`
- `e2e/support/game.ts`, `e2e/fixtures/winning-run.ts`
- `scripts/check-release-assets.mjs`
- `tsconfig.json`, `eslint.config.js`, `.prettierignore`, `.github/workflows/ci.yml`
- `docs/release-readiness.md` (this report)
- `docs/design-plan.md` (design handoff step-2 record and accepted deviation — authored separately,
  same follow-up commit)

No `src/` changes are part of the Phase 5 work; all evidence remains under ignored `.artifacts/`.
