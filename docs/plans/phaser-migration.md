# Plan: Migrate Scoundrel's UI from React to Phaser

Branch: `refactor/phaser` · Status: planned

## Goal

Replace the React UI layer with the Phaser framework (TypeScript, 2D), keeping the
pure game engine and Zustand store untouched. The motivation is experimentation
with Phaser for 2D game development, so the port should embrace Phaser idioms
rather than merely re-skin the DOM app.

## Decisions

- **Pure Phaser**: React is removed entirely; every screen (title, play, stats,
  settings, about, game over) becomes a Phaser scene. The current UI layer is
  small (~1,600 lines including CSS), so a full port is tractable.
- **Accessibility**: keep keyboard play (arrows/Home/End card roving, Enter to
  confirm, Escape to close dialogs) implemented inside Phaser; drop the
  ARIA/live-region layer and document it as a known regression of this
  experiment. Keep `cardAriaLabel` in `src/i18n.ts` rather than deleting it, so
  the regression stays cheap to reverse; optionally re-add screen-reader
  announcements late via a small off-screen DOM live region (see stage 10).
- **Testing**: replace the React Testing Library seam with (a) pure view-model
  helpers unit-tested in Vitest — extracted from the React UI _before_ any of it
  is deleted, so the behavioral spec survives the deletion — and (b) rewritten
  Playwright e2e that drives the real canvas via a `window.__SCOUNDREL__` debug
  handle exposed only when the URL carries a `?debug` query param (opt-in, so it
  is neither an always-on public surface on Vercel nor invisible to e2e
  production builds).
- **Visuals**: Phaser-native — reuse the dark RPG palette / gold accent as theme
  constants, but add motion (card select/resolve tweens, kill-stack fan, toast
  animations, scene transitions).

## What stays untouched

`src/engine/` (pure reducer + 54 colocated tests), `src/store/` (all 6 files —
Zustand's vanilla `getState()/subscribe()/setState()` drive scenes; `game-store`,
`persistence`, `stats`, `settings`, `share`, `announcements`), `typesafe-i18n`
catalogs (`src/i18n/`), `docs/rules.md`, `assets/` (44 card JPGs).

Two small seam fixes:

- `src/ui/card-titles.ts` and `src/ui/card-image.ts` are framework-free but live
  under `ui/` — move to `src/game/` (`src/i18n.ts` imports `card-titles.ts`, so
  this must move before `src/ui/` is deleted).
- `src/i18n.ts` touches `document.documentElement.lang` — fine in a browser or
  jsdom, no change needed; `t()` / `cardLabel()` / `cardHint()` are already
  non-React. For reactivity, scenes subscribe via the zustand vanilla
  `useLanguage.subscribe` instead of the `useT()` hook.

## Target structure

```
src/
  main.ts                 # replaces main.tsx: new Phaser.Game(config), mounts in #root
  styles.css              # shrinks to ~20 lines (page bg, canvas centering, focus outline)
  game/
    theme.ts              # palette/typography constants ported from styles.css :root tokens
    card-titles.ts        # moved from src/ui/
    card-image.ts         # moved from src/ui/ (import.meta.glob stays — Vite-agnostic)
    router.ts             # parseHash/navigate kept from src/ui/router.ts; a RouteController
                          #   subscribes to hashchange and swaps scenes (no useHashRoute hook)
    debug.ts              # exposes window.__SCOUNDREL__ = { game, store, worldToScreen }
                          #   only when the URL has ?debug (opt-in; see Decisions)
    scenes/
      BootScene.ts        # loads 44 card textures via card-image URLs + preload
      TitleScene.ts       # menu: Continue / New Run / seed entry / Stats / Settings / About
                          #   seed entry = overlaid DOM <input> styled to match (Phaser has
                          #   no native text input)
      PlayScene.ts        # HUD, room grid, action panel, weapon stack, toasts
      GameOverScene.ts    # overlay scene launched above PlayScene (scorecard, replay link)
      StatsScene.ts / SettingsScene.ts / AboutScene.ts
    widgets/
      CardSprite.ts       # artwork Image + graphics fallback (rank/suit) + select ring +
                          #   carried badge; input + keyboard focus APIs
      Button.ts           # label + disabled state + hover/press tween
      Tooltip.ts          # follows pointer, flips at screen edges
      Toast.ts            # replaces LiveAnnouncer: fades in/out on store announcements
      Dialog.ts           # abandon-confirm + game-over modal base (Escape closes)
      HpBar.ts / WeaponStack.ts
    view-models/          # PURE helpers extracted from PlayScreen.tsx logic — testable in
                          #   Vitest without Phaser: action-panel state (MonsterActions /
                          #   PotionActions / WeaponActions previews via previewFight etc.),
                          #   button enable/disable states, room layout math.
                          #   Rule: never import Phaser (or React) here — Node-testable only.
```

