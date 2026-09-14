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
  experiment.
- **Testing**: replace the React Testing Library seam with (a) pure view-model
  helpers unit-tested in Vitest and (b) rewritten Playwright e2e that drives the
  real canvas via a `window.__SCOUNDREL__` debug handle exposed in dev/preview
  builds.
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
    debug.ts              # exposes window.__SCOUNDREL__ = { game, store } in dev/preview
    scenes/
      BootScene.ts        # loads 44 card textures via card-image URLs + preload
      TitleScene.ts       # menu: Continue / New Run / seed entry / Stats / Settings / About
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
                          #   button enable/disable states, room layout math
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
  `clamp()` card width).

## Implementation order (small commits, each leaving the branch green)

1. **Scaffold + toolchain**: add phaser, remove React deps/plugins/eslint
   config, `main.ts` boots a blank BootScene. Delete `tests/ui.test.tsx` and the
   2 RTL i18n tests; rewrite `tests/setup.ts` (no jest-dom/RTL; keep a
   localStorage stub if needed). `pnpm build`/`test` green with the app showing
   an empty canvas.
2. **Move seams**: relocate `card-image.ts` + `card-titles.ts` to `src/game/`,
   port `router.ts` (drop the hook), add `theme.ts` and `debug.ts`.
3. **BootScene + TitleScene**: texture loading (all 44 cards, keyed by CardId),
   title menu, seed entry, navigation to stats/settings/about stubs. Hash
   routing via RouteController works end-to-end.
4. **PlayScene core**: HUD (HP bar, dungeon count, abandon dialog), room grid of
   CardSprites with click-select (store `selectCard`), seeded-replay sync
   (`#/play?seed=...&config=...` → `startRun`), carry-over selection
   re-validation against `game.room`.
5. **Action panel + weapon stack**: port MonsterActions / PotionActions /
   WeaponActions logic into pure `view-models/` first (unit tests ported from
   the deleted RTL assertions), then render as Buttons; dispatch via store
   `act()`, deselect after. WeaponStack fan + degradation threshold text.
6. **Motion + toasts**: select/resolve tweens, kill-stack fan animation,
   announcement toasts, scene transitions.
7. **Remaining screens**: StatsScene (grid + history + replay links),
   SettingsScene (language + 3 toggles), AboutScene, GameOverScene overlay
   (scorecard, copy-replay-link via clipboard with the existing fallback, play
   again, return to title).
8. **Keyboard support**: roving card focus (arrows/Home/End), Enter to act,
   Escape closes dialogs — wired in PlayScene.
9. **e2e rewrite**: all 8 Playwright tests ported to the canvas — locate scene
   objects via `window.__SCOUNDREL__` (scene query by card ID / button name),
   click at world→screen coordinates with `page.mouse`; the greedy seeded
   playthrough strategy is preserved. Language / reload-resume / clipboard tests
   kept via the same handle + `page.evaluate`. Keyboard test uses real key
   events against the canvas.
10. **Cleanup + docs**: delete `src/ui/`, `App.tsx`, old `styles.css` bulk;
    update `docs/spec.md` (Routing / UI model / Accessibility / Visual /
    Toolchain / Testing sections), `AGENTS.md` architecture section, README; CI
    needs no workflow change (same script names), just confirm it passes.

## Known regressions to document (not fix)

- ARIA roles/labels, live region, DOM focus semantics, and focus-triggered
  tooltips are gone (keyboard play remains).
- The RTL component-seam tests are replaced by view-model unit tests + canvas
  e2e.

## Verification per commit

`pnpm lint && pnpm typecheck && pnpm test`, then `pnpm build && pnpm e2e` once
scenes are interactive; final pass on all four before the branch is done.
