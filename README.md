# Scoundrel

A browser implementation of **Scoundrel** — the 1-player roguelike
dungeon-crawling card game played with a standard deck. Fight through 44
cards of monsters (Clubs/Spades), weapons (Diamonds), and health potions
(Hearts) with 20 hit points and one way down. Seeded runs, replay URLs,
per-room undo, run history, and house-rule toggles included.

The canonical rule set lives in [docs/rules.md](docs/rules.md); it is the
source of truth for gameplay behavior.

## Quick start

Requires Node.js (v22 recommended) and npm.

```bash
npm install
npm run dev
```

Then open the printed local URL. The app is a Vite + React + TypeScript SPA;
all game state lives client-side in `localStorage`.

## Scripts

| Script              | What it runs                                              |
| ------------------- | --------------------------------------------------------- |
| `npm run dev`       | Vite dev server                                           |
| `npm run test`      | Vitest unit + integration suites (engine, store, screens) |
| `npm run lint`      | ESLint (typescript-eslint strict + react-hooks)           |
| `npm run typecheck` | `tsc -b` over app, node tooling, and e2e projects         |
| `npm run e2e`       | Playwright end-to-end suite (Chromium only)               |
| `npm run build`     | Production build (`tsc -b && vite build` → `dist/`)       |
| `npm run format`    | Prettier write across the repo                            |
| `npm run preview`   | Serve the production build locally                        |

CI (`.github/workflows/ci.yml`) runs install → lint → typecheck → unit +
integration → Playwright e2e → build on every push to `main` and every PR.

## Deploy

The app deploys to **GitHub Pages** from CI on pushes to `main`
(`actions/deploy-pages`). Vite's base path is env-driven — CI builds with
`BASE_URL=/scoundrel/` on `main` only — and the hash router
(`#/`, `#/play?seed=…`, `#/stats`, …) works under any base with no SPA
fallback configuration. Local and PR builds default to `BASE_URL=/`.

## Credits

Scoundrel was designed by Zach Gage & Kurt Bieg, 2011. This is an unofficial
fan implementation; see [the original rules PDF](http://stfj.net/art/2011/Scoundrel.pdf).