## Toolchain changes

- **package.json**: add `phaser` (latest stable). Remove `react`, `react-dom`,
  `@types/react*`, `@vitejs/plugin-react`, `@testing-library/*`,
  `eslint-plugin-react-hooks`, `eslint-plugin-react-refresh`.
- **vite.config.ts**: drop the react plugin; add `optimizeDeps:
{ exclude: ['phaser'] }` (Phaser must not be pre-bundled in dev) and
  `build.rollupOptions.output.manualChunks` to split phaser into its own vendor
  chunk. Vitest inline config stays (jsdom still needed for store/i18n tests).
- **tsconfig**: remove `jsx` React settings; ensure `"lib": ["dom"]` (Phaser
  needs DOM types).
- **eslint.config.js**: remove react-hooks/react-refresh plugins and rules.
- **index.html**: unchanged (`#root` div + module script pointing at
  `/src/main.ts`).
- **Scale strategy**: `Phaser.Scale.FIT` with a 1280×720 design resolution;
  responsive card sizing recomputed from the current game size (replaces the CSS
  `clamp()` card width). Playwright pins its viewport to exactly 1280×720 so the
  FIT scale factor is 1 and there is no letterboxing math; the debug handle
  exposes a `worldToScreen(cardId)` helper anyway so tests never hand-map
  coordinates.

## Implementation order (small commits, each leaving lint/typecheck/unit green)

> **E2e suspension window (intentional).** The old Playwright spec is deleted
> at stage 1 and its rewritten replacement lands at stage 9, so stages 1–8
> have no e2e safety net. That is why stage 0 moves the behavioral spec into
> pure, unit-tested code _first_.

0. **Extract view-models (React still present)**: move the action-panel logic
   out of `PlayScreen.tsx` — `previewFight` fight previews (Monster/Potion/
   Weapon), button enable/disable states, carry-over and room-complete gating —
   into pure helpers under `src/game/view-models/`, then have the React
   components consume those helpers. Port the relevant `tests/ui.test.tsx`
   assertions to view-model unit tests in the same commit, with the RTL suite
   still green. The behavioral spec now lives in code before anything is
   deleted.
1. **Scaffold + toolchain**: add phaser, remove React deps/plugins/eslint
   config, `main.ts` boots a blank BootScene. `git rm e2e/scoundrel.spec.ts`
   (rewritten replacement lands at stage 9) and delete `tests/ui.test.tsx` plus
   the 2 RTL i18n tests — the behavioral assertions already survived into the
   stage-0 view-model tests. Rewrite `tests/setup.ts` (no jest-dom/RTL; keep a
   localStorage stub if needed). `pnpm build`/`test` green with the app showing
   an empty canvas.
2. **Move seams**: relocate `card-image.ts` + `card-titles.ts` to `src/game/`,
   port `router.ts` (drop the hook), add `theme.ts` and `debug.ts`. From here
   on `cardAriaLabel` in `src/i18n.ts` is dead code — keep it, don't delete.
