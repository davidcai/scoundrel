# Scoundrel card game

Scoundrel — a 1-player roguelike dungeon-crawling card game played with a standard deck. The full rule set lives in `docs/rules.md` and is the source of truth for gameplay behavior.

## Running locally

```bash
npm install
npm run dev
```

Then open http://localhost:5173. Append `#seed=<number>` to the URL to replay a specific dungeon.

## Testing

```bash
npm test
```

Runs the rules-engine test suite (Vitest).