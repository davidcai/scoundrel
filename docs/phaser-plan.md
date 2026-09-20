# Scoundrel — Phaser Integration Plan

Status: proposal (no code changes yet). This plan evaluates where the Phaser game framework improves the current implementation and defines a phased introduction. `docs/rules.md` stays the canonical rule set; `docs/spec.md` describes the current architecture. Revised after a gap review: the store result channel, the terminal-result replacement rule, the e2e input contract, and the settings migration mechanism are now first-class work items rather than assumptions.

## 1. Why Phaser — where it improves the current app

The current UI is a fully DOM/CSS app (`src/styles.css`, 961 lines) with **no animation layer beyond hover/select lifts**. Scouting the codebase shows the gaps a game engine fills:

| Gap today | What Phaser brings |
|---|---|
| No card-deal, flip, discard, or damage animations — resolving a card is an instant DOM swap | Tweens, tween chains, ease functions, custom easing: dealt cards slide into the room, fights resolve with impact, defeated monsters slide onto the kill stack |
| `WeaponStack.tsx` fans the kill stack with hand-computed static offsets (`right: i * KILL_STEP_X`, `top: i * KILL_STEP_Y`, constants 40/16 at `WeaponStack.tsx:7-8`) | Physical card-stack behavior: cards drop onto the stack with a small bounce; stack is a natural sprite pile |
| Feedback is text-only (result payloads → ARIA announcements) | Camera shake on damage, flash on weapon break, particle burst on potion heal, HP-bar drain animation — feedback players *feel* |
| HP bar is a plain width-% div | Animated/segmented HP meter with tweened drain + hit flash |
| Room transition (`Enter Next Room`) is an instant re-render | Animated room clear: resolved cards sweep away, carried card slides forward, new cards deal |
| No juice of any kind | Muzzle-free particle/parallax options for the dungeon atmosphere (subtle dust/ember backdrop) |

The engine rewards none of this effort at present: the game is mechanically complete and correct, but the presentation is static. Phaser's value is almost entirely in the play screen's "game table" feel.

## 2. Where Phaser would hurt — constraints to protect

The current app has first-class properties that a naive full-canvas rewrite destroys:

- **Accessibility**: ARIA labels on every card, live-region announcements driven by engine result payloads, roving-focus keyboard navigation, focus-managed modals. Canvas rendering has no official ARIA story.
- **i18n**: every string flows through typesafe-i18n (`en`/`zh`). Canvas text requires manual font/layout handling and loses free text selection/SR semantics.
- **Test seams**: RTL integration tests assert accessible rendered output; Playwright e2e asserts *and drives input* via DOM locators with seeded URLs. A canvas is opaque to both.
- **Screens outside gameplay** (title, stats, settings, about) are forms, tables, and text — exactly what DOM does well and canvas does badly.
- **Bundle**: Phaser 4 is ~1.37 MB minified / ~356 KB gzip and cannot be tree-shaken (one prebuilt ESM file). A global import would tax every route.

Conclusion: **hybrid architecture, not a rewrite**. Phaser owns the play screen's game table (room cards, weapon + kill stack, animations, effects). React keeps everything else and overlays text/HUD on the canvas. The pure engine is reused untouched; the store gains one additive result channel (see §3) and Phaser is a *renderer* for the same store.

## 3. Target architecture

```
src/
├── engine/        UNCHANGED — pure reducer, zero React/Phaser
├── store/         engine state, persistence, share; NEW `lastResult`
│                  (result + monotonic seq) channel for the renderer;
│                  settings schema migration for the renderer flag
├── ui/            React: title/stats/settings/about screens, PlayScreen shell,
│                  DOM overlay components (Hud, tooltips, action buttons, live
│                  region), DOM room mirror + selection control (see Phase 1)
└── game/          NEW — Phaser layer (React-free, mounts inside PlayScreen)
    ├── game.ts        Game bootstrap/config (scale, scene registry); created/destroyed by React
    ├── scenes/
    │   ├── table-scene.ts     Room layout: 4 card sprites, weapon, kill stack, HP
    │   └── (later) fx-scene   Particles/backdrop ambience, if needed
    ├── card-textures.ts      AssetId → Phaser texture loading (wraps card-image.ts map)
    ├── coordinates.ts        client ↔ game coordinate mapping through the FIT transform
    ├── animations.ts         Named tweens: dealCard, flipIn, attackImpact, stackDrop, roomClear
    └── store-bridge.ts       Subscribes to Zustand store → drives scene; routes clicks → selectCard
```

