# Scoundrel — Phaser Integration Plan

Status: proposal (no code changes yet). This plan evaluates where the Phaser game framework improves the current implementation and defines a phased introduction. `docs/rules.md` stays the canonical rule set; `docs/spec.md` describes the current architecture.

## 1. Why Phaser — where it improves the current app

The current UI is a fully DOM/CSS app (`src/styles.css`, 961 lines) with **no animation layer beyond hover/select lifts**. Scouting the codebase shows the gaps a game engine fills:

| Gap today | What Phaser brings |
|---|---|
| No card-deal, flip, discard, or damage animations — resolving a card is an instant DOM swap | Tweens, tween chains, ease functions, custom easing: dealt cards slide into the room, fights resolve with impact, defeated monsters slide onto the kill stack |
| `WeaponStack.tsx` fans the kill stack with hand-computed static offsets (`right: i*40, top: i*16`) | Physical card-stack behavior: cards drop onto the stack with a small bounce; stack is a natural sprite pile |
| Feedback is text-only (result payloads → ARIA announcements) | Camera shake on damage, flash on weapon break, particle burst on potion heal, HP-bar drain animation — feedback players *feel* |
| HP bar is a plain width-% div | Animated/segmented HP meter with tweened drain + hit flash |
| Room transition (`Enter Next Room`) is an instant re-render | Animated room clear: resolved cards sweep away, carried card slides forward, new cards deal |
| No juice of any kind | Muzzle-free particle/parallax options for the dungeon atmosphere (subtle dust/ember backdrop) |

The engine rewards none of this effort at present: the game is mechanically complete and correct, but the presentation is static. Phaser's value is almost entirely in the play screen's "game table" feel.

## 2. Where Phaser would hurt — constraints to protect

The current app has first-class properties that a naive full-canvas rewrite destroys:

- **Accessibility**: ARIA labels on every card, live-region announcements driven by engine result payloads, roving-focus keyboard navigation, focus-managed modals. Canvas rendering has no official ARIA story.
- **i18n**: every string flows through typesafe-i18n (`en`/`zh`). Canvas text requires manual font/layout handling and loses free text selection/SR semantics.
- **Test seams**: RTL integration tests assert accessible rendered output; Playwright e2e asserts via DOM locators with seeded URLs. A canvas is opaque to both.
- **Screens outside gameplay** (title, stats, settings, about) are forms, tables, and text — exactly what DOM does well and canvas does badly.
- **Bundle**: Phaser is ~1MB+ minified. A global import would tax every route.

Conclusion: **hybrid architecture, not a rewrite**. Phaser owns the play screen's game table (room cards, weapon + kill stack, animations, effects). React keeps everything else and overlays text/HUD on the canvas. The pure engine and Zustand store are reused untouched — Phaser is a *renderer* for the same store.

## 3. Target architecture

```
src/
├── engine/        UNCHANGED — pure reducer, zero React/Phaser
├── store/         UNCHANGED — game-store, persistence, share; + settings schema
│                  migration for the renderer flag + small additive helpers
├── ui/            React: title/stats/settings/about screens, PlayScreen shell,
│                  DOM overlay components (Hud, tooltips, action buttons, live region)
└── game/          NEW — Phaser layer (React-free, mounts inside PlayScreen)
    ├── game.ts        Game bootstrap/config (scale, scene registry); created/destroyed by React
    ├── scenes/
    │   ├── table-scene.ts     Room layout: 4 card sprites, weapon, kill stack, HP
    │   └── (later) fx-scene   Particles/backdrop ambience, if needed
    ├── card-textures.ts      AssetId → Phaser texture loading (wraps card-image.ts map)
    ├── animations.ts         Named tweens: dealCard, flipIn, attackImpact, stackDrop, roomClear
    └── store-bridge.ts       Subscribes to Zustand store → drives scene; routes clicks → act()
```

Key decisions:

