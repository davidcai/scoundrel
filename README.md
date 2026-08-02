# Scoundrel card game

Scoundrel — a 1-player roguelike dungeon-crawling card game played with a standard deck.
The full rule set lives in [`docs/rules.md`](docs/rules.md) and is the source of truth for
gameplay behavior.

This repo is a browser implementation: a pure TypeScript rules engine with a small
dependency-free DOM front end, built with Vite.

## Running

```bash
npm install
npm run dev
```

| Script              | What it does                                  |
| ------------------- | --------------------------------------------- |
| `npm run dev`       | Dev server with hot reload                    |
| `npm run build`     | Typecheck, then a production bundle in `dist` |
| `npm run preview`   | Serve the production build                    |
| `npm test`          | Run the rules test suite                      |
| `npm run test:watch`| Tests in watch mode                           |
| `npm run typecheck` | `tsc --noEmit`                                |

Dungeons are generated from a seed, so `?seed=12345` in the URL replays an exact dungeon.
The seed is shown in the top bar and copies to the clipboard when clicked.

## Layout

```
src/
  game/          rules engine — pure, DOM-free, fully unit-tested
    cards.ts     the 44-card deck, suits, values
    rng.ts       seeded PRNG + shuffle
    engine.ts    game state and the four player actions
  ui/
    dom.ts       tiny element builder
    render.ts    renders a GameState; no rules logic lives here
  main.ts        state holder + dispatch loop
tests/           37 tests covering the rule set
```

The engine exposes a single `applyAction(state, action) -> state` entry point over four
actions (`avoid`, `fight`, `drink`, `equip`), plus `isLegal` so the UI only ever offers
moves the rules permit. Every rule is quoted in a comment at the point it is implemented.

## Rule interpretations

`docs/rules.md` leaves a few edges unstated. The choices made here:

- **Losing score counts every *unplayed* monster** — those still in the draw pile *and*
  the unresolved ones face-up in the room. The rules say "all remaining unplayed monsters
  left in the dungeon deck"; the face-up room cards came off that deck and are
  demonstrably unplayed, so they count.
- **Running away needs an untouched room.** Resolving any card commits you to the room.
  This follows from "if you choose not to face a room" — you send *all 4* cards to the
  bottom, which is only possible before you have resolved one.
- **You cannot run when the draw pile is empty.** There would be nothing to deal, so the
  same four cards would come straight back — a no-op that silently burns your escape.
- **Weapon degradation is strict.** After a kill a weapon fights monsters *lower* than the
  last one it killed; equal value is refused. A weapon that has not killed yet is
  unrestricted.
- **A wasted potion still counts as a resolution.** Drinking a second heart in one room
  heals nothing, but it is one of the three cards you must resolve.
- **A winning score is plain remaining health, capped at 20.** Some printings award a
  bonus for finishing on a potion at full health; `docs/rules.md` does not, and states a
  maximum of 20.