Key decisions:

- **One-way data flow, same as React**: the scene never mutates game state. `store-bridge` subscribes to the store and issues *presentation commands* (dealt, resolved, hp-changed, run-ended); pointer input on card sprites toggles `selectCard` (the store's selection slice), and resolution runs through the overlay ActionPanel buttons via `useGameStore.act(GameAction)` — the same select-then-act flow as today, not direct `act` calls from the canvas. Transient selection stays in the store's `selectedCardId` slice — the scene renders the highlight.
- **The store must publish the reducer result — `store/` is NOT unchanged**: today `act()` destructures `{ state, result }` (`src/store/game-store.ts:94`) and publishes only `state`, `selectedCardId`, `statsWritten`, and the *localized* `announce()` string (`game-store.ts:115-121`). The string is lossy: the bridge cannot recover `PotionQuaffed.healed/wasted`, `MonsterDefeated.usedWeaponId`, `WeaponEquipped.discardedMonsterIds`, or `RunAwayBlocked.reason`. Worse, `RunAwayBlocked`/`InvalidAction` return a state identical to a no-op, so a purely state-diffing bridge cannot detect them at all. **Required store change (Phase 1, before any bridge work): add `lastResult: { result: GameResult; seq: number } | null`, set in `act()` and `startRun()` with a monotonic `seq`; the bridge consumes it as the cue sheet.** This is the plan's central mechanism; §8's effort estimates assume it.
- **Terminal results replace the base result**: `withTerminal` (`src/engine/engine.ts:162-182`) substitutes `GameLost` for the `MonsterDefeated` that caused death and `GameWon` for the final resolve's base result. The killing blow's damage/HP drain and the final kill-stack drop therefore have **no `GameResult` payload**. The bridge must reconstruct the terminal action's presentation from the state diff (HP delta, `killStack` append, room diff) *before* playing the run-ended flourish. Engine change: none — this is a bridge responsibility.
- **Two store notifications per resolve**: every resolve emits `act()` and then `selectCard(null)` from the click handlers (`PlayScreen.tsx:272-275`, `299-300`, `327-328`, `361-362`). The first notification carries a selection pointing at a card no longer in `room` (filtered by `PlayScreen.tsx:104-105`; the bridge must filter identically). Presentation commands are keyed off `lastResult.seq`, selection sync is idempotent, and a selection-clear must never cancel or replay an in-flight resolve tween.
- **Canvas HP is decorative; the DOM meter is canonical**: the scene may draw HP visuals (drain animation, hit flash) but the authoritative accessible readout stays the DOM `role="meter"` in the Hud (`Hud.tsx:29-32`). Both derive from the same store, so they cannot diverge in value — only in presentation.
- **Result payloads are the animation cue sheet**: the scene handles every variant of the `GameResult` union (`src/engine/types.ts:86-108`) — `RoomDealt{cards, carriedFrom}`, `MonsterDefeated{cardId, damage, usedWeaponId, weaponBroke}` (`cardId` selects the sprite; `usedWeaponId` picks bare-vs-weapon impact), `PotionQuaffed{cardId, healed, wasted}`, `WeaponEquipped{cardId, discardedWeaponId, discardedMonsterIds}`, `RanAway{newCards}` (deal-in of the new room), `RunAwayBlocked{reason}` (shake/no-op feedback, never silence), `UndoDone`, `InvalidAction{reason}` (error nudge), `GameWon/GameLost{score, seed, config}` (flourish + handoff). `src/store/announcements.ts` already switches on all 11 variants; the scene maps the same payloads to tweens. **Add an exhaustiveness guard** (a `never`-checked switch over `GameResult` in the bridge plus a unit test) so a future engine variant fails the build instead of silently becoming an unhandled cue. (`RunStarted` never reaches the store: `startRun` calls `createInitialState` + `DealRoom` directly (`game-store.ts:76-89`), so the bridge can ignore it entirely; there is no "arrives before mount" case to handle.)
- **State-diff fallback for undo**: `UndoToRoomStart` restores the room from `roomSnapshot` and emits only `UndoDone` — no diff. Forward tweens cannot represent a backward jump (cards reappear, HP rebounds, kill stack changes). On `UndoDone`, or whenever a subscribed state fails to match the scene's model, the bridge rebuilds the scene from state with a short cross-fade instead of playing tweens. The bridge therefore always carries a mirrored model of the rendered state and compares it after every store notification. Note the fallback is a *supplement* to `lastResult`, not a replacement: it cannot detect no-op results (see above).
- **First sync is a snapshot, not events**: on reload with a saved run (`hydrate`), a seeded replay URL, or a StrictMode remount, the scene mounts with no `RoomDealt` event. The bridge's first job is to render full state statically (initial sync) with all intro animations suppressed; deal animations only play for `RoomDealt` results observed *after* mount. The initial sync must also seed `lastResult.seq` from the store so a stale result from before mount is not replayed.
- **Win/lose handoff is gated**: `PlayScreen` switches to `GameOverScreen` as soon as `phase !== 'playing'`, unmounting the canvas. The Phase 2 win/lose flourish must complete before the switch: on `GameWon`/`GameLost` the bridge signals completion and React (local state or a store gate) delays the GameOverScreen render until the flourish finishes. The gate must be time-bounded (fail-open after a short timeout) so a11y and e2e never wait on it. While the gate is closed, overlay controls are disabled by the same `phase !== 'playing'` engine queries they already use — that is expected, not a bug.
- **DOM overlay stays**: Hud (HP readout as real `role="meter"`, deck count, seed), ActionPanel buttons (with damage previews), Tooltip, LiveAnnouncer, and the abandon-run modal remain React DOM layered above the canvas. This preserves a11y, i18n, and preview logic for free. Note the current overlay does *not* contain the weapon-zone data — see the Phase 1 work list.
- **Selection semantics move into the bridge**: the store keeps `selectedCardId` on `act` (only undo clears it); today `PlayScreen`'s click handlers call `selectCard(null)` after resolving and the render path filters selection to cards still in the room (`PlayScreen.tsx:104-105`). The bridge must replicate both: clear the selection when the selected card resolves, and ignore/ring-off selections that no longer match a room card, so no stale highlight lingers on the canvas.
- **Keyboard selection requires a new overlay control**: roving focus is implemented *inline* in `PlayScreen.tsx:59-83` and moves DOM focus between `button.card:not([disabled])` elements — there is no reusable overlay control to "reuse", and it cannot survive the cards leaving the DOM. Phase 1 must extract/build an overlay selection control (arrow/Home/End cycling `selectCard`) with a screen-reader contract: the control announces the newly selected card's name on each cycle, and the visible selection indicator stays in DOM (ActionPanel heading names the selected card). The canvas renders only the highlight ring and never receives focus.
- **Card tooltips need a canvas-path story that keeps keyboard and touch parity**: today hints appear on hover *and* `:focus-within` (`Tooltip.tsx:70-77`), so keyboard users get them for free on card focus. Sprites have neither a DOM hover target nor a focus target, so the plan is: the bridge forwards sprite pointer-over/out to a cursor-synced DOM tooltip for pointer users, *and* the overlay renders the selected card's hint in DOM (ActionPanel or the selection control) so keyboard users keep the onboarding layer. Tap on touch acts as hover (tap-to-reveal, second tap selects). Dropping hints is not acceptable — they are the onboarding layer.
- **Coordinate mapping is a named bridge API**: FIT scales the canvas via CSS while the backbuffer stays at config size, so every client→game coordinate consumer — the tooltip bridge, tap/pointer hit tests, and the Playwright input path (Phase 1) — needs a shared client↔game transform helper (`game/coordinates.ts`). The plan's e2e input contract (§4, Phase 1) depends on exposing it.
- **Game lifecycle owned by React**: `useLayoutEffect` creates the Phaser game into a container ref; cleanup calls `game.destroy(true)`. **`destroy()` is asynchronous in Phaser 4**, so cleanup must not assume synchronous teardown: guard with the official template's null-check pattern (create only if the ref is empty), and on HMR decide explicitly between accepting an overlapping boot and forcing a full reload of `game/` modules. The scale parent needs explicit CSS dimensions — a zero-height container breaks FIT centering.
- **Code splitting**: `await import('phaser')` (dynamic) inside the play-screen bootstrap so title/stats routes never load the ~356 KB gzip chunk. Phaser ships as one prebuilt ESM file with no tree-shaking, so lazy-loading the whole chunk is the only real lever; set an explicit chunk name and confirm with a bundle report in the Phase 0 spike.
- **The renderer flag is per-device appearance, not shareable state**: `src/store/share.ts` encodes only `seed` plus three config tokens (free-run, free-potions, no-degradation). The `tableRenderer` flag deliberately does **not** round-trip through the URL; it lives in `scoundrel:settings` only. Consequence: e2e must seed `localStorage` (as Phase 1 specifies) rather than appending a query param.

### Version & tooling

- **Phaser 4** (`phaser@^4.2.1`): Phaser 4.2.1 is GA (2026-07-09) and current; types and ESM `exports` are bundled (no `@types/phaser` — that package is gone), so a plain Vite import works. The official React 19 + Vite 6 template uses exactly the create/destroy pattern above. **Phase 0 verification step**: confirm interop in a spike. Fallback if blocked: latest Phaser 3.x (3.90.0) — the migration delta for our footprint (tweens, sprites, FIT, pointer, text) is small, but code must avoid v4-only features (filters/masks replacing FX, `setTintFill`, `Vector2`, `SpriteGPULayer`) to keep that one-line dependency swap real. Note the canvas renderer is **deprecated in v4**, so `Phaser.CANVAS` is not a fallback path.
- **Pin ≥ 4.2.1**: 4.x is still receiving monthly renderer fixes (4.2.1 fixed parent-container scaling, tween start-delay state, and ESM namespace breakage).
- Scale manager: `Phaser.Scale.FIT` inside the play-screen container for responsive sizing; CSS still controls outer layout and the container must have explicit dimensions.
- Assets: reuse the existing `import.meta.glob` map in `src/ui/card-image.ts:9-19` — feed the Vite-hashed URLs to `this.load.image(key, url)` with absolute base-aware URLs. 44 textures, no sprite sheets needed initially; if a texture fails to load, render a generated placeholder (suit-toned fill + rank/suit `Text`) for parity with `CardView`'s DOM image-failure fallback.
- Rendering quality: **Phaser 4 has no `resolution`/device-pixel-ratio config** (Phaser 3's `resolution` was removed in 3.16 and `zoom` is CSS-scale only). Decide in the Phase 0 spike between a larger base resolution scaled down by FIT, or `RESIZE`/`EXPAND` for 1:1 pixel mapping; keep `antialias: true` for JPEG card art (never `pixelArt: true`), and verify crispness on hi-dpi mobile. Add a documented input-mapping check so pointer/tap coordinates stay correct at every scale.
- **Known risk to test in the spike**: open Phaser 4.2.1 bug [#7372](https://github.com/phaserjs/phaser/issues/7372) — rotated textured objects in a multi-texture batch tear (reproduction is literally "a fanned hand of cards"), which is exactly the kill-stack fan (`WeaponStack.tsx:67-68`) and stack-drop tweens. Pre-commit a mitigation (rotate the container/camera instead of the sprite, limit texture units, or fall back to Phaser 3.x).

## 4. Phased rollout

Each phase ships working; a feature flag (`settings.appearance.tableRenderer: 'dom' | 'phaser'`, default `dom`) keeps the old DOM play screen as fallback until Phase 4 removes it.

**Settings migration mechanism (exact, because the naive reading destroys saves).** `SCHEMA_VERSION` is global (`src/store/persistence.ts:12`) and stamped on *every* shard by `save()`. The run shard loads via `migrateVersion(1, …)` (`game-store.ts:33`) and `fromVersion > current` returns `null`. Bumping the global constant would therefore stamp newly saved run/stats shards as v2 and make `loadRunSave()` silently return `null` — killing "resume saved run" and stats recording. So: bump **only the settings call-site literal** in `src/store/settings.ts` (leaving the global `SCHEMA_VERSION` at 1), or bump globally *and* chain migrations for run/stats. Either way, add a regression test that a run saved after the bump still loads. Separately, `read()` and the `SettingsData` validator must learn the new field (`SettingsData` is currently `{ config, language }` only — `isValidConfig` validates `GameConfig`, not settings, so a new settings validator is needed) and `saveSettings` must persist it, or the flag is silently dropped on every load. The flag starts **dev-gated** in Phase 1 and becomes a visible SettingsScreen toggle with `en`/`zh` keys in Phase 2 (see §7.5).

### Phase 0 — Spike (throwaway)
- Branch + worktree (`.worktrees/feat-phaser` per repo convention).
- Install `phaser`, mount a bare Phaser game on `#/play` behind the flag; load all 44 card textures; render one room statically; verify: dynamic import chunking, StrictMode mount/unmount, async `destroy()` behavior, asset URLs, FIT scaling with a sized container, pointer events through the React overlay, the client↔game coordinate helper, zoom (200%) behavior of canvas vs overlay, tap-as-hover on touch, and hi-dpi crispness.
- Render a **fanned, rotated kill stack** statically and mid-tween to settle the #7372 risk before Phase 2 depends on it.
- Verify canvas rendering under CI's headless Chromium (SwiftShader WebGL). If it is flaky there, the decision is Phaser 3.x or Playwright-only canvas checks — **`Phaser.CANVAS` is deprecated in v4 and `Phaser.HEADLESS` still requires a DOM**, so neither is a usable fallback inside the vitest/jsdom environment.
- Also verify: no module reachable from an RTL-tested import chain imports `game/` eagerly — the dynamic-import rule extends to test-time imports (jsdom has no canvas/WebGL).
- Exit criteria: all verified, or fallback decision (Phaser 3.x) made.

### Phase 1 — Parity (Phaser renders the table, statically)
- **Store result channel first** (blocking prerequisite): `lastResult: { result, seq }` in `game-store.ts`, set from `act()` and `startRun()`, with unit tests; plus the stale-comment hygiene fix (`game-store.ts:118` says resolving "invalidates the selection" — the store keeps it and components clear it).
- `table-scene` renders the full play state: 4 room cards (carried-card badge/tint), weapon card left, kill stack right (last-killed on top), deck count, decorative HP visuals. Click-to-select parity with DOM (`selectedCardId` highlight). Bridge implements result-consumption, snapshot-first-sync (seeding `seq`), and the state-diff fallback from the start — undo correctness is a Phase 1 exit criterion, not a Phase 2 afterthought.
- **DOM room mirror (a11y + test seam)**: an `aria-hidden` DOM list mirroring the room with `data-card-id` per card, so (a) Playwright can keep driving *input* — the current spec clicks room cards (`e2e/scoundrel.spec.ts:100`, `222-226`, `322-323`) and reads room composition via `.room [data-card-id]` (`spec:19-23`, asserted at `188`, `195`, `220`, `247`, `261`, `291`, `306`, `319`, `324`, `330`), and (b) room state remains readable outside the canvas. Decide the interaction contract here and state it in the plan's testing section: mirror nodes are non-focusable, clearly `aria-hidden`, and renderer-switch-independent.
- Flag plumbing: settings migration per the exact mechanism above, the renderer switch in `PlayScreen`, the **dev-gated** renderer toggle, and a SettingsData validator.
- DOM weapon-zone readout: once the canvas owns the weapon + kill stack visuals, the information in `WeaponStack.tsx` needs a compact DOM home. Not just weapon id, threshold, and kill count: `WeaponStack` also carries `role="list"`/`listitem` semantics, a per-kill `cardAriaLabel`, and the localized last-kill badge (`WeaponStack.tsx:55-72`) — the readout must preserve list semantics plus a last-kill label, and the weapon element must carry `data-card-id` (the e2e bot reads `.weapon-card` + `data-card-id` at `e2e/scoundrel.spec.ts:87-89`, asserted at `325`/`331`).
- Keyboard parity lands here: extract/build the overlay selection control (arrow/Home/End cycling `selectCard`) with the screen-reader contract above, replacing the inline roving-focus nav (`PlayScreen.tsx:59-83`) for the Phaser path.
- Selection control as the integration-test seam: RTL tests can no longer click `.card` buttons under the Phaser path (roughly 6 of 19 integration tests click card buttons via the `cardButton()` helper, `tests/ui.test.tsx:52-58`), so they drive selection through the overlay control and resolve through the overlay ActionPanel buttons.
- e2e under the Phaser path: seed `localStorage` (`scoundrel:settings` → `tableRenderer: 'phaser'`) before page load and re-run the existing spec against the canvas renderer with animations disabled, *including* the keyboard-navigation test (`spec:192-214`, which asserts focus and `.selected-ring`) via its DOM-mirror/control equivalent. CI runs both paths from here until Phase 4; otherwise Phase 4 deletes the DOM fallback without the canvas path ever having been e2e-tested. Budget for the doubled CI runtime.
- **Minimal canvas visual regression lands here**, not in Phase 3: one scene snapshot (Phaser's own snapshot mechanism) covering card layout, because RTL and DOM e2e are blind to the canvas and would otherwise let layout/hit-area regressions ship undetected.
- DOM overlay still owns all buttons/tooltips/announcements; e2e assertions stay on the DOM overlay.
- Exit criteria: pixel-equivalent information to the DOM table; bridge consumes `lastResult` with an exhaustiveness guard; integration tests updated (selection via the overlay control); all existing e2e green *and* green with `tableRenderer: 'phaser'`; undo renders correctly under Phaser; keyboard card selection works with announcements; one scene snapshot passing.

### Phase 2 — Motion (the payoff)
- Deal animation on room entry; selected-card lift; card resolve animations (attack impact + damage number; potion glow + HP feedback; weapon pickup + old-stack discard sweep to discard); kill-stack drop with last-killed-on-top; run-away sweep; room-clear/enter-next-room transition; win/lose flourish with the gated GameOverScreen handoff.
- **Terminal-action reconstruction**: because `GameWon`/`GameLost` replace the base result, the bridge derives the killing-blow / final-resolve presentation from the state diff (HP delta, `killStack` append, `room` diff) and plays it before the run-ended flourish.
- `RunAwayBlocked` and `InvalidAction` map to subtle error feedback (nudge/shake) rather than silence, matching the announcement strings — driven by `lastResult`, since these are no-op state diffs.
- All animations driven by `GameResult` payloads (via `lastResult`) plus the terminal-diff rule; engine untouched.
- Honor `prefers-reduced-motion` (matchMedia check → skip/instant tweens) and an explicit animation-disable escape hatch for deterministic e2e. Decide the carrier (Playwright's `reducedMotion` emulation vs a URL param) and, for preference, honor both.
- Visible SettingsScreen renderer toggle + `en`/`zh` keys land in this phase, alongside the motion it advertises.

### Phase 3 — Juice & polish
- Camera shake on big hits, weapon-break flash, potion particles, subtle backdrop ambience, animated HP drain, carried-card shimmer.
- **Weapon-break flash keying**: `MonsterDefeated.weaponBroke` is always `false` (`src/engine/engine.ts:265`) and `WeaponEquipped.discardedWeaponId` is set on *every* equip — including voluntary upgrades, where nothing broke (`engine.ts:280-285`). Keying the flash to `discardedWeaponId` would misfire on every honest swap. Either derive the break from a `MonsterDefeated` whose weapon path was illegal (the bridge can re-derive it from `previewFight` against the pre-action state) or drop the effect.
- Designer review pass on the table's look and motion feel (route through designer).

### Phase 4 — Consolidation
- Delete the DOM play table (`CardView` table path, `WeaponStack`, static offsets), remove the feature flag and its settings migration path, update `docs/spec.md` (toolchain + visual sections) and AGENTS.md architecture notes.
- Before deleting anything: confirm the overlay-driven keyboard card selection (Phase 1) fully replaces the DOM room's roving-focus nav — deletion must not remove keyboard card access; confirm the Phase 1 DOM readout fully replaces `WeaponStack`'s information *including list semantics and the last-kill label*; confirm the DOM room mirror is either retained (test/a11y seam) or replaced by an equivalent; and confirm the e2e suite has been running green against the Phaser path (not just the flag-default DOM path).
- Keep: DOM overlay, all a11y infra, engine, store result channel.

## 5. Testing strategy (three seams preserved)

1. **Engine seam — unchanged**: reducer tests in `src/engine/` keep passing; Phaser is invisible to the engine.
2. **React seam — mostly unchanged**: overlay components keep RTL tests. New unit tests for `store-bridge` (result → presentation-command mapping, exhaustiveness guard over `GameResult`, snapshot first-sync seeding `seq`, undo state-diff fallback, terminal-result diff reconstruction) with a stubbed scene; store unit tests for `lastResult` sequencing. The win/lose handoff gate gets a unit test covering its fail-open timeout. Under the Phaser path, integration tests drive card selection through the overlay control (see Phase 1) instead of clicking `.card` buttons — no canvas interaction, no Phaser under jsdom.
3. **e2e seam — adapted**: Playwright cannot query inside a canvas. Mitigations:
   - All player-visible state assertions stay on the DOM overlay (announcements, HUD, weapon-zone readout, buttons) and the scorecard — which already covers outcomes via seeded URLs.
   - **Input, not just assertions, moves to DOM**: card selection is driven through the aria-hidden DOM room mirror / overlay selection control; the mirror's `data-card-id` keeps the auto-play bot's room reads and clicks working.
   - The existing spec runs against both renderer values from Phase 1: Playwright seeds `localStorage` with `tableRenderer: 'phaser'` before load.
   - Animations disabled in e2e (reduced-motion emulation or escape hatch) so canvas state settles instantly.
   - One scene-level snapshot comparison in Phase 1 (extendable in Phase 3) so canvas layout regressions are visible at all.
   - Do **not** plan on running Phaser under vitest/jsdom: `Phaser.HEADLESS` still requires a DOM and the canvas renderer is deprecated in v4. Scene logic is tested through the stubbed-scene bridge unit tests; anything that truly renders belongs in Playwright. CI's headless Chromium renders WebGL via SwiftShader — verified in the Phase 0 spike, since #7372-class renderer bugs can differ between SwiftShader and real GPUs.

## 6. Risks & mitigations

| Risk | Mitigation |
|---|---|
| Bridge receives no result payloads (store discards them) | Phase 1 adds `lastResult: { result, seq }` to the store before any bridge work; the bridge's cue sheet is fully derived from it. Blocking prerequisite, not an assumption |
| Terminal actions lose their base result (death blow / final resolve) | Bridge reconstructs the terminal presentation from the state diff before the flourish (§3) |
| No-op results (`RunAwayBlocked`, `InvalidAction`) are invisible to state diffing | Drive them from `lastResult`, never from the diff; the diff fallback is a supplement |
| A11y regression on the play screen | Canvas renders *only* the table; every interactive control, label, and announcement remains real DOM. Keyboard card navigation is overlay-owned with a screen-reader announcement contract; canvas renders only the highlight ring and never takes focus. Tooltips stay reachable for keyboard (selected-card hint in DOM) and touch (tap-as-hover). Undo renders via the state-diff fallback so announcements stay the source of truth |
| Canvas text/i18n friction | No gameplay text in canvas in Phase 1–2 (rank/suit glyphs only); i18n text lives in the DOM overlay. If in-canvas text is needed later, use `Text` (system-font canvas rendering, unicode-safe), never `BitmapText` atlases |
| Scene state drifts from store (undo, hydrate, two-notifications-per-resolve) | Bridge mirrors the rendered state, keyed off `lastResult.seq`; selection sync is idempotent and never cancels a resolve tween; any mismatch — including `UndoDone` — triggers a full rebuild from state with a cross-fade |
| Win/lose flourish traps the user (gate never opens) | Handoff gate is time-bounded and fail-open: GameOverScreen renders after a short timeout even if the flourish never reports completion |
| Bundle size | Dynamic import of the whole ~356 KB gzip chunk (no tree-shaking available); measure with a bundle report in the spike |
| StrictMode double-mount / HMR breakage (async `destroy()`) | Official template's create-once guard + `destroy(true)` in cleanup; explicit HMR decision; container needs CSS dimensions |
| Phaser 4 renderer bug (#7372): rotated fanned cards tear | Phase 0 spike reproduces the fan; pre-commit mitigation (rotate container/camera, limit texture units) or Phaser 3.x fallback |
| Phaser 4 rough edges generally | Phase 0 spike gate; Phaser 3.x is a real fallback (code against the common subset), but `Phaser.CANVAS` is *not* (deprecated in v4) |
| Two rendering code paths to maintain temporarily | Feature flag + Phase 4 deletion deadline; the flag ships dev-gated in Phase 1 and visible only in Phase 2, never as the production default |
| Pointer events blocked by React overlay | Overlay is HUD/action panels at edges, `pointer-events: none` except on interactive elements; canvas receives card clicks directly via the shared coordinate helper |
| e2e/RTL locators *and inputs* die with the DOM table | Phase 1 adds the aria-hidden DOM room mirror (keeps `data-card-id`, drives selection) and the DOM weapon-zone readout; e2e runs both renderer values until Phase 4; CI runtime doubles and is budgeted |
| Settings migration wipes saved runs/stats | Bump only the settings call-site version (or chain run/stats migrations); regression test that a post-bump run still loads |
| Canvas regressions invisible to RTL/DOM e2e | One scene snapshot in Phase 1 exit criteria |

## 7. Open questions (settle before Phase 1)

1. **Scope of canvas ownership** — *blocking*: HUD inside canvas vs DOM overlay. The plan assumes DOM overlay for a11y (canonical `role="meter"`, i18n, previews); deciding late invalidates Phase 1's Hud and a11y work.
2. **Art direction for motion**: hand-authored tween timing per action (recommended; designer-owned) vs a generic motion preset.
3. **Damage numbers**: in-canvas floating damage text (canvas `Text`, ephemeral, acceptable) vs DOM preview only.
4. **Backdrop art**: reuse raster title art as table backdrop vs procedural Phaser-generated ambience.
5. **Flag UX** — *resolved as a sequencing rule*: dev-gated in Phase 1 (no user-visible toggle), visible Appearance setting with `en`/`zh` keys in Phase 2 alongside the motion it advertises. This prevents Phase 1 from shipping a user-reachable, animation-less renderer.
6. **DOM room mirror retention**: keep it after Phase 4 as a permanent a11y/test seam, or remove it once the overlay control is the only input path? (Leaning keep — it is cheap and it is also the room-composition a11y fallback.)

## 8. Effort estimate

- Phase 0: spike (incl. rotated-fan reproduction, zoom/touch/coordinate checks, CI WebGL check), ~1 day.
- Phase 1: store result channel + parity table scene + bridge (result consumption, snapshot first-sync, undo fallback) + DOM room mirror + weapon-zone/readout + keyboard control extraction + flag/settings migration + tests + dual-path e2e, ~5–8 days.
- Phase 2: animation set + terminal-diff reconstruction + gated win/lose handoff + visible toggle, ~2–4 days (designer overlap for motion feel).
- Phase 3: juice pass, ~1–2 days.
- Phase 4: cleanup + doc updates, ~0.5–1 day.

Engine changes required: none. Store changes: additively — `lastResult` plus a settings field — but no longer "no store changes": the result channel is a prerequisite for the bridge, and the settings version bump must be scoped to the settings shard (or chained) to avoid invalidating saved runs.