- **One-way data flow, same as React**: the scene never mutates game state. `store-bridge` subscribes to the store and issues *presentation commands* (dealt, resolved, hp-changed, run-ended); pointer input on card sprites toggles `selectCard` (the store's selection slice), and resolution runs through the overlay ActionPanel buttons via `useGameStore.act(GameAction)` — the same select-then-act flow as today, not direct `act` calls from the canvas. Transient selection stays in the store's `selectedCardId` slice — the scene renders the highlight.
- **Canvas HP is decorative; the DOM meter is canonical**: the scene may draw HP visuals (drain animation, hit flash) but the authoritative accessible readout stays the DOM `role="meter"` in the Hud. Both derive from the same store, so they cannot diverge in value — only in presentation.
- **Result payloads are the animation cue sheet**: the scene must handle every variant of the `GameResult` union (`src/engine/types.ts`) — `RoomDealt{cards, carriedFrom}`, `MonsterDefeated{cardId, damage, usedWeaponId, weaponBroke}` (`cardId` selects the sprite; `usedWeaponId` picks bare-vs-weapon impact), `PotionQuaffed{cardId, healed, wasted}`, `WeaponEquipped{cardId, discardedWeaponId, discardedMonsterIds}`, `RanAway{newCards}` (deal-in of the new room), `RunAwayBlocked{reason}` (shake/no-op feedback, never silence), `UndoDone`, `InvalidAction{reason}` (error nudge), `GameWon/GameLost{score, ...}` (flourish + handoff). announcements.ts already maps these to strings; the scene maps them to tweens. Engine needs zero changes. (`RunStarted` arrives only before a scene mount, so the snapshot first-sync covers it; the bridge may ignore it.)
- **State-diff fallback for undo**: `UndoToRoomStart` restores the room from `roomSnapshot` and emits only `UndoDone` — no diff. Forward tweens cannot represent a backward jump (cards reappear, HP rebounds, kill stack changes). On `UndoDone`, or whenever a subscribed state fails to match the scene's model, the bridge rebuilds the scene from state with a short cross-fade instead of playing tweens. The bridge therefore always carries a mirrored model of the rendered state and compares it after every store notification.
- **First sync is a snapshot, not events**: on reload with a saved run (`hydrate`), a seeded replay URL, or a StrictMode remount, the scene mounts with no `RoomDealt` event. The bridge's first job is to render full state statically (initial sync) with all intro animations suppressed; deal animations only play for `RoomDealt` results observed *after* mount.
- **Win/lose handoff is gated**: `PlayScreen` switches to `GameOverScreen` as soon as `phase !== 'playing'`, unmounting the canvas. The Phase 2 win/lose flourish must complete before the switch: on `GameWon`/`GameLost` the bridge signals completion and React (local state or a store gate) delays the GameOverScreen render until the flourish finishes. The gate must be time-bounded (fail-open after a short timeout) so a11y and e2e never wait on it.
- **DOM overlay stays**: Hud (HP readout as real `role="meter"`, deck count, seed), ActionPanel buttons (with damage previews), Tooltip, LiveAnnouncer, and the abandon-run modal remain React DOM layered above the canvas. This preserves a11y, i18n, and preview logic for free. Note the current overlay does *not* contain the weapon-zone data — see the Phase 1 work list.
- **Selection semantics move into the bridge**: the store keeps `selectedCardId` on `act` (only undo clears it); today `PlayScreen`'s click handlers call `selectCard(null)` after resolving and the render path filters selection to cards still in the room (`PlayScreen.tsx:104-105`). The bridge must replicate both: clear the selection when the selected card resolves, and ignore/ring-off selections that no longer match a room card, so no stale highlight lingers on the canvas.
- **Card tooltips need a canvas-path story**: sprites have no DOM hover target, so the React `Tooltip` cannot wrap them. The bridge forwards sprite pointer-over/out to a cursor-synced DOM tooltip (reusing the existing Tooltip component) so card hints and the degradation-chain text survive; dropping hints is not acceptable — they are the onboarding layer.
- **Game lifecycle owned by React**: `useEffect` creates the Phaser game with a container ref, cleanup calls `game.destroy(true)`. Handle React StrictMode double-mount via destroy-on-cleanup (per Phaser's official Vite guide).
- **Code splitting**: `await import('phaser')` (dynamic) inside the play-screen bootstrap so title/stats routes never load the ~1MB chunk. Set an explicit chunk name; Vite `manualChunks` if needed.

### Version & tooling

- **Phaser 4** (`phaser@^4.2.1`, npm package `phaser`): bundled TS types (no `@types/phaser`), proper ESM `exports` — plain Vite import. **Phase 0 verification step**: confirm Phaser 4 + Vite 6 + React 19 interop in a spike; if Phaser 4 has blocking rough edges, fall back to latest Phaser 3.x (migration delta for our use case is small — tweens/particles/scale APIs are stable across both).
- Scale manager: `Phaser.Scale.FIT` inside the play-screen container for responsive sizing; CSS still controls outer layout.
- Assets: reuse the existing `import.meta.glob` map in `src/ui/card-image.ts` — feed the Vite-hashed URLs to `this.load.image(key, url)` with absolute base-aware URLs. 44 textures, no sprite sheets needed initially; if a texture fails to load, render a generated placeholder (suit-toned fill + rank/suit `Text`) for parity with `CardView`'s DOM image-failure fallback.
- Rendering quality: decide in the Phase 0 spike how `Phaser.Scale.FIT` interacts with device pixel ratio (`resolution`/`zoom` config, antialias, JPEG texture filtering/`setTextureFilter`) — card art must stay crisp on hi-dpi mobile, the primary target device.

## 4. Phased rollout

Each phase ships working; a feature flag (`settings.appearance.tableRenderer: 'dom' | 'phaser'`, default `dom`) keeps the old DOM play screen as fallback until Phase 4 removes it. Introducing the flag requires a persisted-settings schema migration (bump the version consumed by `migrateVersion` in `src/store/settings.ts`) plus a SettingsScreen toggle with `en`/`zh` i18n keys — scheduled in Phase 1's work list. Note that bumping the version is not enough: `read()`/`isValidConfig` in `src/store/settings.ts` must learn the new field (and `saveSettings` persist it), or the stored flag is silently dropped on every load.

### Phase 0 — Spike (throwaway)
- Branch + worktree (`.worktrees/feat-phaser` per repo convention).
- Install `phaser`, mount a bare Phaser game on `#/play` behind the flag; load all 44 card textures; render one room statically; verify: dynamic import chunking, StrictMode mount/unmount, asset URLs, mobile FIT scaling, pointer events through the React overlay, hi-dpi rendering quality, and canvas rendering under CI's headless Chromium (SwiftShader WebGL) — with a documented `Phaser.HEADLESS`/`Phaser.CANVAS` fallback if WebGL is flaky there.
- Also verify: no module reachable from an RTL-tested import chain imports `game/` eagerly — the dynamic-import rule extends to test-time imports (jsdom has no canvas/WebGL).
- Exit criteria: all verified, or fallback decision (Phaser 3.x) made.

### Phase 1 — Parity (Phaser renders the table, statically)
- `table-scene` renders the full play state: 4 room cards (carried-card badge/tint), weapon card left, kill stack right (last-killed on top), deck count, decorative HP visuals. Click-to-select parity with DOM (`selectedCardId` highlight). Bridge implements snapshot-first-sync and the state-diff fallback from the start — undo correctness is a Phase 1 exit criterion, not a Phase 2 afterthought.
- Flag plumbing: settings schema migration (`migrateVersion` bump for the new `appearance.tableRenderer` field, `src/store/settings.ts` — plus `read()`/`isValidConfig` validators and `saveSettings` so the field actually persists), the renderer switch in `PlayScreen`, a SettingsScreen toggle, and new `en`/`zh` i18n keys.
- DOM weapon-zone readout: once the canvas owns the weapon + kill stack visuals, the threshold text and slain-monster info that live in `WeaponStack.tsx` today need a compact DOM home (weapon card id, threshold, kill count; weapon element carries `data-card-id`). This keeps the info accessible *and* keeps e2e working — the e2e auto-play bot reads `.weapon-card[data-card-id]` (`e2e/scoundrel.spec.ts:87-89`) and asserts it at lines 325/331.
- Selection control as the integration-test seam: RTL tests can no longer click `.card` buttons under the Phaser path, so they must drive selection through the overlay keyboard control (`selectCard`) and resolve through the overlay ActionPanel buttons — that control is the only DOM-reachable path to `selectedCardId` once cards leave the DOM.
- e2e under the Phaser path: seed `localStorage` (`scoundrel:settings` → `tableRenderer: 'phaser'`) before page load and re-run the existing spec against the canvas renderer with animations disabled. CI runs both paths from here until Phase 4; otherwise Phase 4 deletes the DOM fallback without the canvas path ever having been e2e-tested.
- Hygiene: correct the stale comment in `src/store/game-store.ts` ("resolving or fleeing invalidates the selection" — the store keeps it; components clear it). The bridge encodes this behavior, so the comments must not contradict it.
- Keyboard parity lands here too: arrow/Home/End cycling of `selectCard` driven from an overlay control (see §6), with the canvas rendering the highlight.
- DOM overlay still owns all buttons/tooltips/announcements; e2e assertions stay on the DOM overlay.
- Exit criteria: pixel-equivalent information to the DOM table; integration tests updated (selection via the overlay control); all existing e2e green *and* green with `tableRenderer: 'phaser'`; undo renders correctly under Phaser; keyboard card selection works.

### Phase 2 — Motion (the payoff)
- Deal animation on room entry; selected-card lift; card resolve animations (attack impact + damage number; potion glow + HP feedback; weapon pickup + old-stack discard sweep to discard); kill-stack drop with last-killed-on-top; run-away sweep; room-clear/enter-next-room transition; win/lose flourish with the gated GameOverScreen handoff.
- `RunAwayBlocked` and `InvalidAction` map to subtle error feedback (nudge/shake) rather than silence, matching the announcement strings.
- All animations driven by `GameResult` payloads; engine untouched.
- Honor `prefers-reduced-motion` (matchMedia check → skip/instant tweens) and a `?anim=0`-style escape hatch for deterministic e2e.

### Phase 3 — Juice & polish
- Camera shake on big hits, weapon-break flash (keyed to `WeaponEquipped.discardedWeaponId` — the engine never sets `MonsterDefeated.weaponBroke` to `true`, `src/engine/engine.ts:265`, so that field is not a usable animation cue), potion particles, subtle backdrop ambience, animated HP drain, carried-card shimmer.
- Designer review pass on the table's look and motion feel (route through designer).

### Phase 4 — Consolidation
- Delete the DOM play table (`CardView` table path, `WeaponStack`, static offsets), remove the feature flag and its settings migration path, update `docs/spec.md` (toolchain + visual sections) and AGENTS.md architecture notes.
- Before deleting anything: confirm the overlay-driven keyboard card selection (Phase 1) fully replaces the DOM room's roving-focus nav — deletion must not remove keyboard card access; confirm the Phase 1 DOM weapon-zone readout fully replaces `WeaponStack`'s information; and confirm the e2e suite has been running green against the Phaser path (not just the flag-default DOM path).
- Keep: DOM overlay, all a11y infra, engine, store.

## 5. Testing strategy (three seams preserved)

1. **Engine seam — unchanged**: reducer tests in `src/engine/` keep passing; Phaser is invisible to the engine.
2. **React seam — mostly unchanged**: overlay components keep RTL tests. New unit tests for `store-bridge` (result → presentation-command mapping, snapshot first-sync, undo state-diff fallback) with a stubbed scene. The win/lose handoff gate gets a unit test covering its fail-open timeout. Under the Phaser path, integration tests drive card selection through the overlay control (see Phase 1) instead of clicking `.card` buttons — no canvas interaction, no Phaser under jsdom.
3. **e2e seam — adapted**: Playwright cannot query inside a canvas. Mitigations:
   - All player-visible state assertions stay on the DOM overlay (announcements, HUD, weapon-zone readout, buttons) and the scorecard — which already covers outcomes via seeded URLs.
   - The existing spec runs against both renderer values from Phase 1: Playwright seeds `localStorage` with `tableRenderer: 'phaser'` before load; the weapon readout's `data-card-id` keeps the auto-play bot's locator working.
   - Animations disabled in e2e (`reduced motion` or escape hatch) so canvas state settles instantly.
   - Add Phaser screenshot comparisons (scene-level, Phaser's own WebGL snapshot) for visual regression on card layout — optional, Phase 3.
   - Run Phaser in `Phaser.HEADLESS` for scene logic tests where useful; do not chase full game-instance tests under jsdom (fragile canvas/WebGL stubbing). CI's headless Chromium renders WebGL via SwiftShader — verified in the Phase 0 spike, with a `Phaser.HEADLESS`/`Phaser.CANVAS` fallback documented if flaky.

## 6. Risks & mitigations

| Risk | Mitigation |
|---|---|
| A11y regression on the play screen | Canvas renders *only* the table; every interactive control, label, and announcement remains real DOM. Keyboard card navigation is overlay-owned: arrow/Home/End keys on an overlay control (the room group's `role="group"` container or an equivalent button row) cycle `selectCard`; the canvas renders only the highlight ring, never receives focus. A visible selection indicator stays on the overlay too (e.g., the ActionPanel heading names the selected card), so keyboard users always see the selection in DOM. Undo renders via the bridge's state-diff fallback so announcements stay the source of truth |
| Canvas text/i18n friction | No gameplay text in canvas in Phase 1–2 (rank/suit glyphs only); i18n text lives in the DOM overlay. If in-canvas text is needed later, use `Text` (system-font canvas rendering, unicode-safe), never `BitmapText` atlases |
| Scene state drifts from store (undo, hydrate, edge cases) | Bridge mirrors the rendered state and compares after every store notification; any mismatch — including `UndoDone` — triggers a full rebuild from state with a cross-fade instead of forward tweens |
| Win/lose flourish traps the user (gate never opens) | Handoff gate is time-bounded and fail-open: GameOverScreen renders after a short timeout even if the flourish never reports completion |
| Bundle size | Dynamic import; measure; `manualChunks` split of phaser core |
| StrictMode double-mount / HMR breakage | Destroy in effect cleanup; guard bootstrap with a module-level singleton per container |
| Phaser 4 immaturity edge cases | Phase 0 spike gate; documented Phaser 3.x fallback |
| Two rendering code paths to maintain temporarily | Feature flag + Phase 4 deletion deadline; flag never ships to production default |
| Pointer events blocked by React overlay | Overlay is HUD/action panels at edges, `pointer-events: none` except on interactive elements; canvas receives card clicks directly |
| e2e/RTL locators die with the DOM table (`.weapon-card[data-card-id]`, `button.card`) | Phase 1 adds the DOM weapon-zone readout (keeps `data-card-id`) and makes the overlay selection control the test seam; e2e runs against both renderer values until Phase 4 |

## 7. Open questions (settle before Phase 1)

1. **Scope of canvas ownership**: HUD inside canvas vs DOM overlay (plan assumes DOM overlay for a11y; pure-canvas HUD is prettier but costs ARIA/meter semantics).
2. **Art direction for motion**: hand-authored tween timing per action (recommended; designer-owned) vs a generic motion preset.
3. **Damage numbers**: in-canvas floating damage text (canvas `Text`, ephemeral, acceptable) vs DOM preview only.
4. **Backdrop art**: reuse raster title art as table backdrop vs procedural Phaser-generated ambience.
5. **Flag UX**: hidden dev-only toggle vs a visible appearance setting in Phase 1–3.

## 8. Effort estimate

- Phase 0: spike, ~half a day.
- Phase 1: parity table scene + bridge (with snapshot first-sync and undo fallback) + flag/settings migration + keyboard parity + tests, ~3–4 days.
- Phase 2: animation set + gated win/lose handoff, ~2–4 days (designer overlap for motion feel).
- Phase 3: juice pass, ~1–2 days.
- Phase 4: cleanup + doc updates, ~0.5 day.

Engine changes required: none. Store changes: additive except the one-time settings schema migration for the renderer flag (see §4).