3. **BootScene + TitleScene**: texture loading (all 44 cards, keyed by CardId),
   title menu, seed entry, navigation to stats/settings/about stubs. Seed entry
   uses an overlaid DOM `<input>` styled to match the theme. If any webfont is
   used, load it in BootScene before any `Text` object is created. Hash routing
   via RouteController works end-to-end.
4. **PlayScene core**: HUD (HP bar, dungeon count, abandon dialog), room grid of
   CardSprites with click-select (store `selectCard`), seeded-replay sync
   (`#/play?seed=...&config=...` → `startRun`), carry-over selection
   re-validation against `game.room`.
5. **Action panel + weapon stack**: render the stage-0 view-models as Buttons
   (the logic itself is already ported and unit-tested — do not re-derive it);
   dispatch via store `act()`, deselect after. WeaponStack fan + degradation
   threshold text.
6. **Motion + toasts**: select/resolve tweens, kill-stack fan animation,
   announcement toasts, scene transitions. E2e-safety rule: hit areas must be
   bound to final positions (or animations fast-forwarded/disabled under the
   debug handle), so stage-9 Playwright clicks never race a tween.
7. **Remaining screens**: StatsScene (grid + history + replay links),
   SettingsScene (language + 3 toggles), AboutScene, GameOverScene overlay
   (scorecard, copy-replay-link via clipboard with the existing fallback, play
   again, return to title).
8. **Keyboard support**: roving card focus (arrows/Home/End), Enter to act,
   Escape closes dialogs — wired in PlayScene.
9. **e2e rewrite**: all 7 Playwright tests ported to the canvas — Playwright
   viewport pinned to 1280×720 (scale factor 1); locate scene objects via
   `window.__SCOUNDREL__` (scene query by card ID / button name), click at
   world→screen coordinates using the `worldToScreen(cardId)` debug helper with
   `page.mouse`; the greedy seeded playthrough strategy is preserved. Language /
   reload-resume / clipboard tests kept via the same handle + `page.evaluate`.
   Keyboard test uses real key events against the canvas.
10. **Cleanup + docs**: delete `src/ui/`, `App.tsx`, old `styles.css` bulk;
    update `docs/spec.md` (Routing / UI model / Accessibility / Visual /
    Toolchain / Testing sections), `AGENTS.md` architecture section, README
    (including the accessibility and bundle-size regressions); CI needs no
    workflow change (same script names), just confirm it passes. Optional
    polish to claw back screen-reader playability: an off-screen DOM live
    region in `main.ts` fed from the existing `src/store/announcements.ts`
    strings (~10 lines).

## Known regressions to document (not fix)

- ARIA roles/labels, DOM focus semantics, and focus-triggered tooltips are gone
  (keyboard play remains). Mitigation kept cheap to reverse: `cardAriaLabel`
  stays in `src/i18n.ts`; stage 10 optionally re-adds announcements via an
  off-screen DOM live region.
- The RTL component-seam tests are replaced by view-model unit tests + canvas
  e2e.
- Bundle size grows ~8×: Phaser is ~1.1 MB min / ~350 KB gzip vs ~45 KB for
  react + react-dom (the vendor-chunk split in the Vite config keeps it out of
  the app chunk).

## Merge criteria

- Full four-script pass: `pnpm lint && pnpm typecheck && pnpm test` plus
  `pnpm build && pnpm e2e`.
- Accessibility regression and the `?debug` handle documented in README and
  `docs/spec.md`.
- Rebase onto `main` regularly — long-lived UI branches rot fast.
- Rollback is trivial by design: `main` stays React throughout; abandoning the
  branch is the rollback.

## Verification per commit

`pnpm lint && pnpm typecheck && pnpm test`, then `pnpm build && pnpm e2e` once
scenes are interactive (from stage 9 on); final pass on all four before the
branch is done, per the merge criteria above.
