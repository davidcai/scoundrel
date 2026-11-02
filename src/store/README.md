# Persisted store layer (Phase 4a)

Saved-data boundary for the Phase 4 interface: run persistence, statistics,
history, replay/share links, preferences, and REQ-010 recovery. Rules stay in
`../engine`; transient selection stays in `gameSession.ts`; this directory owns
everything that survives a reload.

## Modules

| Module | Owns |
| --- | --- |
| `storage.ts` | `localStorage` wrapper that never throws; memory/unavailable doubles for tests |
| `persistence.ts` | Schema version, storage keys, versioned envelopes, ordered migrations, shard reads/writes |
| `validation.ts` | Small shape guards shared by the payload validators |
| `activeRun.ts` | Saved-run payload (`PersistedRun`) and deep validation of a saved `GameState` |
| `history.ts` | History entry shape and newest-first, 50-entry trim |
| `stats.ts` | Lifetimes statistics, streak/best-score updates, win rate, once-only recording ledger |
| `settings.ts` | Persisted locale and reduced-motion preference |
| `share.ts` | `#/play?seed=…&config=…` build/parse (REQ-014) |
| `scoundrelStore.ts` | `ScoundrelStore`: the typed API the interface calls |
| `useScoundrelStore.ts` / `ScoundrelStoreProvider.tsx` | React bindings (`useSyncExternalStore`) |
| `index.ts` | Public barrel for the Phase 4 interface |

## Storage layout

- Keys: `scoundrel:settings`, `scoundrel:stats`, `scoundrel:run`.
- Every value is `{ "schemaVersion": 1, "data": … }`; `SCHEMA_VERSION` lives in
  `persistence.ts`. A schema change bumps it and adds the matching upgrade step
  to `SHARD_MIGRATIONS`; otherwise older/newer payloads are reported as
  `unsupported-version` and preserved.
- `stats` holds lifetime statistics, the newest 50 history entries, and a
  bounded ledger of recorded run ids (200). The ledger is what makes outcome
  recording idempotent across reloads and tabs.
- `run` holds one payload: either an unfinished run (resumable, including the
  undo snapshot) or the last completed result (kept so reloading restores the
  result screen).

## Guaranteed behaviour

- One saved run at a time. Starting a fresh attempt through any entry point
  (New Run, seed, history replay, valid share link) replaces an unfinished run
  without confirmation and records exactly one abandoned loss. The score is the
  engine's loss score for the outgoing draw pile: unresolved room cards and
  remaining health are ignored, an empty/no-monster pile scores 0.
- Replacement is write-ordered: the new run is persisted first and the
  abandonment is recorded only after that write succeeds, so a failed run write
  returns `write-failed` and leaves the outgoing run resumable with zero losses.
  Explicit discard removes the shard first and records the abandonment only
  after the removal succeeds, with the same failure guarantee. If the abandonment
  itself cannot be recorded while the stats shard is writable, the run change is
  rolled back, in-memory statistics are restored, and the action reports
  `write-failed`. If that compensating run write also fails, the store still
  reports `write-failed` (with `write-failed` warnings for both shards) and keeps
  memory aligned with what storage already holds; in this double-failure window a
  reload may lose the abandoned loss because the successful run change stands and
  `localStorage` has no atomic multi-key transaction.
- Saved progress is bound to the run's seed and rule options: `saveRunState` and
  `completeRun` reject a state whose `seed`/`config` do not match the saved run
  (`state-mismatch`).
- Completed results are final: they are not resumable, `saveRunState` refuses
  them, and their outcome is recorded exactly once (win or loss).
- Reloading, closing, or returning to the title with an unfinished run records
  nothing. Invalid seeds, settings, and links change no saved data and return a
  reason for the interface to explain.
- Unreadable payloads are never overwritten. The store reports the shard and
  keeps playing in session-only mode; the recovery actions
  (`discardUnreadableRun`, `resetUnreadableStats`, `resetUnreadableSettings`)
  remove only that shard. Missing browser storage likewise keeps the session
  playable and says so through `warnings`.
- Mutations re-read the relevant shard first, so a reloaded page or second tab
  cannot double-record an outcome or resurrect a run another tab removed.
  Partial settings updates merge over the latest shard, not stale memory.
  Cross-tab atomicity is best-effort under `localStorage`; there is no locking.
- A migrated payload is rewritten at the current version on load; a failed
  rewrite is reported as a `write-failed` warning while the migrated data stays
  usable in memory. Tests can inject migrations through the `migrations` store
  option before a production step exists.

## Phase 4 interface integration

- Keep the `ScoundrelStore` returned by `createScoundrelStore()` for the app
  session and pass it through `ScoundrelStoreProvider`.
- Call `saveRunState(runId, state)` after every applied action. Hold the
  `runId` from `StartedRun` / `activeRun`; it is not part of the engine state.
- Call `completeRun(runId, finalState)` when the engine state has a result. The
  call is idempotent, so an effect that re-runs after reload is safe.
- Use `title.canContinue` / `title.canDiscard` / `title.hasCompletedResult` for
  the title actions; Discard confirmation stays in the interface. Surface
  `write-failed`, `state-mismatch`, and `invalid-*` start failures as messages
  instead of retrying silently.
- Resume from `activeRun.state` rather than starting a new run from the URL.
  The session layer needs a way to build a `UiSession` from a restored
  `GameState` (e.g. `createSessionFromState(state)`) before the play screen can
  mount on reload; that helper belongs with `gameSession.ts`, not here.
- Reloading a completed result should render the result screen from
  `completedResult`; opening a share link is an explicit fresh attempt and calls
  `startFromSharedLink(...)`. The route/UI decision for result restoration is
  part of the Phase 4 interface task.
- Wire the existing `PreferencesProvider` to `settings` / `updateSettings`, and
  use `buildReplayLink(...)` for the copy-link action. History timestamps are
  stored as canonical UTC ISO strings; the interface formats them locally.
