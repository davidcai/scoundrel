# Scoundrel — Phaser Adoption Plan

Status: proposal · rev 2 (2026-09-17) — amended after adversarial review with code verification and external fact-checking · Scope: rendering/UX layer. The engine (`src/engine/`) is untouched; the store (`src/store/`) receives **additive** changes (result plumbing, `reducedMotion` setting — see [Store & data plumbing](#store--data-plumbing)); persistence shape, routing, and i18n architecture are otherwise untouched.

## TL;DR

**Scoundrel can benefit from Phaser — but only as a scoped visual layer for the play-screen card table, and only after a cheaper motion baseline ships first.** A full-canvas Phaser game would be a net regression: it would forfeit the accessibility architecture (keyboard nav, ARIA labels, live-region announcements), fight the typesafe-i18n DOM text stack, and break the RTL/Playwright test seams — to replace a turn-based, 5-cards-visible board that DOM/CSS already renders correctly.

Recommended sequencing (revised after review):

1. **Phase 1a — DOM motion baseline (WAAPI/FLIP):** deal/flip/fly-to-stack/heal/undo choreography inside the existing fluid layout, at near-zero bundle cost. This is shipped value on its own and covers most of the original "juice" goal.
2. **Phaser, gated on demonstrated need:** a Phaser 4 canvas owns _only_ the card table region and delivers what DOM cannot — shader-grade filters (glow, damage flash, vignette), camera shake, and high-volume particles. If Phase 1a satisfies the Q8a "modern RPG" goal, the Phaser phases are dropped.

Either way: HUD, action panel, tooltips, announcer, and all menus stay React DOM. Zustand remains the single source of truth; any FX layer consumes `(prevState, state, result)` — the engine's result union doubles as the FX event stream with zero engine changes (the store needs small additive plumbing; see below).

## Current state (what we'd build on)

- Pure React DOM/CSS UI; zero canvas, zero animation libraries. Motion today is CSS transitions only: card hover lift, HP-bar width, tooltip fades (`src/styles.css`). Kill-stack fan offsets are JS constants (`KILL_STEP_X = 40; KILL_STEP_Y = 16` in `src/ui/WeaponStack.tsx`), applied as inline styles — not CSS.
- Cards are `<button>` elements with JPEG artwork (`assets/*.jpg` → hashed URLs via `src/ui/card-image.ts`), selected ring, carried badge, CSS fallback.
- Accessibility is a first-class feature: roving arrow-key nav over room cards (`PlayScreen.tsx`), ARIA labels/`aria-pressed`, `role="meter"` HP bar, `LiveAnnouncer` driven by engine result payloads. **No axe tooling exists yet** — every "axe scan" gate in this plan is net-new work; "existing a11y tests" means the role/aria assertions in `tests/ui.test.tsx` and `e2e/scoundrel.spec.ts`.
- i18n (en/zh) woven through every component via `useT()`; all display text comes from message keys.
- `useGameStore.act()` is the single dispatch point; every reducer call returns `{ state, result }`. **However, `result` is currently consumed only inside `act()`** (announcements, stats) and is _not_ observable by subscribers; there is no `subscribeWithSelector`; `startRun()` deals the first room inside a single `set()`; and `hydrate()` sets state with no result at all. The FX event stream needs the additive plumbing described under Store & data plumbing.
- `GameWon`/`GameLost` (engine terminal-override) _replace_ the per-action result and carry no `cardId`; the engine keeps no discard pile in state. Per-card choreography must therefore be derived from a `(prevState, state)` diff, not from result payloads alone. `MonsterDefeated.weaponBroke` is hardcoded `false` in the engine — never key FX on it.
- `PlayScreen.tsx` currently unmounts the board when the run ends (`<GameOverScreen/>` replaces it) — relevant to end-of-run celebrations.
- Tests: engine unit (Node), RTL integration (DOM role queries), Playwright e2e (seeded URLs, DOM-button keyboard nav). No size-budget or chunk tooling exists in build or CI.

## Why not a full Phaser rewrite

| Concern       | Impact of full-canvas rewrite                                                                                                                                                                                                                                                                                                                                                                                   |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Accessibility | Canvas content is invisible to the accessibility tree (no framework-level a11y in Phaser as of 2026, [phaserjs/phaser#7294](https://github.com/phaserjs/phaser/issues/7294) — still open). Production adopters solve it with a parallel DOM mirror ([OpenForge case study](https://phaser.io/news/2024/09/openforge-solving-accessibility-challenges-with-phaser)) — we'd rebuild what we already get for free. |
| i18n          | Canvas `Text` loses selection, zoom, IME, find-in-page, and CSS styling; every localized string becomes a scene object.                                                                                                                                                                                                                                                                                         |
| Tests         | RTL integration tests query `getByRole('button')` on cards; e2e keyboard-nav walks DOM buttons. All of that test surface would need a replacement strategy.                                                                                                                                                                                                                                                     |
| Bundle        | ~317KB gz for Phaser 3.90. The stable npm `phaser@4.2.1` package is a **monolithic ESM bundle (~355KB gz) with no tree-shaking** — the "modular deep imports" mitigation is not currently executable (`@phaserjs/phaser`, the modular package, is stale at 0.2.2). Deferrable via dynamic import; budget accordingly.                                                                                           |
| Fit           | The game is turn-based with 4 room cards + a weapon stack visible. There is no real-time loop, no physics, no scrolling world — the classic Phaser strengths are unused.                                                                                                                                                                                                                                        |

## Where Phaser should be adopted

### Adopt: play-screen card table (canvas) — pending Phase 0 ownership decision

A single Phaser scene rendering the **room** (4 card sprites with deal/flip/resolve animations) and — depending on the Phase 0 decision — the **weapon zone** (weapon card left, kill stack fanned right per the Q40 layout). This region gets:

- **Tween choreography** — staggered deal from the deck position, flip-on-deal, resolved card flying to its destination (kill stack / deck bottom / discard), potion heal float, undo rewind, run-away sweep.
- **Phaser 4 Filters** (unified FX system, any object or camera) — glow on the selected card, red damage flash / camera shake on `MonsterDefeated`, green pulse on heal, vignette + subtle bloom on the board, Wipe transition on `RoomDealt`, win/lose celebration particles.
- **Particles** — hit sparks on kills, embers/dust-mote ambience, confetti-ish burst on victory.

### Keep in DOM (never canvas)

- HUD (HP meter, dungeon count, abandon dialog) — `role="meter"` semantics.
- Action panel (damage preview, Fight/Drink/Equip confirms), all buttons, tooltips.
- `LiveAnnouncer`, seed note, carry/progress text.
- Title, Stats, Settings, About screens; GameOver scorecard.
- All localized strings. **The canvas renders zero text**: artwork, numbers/suit badges, and non-text FX only. `carriedBadge`, `lastKillBadge`, and zone titles render in the DOM hit-layer — e2e already asserts `.carried-badge` counts and a visible `.selected-ring` inside the card buttons, so those decorative nodes must exist in the DOM regardless. This deletes the canvas font-loading/CJK/i18n-width risk entirely.

### Optional later: title-screen ambient backdrop

The `title-art` CSS backdrop could gain particle/vignette ambience from the same lazy chunk. Contained, low-risk, but only after the play board proves the pattern.

## Target architecture

```
src/game/                 # Phaser layer (kebab-case files, engine rules don't apply: it may import phaser)
  board-scene.ts          # one scene: room + (maybe) weapon zone layout, tweens, filters, particles
  card-sprite.ts          # card sprite factory (texture from cardImageUrl, corner badge, ring)
  fx.ts                   # filter/particle presets keyed by result-union member
  bridge.ts               # typed EventBus: store→scene commands, scene→store intents
  board-layout.ts         # PURE layout function: computeBoardLayout(containerW, containerH) → card rects
                          # + kill-stack fan offsets (absorbs KILL_STEP_X/Y from WeaponStack.tsx).
                          # Consumed by BOTH the scene and the DOM hit-layer. Unit-testable without Phaser.
src/ui/PhaserBoard.tsx    # mount wrapper: useLayoutEffect + destroy-on-unmount + StrictMode ref guard;
                          # renders the DOM hit-layer overlay (see Testing & accessibility below);
                          # must no-op (or be mocked in tests/setup.ts) under jsdom — no WebGL there
src/ui/PlayScreen.tsx     # composition CHANGES: `.room-progress` and `ActionPanel` currently sit between
                          # the room and weapon zone in the DOM and must be repositioned around <PhaserBoard/>;
                          # "unchanged PlayScreen" is not on the table
```

Data flow (one direction of truth):

```
user click (canvas or hit-layer button)
  → bridge 'cardClick' → useGameStore.selectCard(cardId)
confirm action (DOM ActionPanel — unchanged)
  → useGameStore.act(action) → engine reducer → { state, result }
  → act() additionally writes { lastResult, fxSeq } (additive store plumbing)
  → subscribers: plain zustand subscribe yields (state, prevState); lastResult supplies the result
  → BoardScene: reconcile (prevState → state) diff + play tweens/FX keyed on result.type (as hints)
```

Rules for the bridge:

- Phaser never mutates game state; it only emits intents (`cardClick`) and renders. Selection stays in the store (Q45b); the scene reads `selectedCardId` like any other subscriber.
- **Diff-based reconciliation is the single mechanism.** On every store notification — including mount, hydrate, and resume, where `lastResult` is `null` — the scene reconciles `prevState → state`. Result payloads are choreography hints, never the source of truth. This is what makes terminal results (no `cardId`), `UndoDone` (no payload), `RanAway` (fleeing set is `prevState.room` and may overlap arrivals when `dungeon.length < 4`), and run start (`startRun` deals inside one `set()`, so no deal event fires) all work with one code path.
- **The canvas renders zero text** (see Keep in DOM above).
- **Layout:** the shared **layout function** (not constants) in `board-layout.ts` is consumed by both the scene and the hit-layer. The hit-layer positions elements over the **rendered canvas box** (letterbox-inclusive — sync via the scale `resize` event or `getBoundingClientRect()`), never the parent container. Keep all ancestors of canvas + overlay **transform-free** — CSS transforms break Phaser pointer-coordinate mapping (phaserjs/phaser#7278/#7175).
- Card textures load from the existing hashed `cardImageUrl(cardId)` URLs — no asset duplication.
- **jsdom safety:** existing RTL tests render `PlayScreen` directly; without a guard, importing Phaser under jsdom (no WebGL) breaks the suite in Phase 1. `PhaserBoard` must be mockable/no-op under jsdom (e.g. capability check or `tests/setup.ts` mock).
- Mount pattern per the official template ([template-react-ts](https://github.com/phaserjs/template-react-ts), React 19 / Vite 6 ready): create `Phaser.Game` in `useLayoutEffect` on a div ref, `game.destroy(true)` on cleanup, ref-guard against React StrictMode's double mount, dynamic `import('phaser')` so the chunk never blocks first paint. No changing props in the effect's dep array — route everything through the bridge. Caveats: `destroy()` defers to the next frame (test rapid route toggling, not just StrictMode); Vite HMR for the scene means full page reload (accepted — don't hand-roll dispose/reload logic); the template's `log.js` phones home — use dev-nolog/build-nolog equivalents.

### Version target

**Phaser 4, pinned `~4.2.1`** (v4.0 "Caladan" shipped Apr 2026; v4.2.1 "Giedi", Jul 2026, is current stable as of this revision). Pin ≥4.2.1 specifically: the ScaleManager parent-container resize fix ([#7213](https://github.com/phaserjs/phaser/issues/7213)) and several ESM-build fixes landed there. Note the stable npm package ships one monolithic ESM bundle (~355KB gz) — the modular architecture is not yet consumable from npm, so size budgets assume the full engine. If the Phase 1 spike hits a v4 blocker, fall back to v3.90 — the scene-level APIs used here (tweens, containers, particles) are nearly identical across major versions — but note v4 deprecates the Canvas renderer, so v3 is not a feature safety net.

### Store & data plumbing

Additive changes only (engine untouched):

- `lastResult: GameResult | null` + monotonic `fxSeq: number`, written by `act()` (and `null` on mount/hydrate/resume paths), so subscribers get `(state, prevState, lastResult)`. This replaces the plan's earlier `subscribeWithSelector` assumption — the middleware is not currently applied (`game-store.ts` uses plain `create`), and plain `subscribe` already provides `prevState`.
- Selection nuance: `act()` nulls `selectedCardId` only on `UndoToRoomStart`; the UI confirm buttons call `selectCard(null)` _after_ `act()` — i.e. **two store notifications per resolve**. The scene must tolerate a no-op diff frame between them.
- `reducedMotion` setting: extends `SettingsData` (`scoundrel:settings`), strict validator defaults the field when missing (stays at SCHEMA_VERSION 1), accounts for the full-object re-saves in `saveSettings`/`saveLanguage`, adds i18n keys + a `SettingsScreen` toggle, and updates the e2e settings fixture (which asserts the exact settings shape — it must tolerate the missing field on older persisted data).

## Phased plan

### Phase 0 — Decision gate (0.5 day)

- Confirm the goal is "juice the board" (visual polish), not capability — DOM/CSS already covers all mechanics. Sign off on **WAAPI-baseline-first**: Phase 1a ships as the default path; Phaser is gated on a demonstrated filter/particle payoff the DOM cannot deliver.
- Decide the **geometry model** (blocking — the current board is fluid: `--card-w: clamp(132px, 19.5vw, 192px)` with 2×2 wrap at the mobile breakpoint):
  - (a) `Scale.FIT` frozen aspect — accepts cards shrinking below today's 132px mobile floor, loss of 2×2 reflow, and letterbox bars;
  - (b) `Scale.RESIZE` + the shared layout function (recommended);
  - (c) canvas owns a fixed-aspect sub-region only.
- Decide **weapon-zone ownership**: (a) canvas owns the room only; weapon zone stays DOM (fan via CSS/FLIP; resolve tweens hand off at the canvas edge); or (b) weapon zone becomes a DOM overlay positioned by the layout function. Either choice restructures `PlayScreen.tsx` (`.room-progress` + `ActionPanel` sit between the zones today).
- License note: Phaser 4 is MIT — compatible, no action.
- Kill criteria for the whole effort: see Risks.

### Phase 1a — DOM motion baseline (2–3 days)

- Small WAAPI/FLIP motion helper; deal/flip/fly/heal/undo/sweep choreography driven by the same `(prevState, state, lastResult)` stream (the store plumbing in this plan is shared by both paths).
- `reducedMotion` setting wired here (honors `prefers-reduced-motion`).
- **Gate:** baseline shipped. If it satisfies the Q8a "modern RPG" goal, the Phaser phases below are dropped and this plan ends.

### Phase 1 — Spike (1–2 days) — conditional on Phase 0 go

- Add `phaser` dep (pinned `~4.2.1`); `PhaserBoard.tsx` wrapper with StrictMode-safe mount/unmount, dynamic import, and the **jsdom guard** — existing RTL suite passes unmodified.
- `BoardScene` renders the 4 room cards as static sprites from `cardImageUrl`; wire store notifications → **diff-based reconciliation** (no tweens yet), including the mount/resume `lastResult = null` path.
- Spike checklist: StrictMode double-mount handled; **rapid route toggling** (destroy defers a frame — watch for WebGL errors on fast unmount/remount); **HiDPI sharpness** at the chosen scale mode (undocumented in v4 — verify); **#7341 avoidance** (no angle tweens on moving sprites); bundle delta **measured with a number** (gate: `#/play` chunk ≤ **+400KB gz** vs today — the original +250KB figure is unreachable with the monolithic 4.2.1 bundle).
- **Gate:** spike demo + measured bundle delta. Abort → stay on the Phase 1a baseline.

### Phase 2 — Board parity (3–5 days)

- Card interactions: tap/click select (ring rendered in the hit-layer, emits `cardClick`), hover states bridged from DOM events — the canvas never receives pointer events because the hit-layer covers it.
- Weapon zone per the Phase 0 decision; `carriedBadge`/`lastKillBadge` render in the DOM.
- **Hit-layer selector contract (checklist — all asserted by e2e/RTL today):** `button.card` with `data-card-id`/`data-kind`/`data-selected`/`aria-pressed`/`aria-label`; visible `.selected-ring` inside the button; `.carried-badge`; `.weapon-card[data-card-id]`; kill-stack `role="list"`/`role="listitem"` with per-card aria-labels; roving arrow-key nav; touch targets ≥44px.
- **Resume-from-save reconcile without animations** (moved up from Phase 4 — required the moment the scene can mount on a mid-run state).
- **Mid-phase kill checkpoint** (the riskiest unknowns — geometry, a11y, mobile — materialize here, not in Phase 1): axe scan (net-new tooling) zero violations; e2e **rect assertions** green (hit-layer button rects must equal the layout function's output at desktop and mobile widths); keyboard nav unchanged.
- **Gate:** feature-complete board with zero a11y-tree regressions.

### Phase 3 — Juice (3–5 days)

- **Motion policy (load-bearing, applies from here on):**
  - Never gate input on FX — hit-layer buttons are never disabled while tweens run. Rapid successive actions are the common case (the e2e greedy bot clicks in a tight loop).
  - On each store notification: kill in-flight tweens (`tweens.killTweensOf`) → reconcile to state → start the new result's choreography.
  - `tween.stop()` fires `onStop`, not `onComplete` — never chain post-kill logic off `complete`.
  - No angle tweens on moving sprites (phaserjs/phaser#7341, open) — use scale/x/y.
  - Tab visibility: reconcile to store state on the game's `pause`/`resume` events; browser RAF throttling makes in-flight tweens untrustworthy.
- Tween choreography keyed on corrected result names: staggered deal + flip on **`RoomDealt`** (distinguish `carriedFrom !== null`) — `EnterNextRoom` is an action, not a result type; `MonsterDefeated` → fly to kill stack, stack re-fans (never key on `weaponBroke`); `PotionQuaffed` → heal float + `wasted` variant; `WeaponEquipped` → discard sweep (no discard pile exists in state — destinations are conceptual, derive from the diff); `RanAway` → fleeing cards (`prevState.room`) fly to deck bottom, new deal; `UndoDone` (no payload) → rewind via diff.
- FX: camera shake + red vignette pulse on damage; glow filter on selection; room Wipe on `RoomDealt`; victory/defeat particle celebrations — **requires a `PlayScreen` sequencing change**: `GameWon`/`GameLost` currently swap in `<GameOverScreen/>`, unmounting the board; keep the board mounted (scorecard as overlay) or move the celebration into `GameOverScreen`. Explicit task.
- `RunAwayBlocked` / `InvalidAction` → shake-with-explanation is _not_ canvas text; the DOM tooltip/announcer already explains — canvas only nudges.
- `reducedMotion` shortens/disables tweens (schema task above).

**Gate:** design review against the Q8a "modern RPG" aesthetic; motion respects reduced-motion; rect assertions still green.

### Phase 4 — Hardening (2–3 days)

- Performance: texture atlas evaluation **with the caveat that atlases must be PNG** while photographic art (these card JPEGs) is usually smaller per-file — and the 44 hashed JPEGs are already browser-cached and shared with the DOM fallback, so an atlas duplicates them. The real costs are the 44-request waterfall (preload only the current room's textures; placeholder card back while loading; gate tween start on load) and GPU memory on low-end devices. Frame budget check per the perf gate below.
- Bundle: verify lazy chunk boundaries; CI size-budget check (net-new tooling — no `manualChunks`/size-limit exists today): `#/play` chunk ≤ +400KB gz.
- Edge cases: resize/rotate mid-tween, tab visibility (Phase 3 policy), resume-from-save (already landed in Phase 2 — re-verify), seeded replay determinism (visuals derive from state diff, never RNG).
- **Perf gate (falsifiable):** sustained ≥55fps during deal + resolve choreography on a named device class (e.g. iPhone 11 / Moto G-class Android), measured via devtools performance trace — not "60fps on a mid-range phone".

### Phase 5 — Test & CI updates (2–3 days)

- New unit tests for the pure modules (layout function, bridge, diff logic) — no Phaser mount needed.
- Playwright: add a "canvas ready" probe; assertions stay on the hit-layer/ARIA surface; **e2e rect assertions** at desktop + mobile widths as the geometry-drift detector; visual smoke screenshot as an extra, not the strategy; axe scan in CI (net-new).
- Docs: update `README.md` architecture section and this file's status.

**Totals:** Phaser path ≈ **15–22 days** (the original 12–18 was optimistic; the delta is the structural decisions — geometry model, weapon-zone ownership, result plumbing, jsdom strategy, GameOver sequencing). Stop after Phase 1a: **2–3 days**.

## Testing & accessibility strategy (the load-bearing decision)

The **DOM hit-layer** is the single most important piece of this plan: every interactive card keeps a real DOM button (transparent, positioned over its sprite via the shared layout function) with the existing `aria-label`, `aria-pressed`, focus ring, roving-nav behavior, and the decorative nodes e2e asserts (`.selected-ring`, `.carried-badge`). Screen readers, keyboard users, RTL tests, and e2e tests all keep working unchanged — Phaser is strictly decorative pixels underneath. This mirrors the production pattern used by OpenForge/Startup Wars (Phaser canvas + DOM semantic layer) — community best practice, since Phaser offers no framework-level a11y (#7294). Geometry parity is verified by deterministic e2e rect assertions against the shared layout function (not by a single screenshot). If the hit-layer proves unmaintainable (geometry drift, focus traps), that is a kill criterion — do not trade away the a11y architecture.

## Risks & mitigations

| Risk                                         | Mitigation                                                                                                                            |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| A11y regression via canvas                   | DOM hit-layer keeps full semantics; `LiveAnnouncer` is store-driven and untouched; axe (net-new) + existing role/aria tests as gates. |
| Geometry drift between hit-layer and sprites | Shared **layout function** (not constants); hit-layer tracks the rendered canvas box; e2e rect assertions at desktop + mobile widths. |
| Bundle bloat                                 | Dynamic import + route-level chunk; CI size budget **≤ +400KB gz** (4.2.1 is monolithic, ~355KB gz, no tree-shaking).                 |
| React⇄canvas sync bugs                       | One-directional bridge; **diff-based reconciliation** from `(prevState, state)` on every notification incl. `lastResult = null`.      |
| Rapid actions mid-tween                      | Motion policy: never gate input; kill → reconcile → re-choreograph.                                                                   |
| phaserjs/phaser#7341 (tween corruption)      | No angle tweens on moving sprites; track the issue; scene code stays v3-portable.                                                     |
| GameWon/GameLost unmounts the board          | Phase 3 sequencing task: keep board mounted under the GameOver overlay (or celebrate in `GameOverScreen`).                            |
| jsdom breaks RTL suite                       | `PhaserBoard` guard/mock in `tests/setup.ts`; verified in Phase 1.                                                                    |
| StrictMode double-mount / HMR leaks          | Ref-guard + `destroy(true)`; rapid route-toggle test in the spike; HMR = full page reload (accepted).                                 |
| Phaser 4 is young (Apr 2026)                 | Pin `~4.2.1` (ScaleManager + ESM fixes); keep scene code v3-portable; v3.90 fallback (no Canvas-renderer safety net in v4).           |
| Scope creep into full rewrite                | Phases are gated; Phase 1a is the default path; HUD/menus/action-panel into canvas is explicitly out of scope.                        |

## Fallback if we stop after Phase 1a

Phase 1a _is_ the fallback and the default path: the WAAPI/FLIP baseline delivers deal/flip/fly-to-stack, heal floats, undo rewind, and reduced-motion at near-zero bundle cost, inside the existing fluid layout, with no geometry duplication, no DPR pitfalls, no jsdom guard, and no 355KB lazy chunk — losing only shader-grade filters, camera shake, and high-volume particles. The result-union-driven FX design carries over unchanged if Phaser is ever revisited.

## Sources

- [Phaser 4 download & release status](https://phaser.io/download/phaser4) · [v4.0.0 release notes](https://github.com/phaserjs/phaser/releases/tag/v4.0.0) · [npm `phaser` (4.2.1 monolithic ESM, ~355KB gz; exports map)](https://www.npmjs.com/package/phaser)
- [v3→v4 Migration Guide](https://github.com/phaserjs/phaser/blob/master/changelog/v4/4.0/MIGRATION-GUIDE.md) · [migration summary](https://phaser.io/news/2026/04/migrating-from-phaser-3-to-phaser-4-what-you-need-to-know)
- [Official template-react-ts (mount pattern, EventBus)](https://github.com/phaserjs/template-react-ts) · [v4 modularity dev log](https://phaser.io/devlogs/239)
- [Phaser a11y gap + feature request #7294](https://github.com/phaserjs/phaser/issues/7294) · [OpenForge accessibility case study](https://phaser.io/news/2024/09/openforge-solving-accessibility-challenges-with-phaser)
- [ScaleManager parent-resize fix #7213](https://github.com/phaserjs/phaser/issues/7213) · [angle-tween corruption #7341 (open)](https://github.com/phaserjs/phaser/issues/7341) · [CSS-transform pointer mapping #7278/#7175](https://github.com/phaserjs/phaser/issues/7278)
- [Scale Manager docs (FIT/displaySize/autoCenter)](https://docs.phaser.io/phaser/concepts/scale-manager) · [Tween docs (stop → `onStop`)](https://docs.phaser.io/phaser/concepts/tweens) · [VisibilityHandler / TimeStep](https://docs.phaser.io/api-documentation/class/core-timestep)
- [Phaser license (MIT)](https://phaser.io/download/license)
- [Zustand↔Phaser bridging example](https://krrish-ranjan.hashnode.dev/architecting-a-real-time-web3-arcade-engine-anti-cheat-60-fps-canvas-bridging-and-sub-100ms-leaderboards) · [Phaser+React+Zustand template](https://github.com/blopa/top-down-react-phaser-game-template)
- [Phaser card-game mechanics reference (Solitaire series)](https://scottwestover.dev/post/2024/08/solitaire-phaser-3-tutorial-1/)
