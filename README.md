# Scoundrel card game

Scoundrel — a 1-player roguelike dungeon-crawling card game played with a standard deck.

## Play

```bash
npm install
npm run dev
```

Every run has a six-character seed shown in the HUD and written to the URL, so a
dungeon can be shared or replayed by passing `?seed=4F2A9C`.

## Rules

`docs/rules.md` is the rule set. `docs/design/2026-08-02-scoundrel-game-design.md`
resolves the ten places those rules are ambiguous and is authoritative for
implementation.

## Development

See `AGENTS.md` for commands. The rules engine in `src/engine/` is pure
TypeScript with no React, no browser APIs, and no user-visible strings; it is
tested independently of the UI.
