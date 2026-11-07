# Save, resume, and statistics contract

This implements [REQ-001](prd.md#req-001), [REQ-008](prd.md#req-008), [REQ-009](prd.md#req-009), [REQ-010](prd.md#req-010), [REQ-012](prd.md#req-012), [REQ-013](prd.md#req-013), and [REQ-014](prd.md#req-014). Product behavior remains owned by the PRD and rules.

## Version 1

IndexedDB database `scoundrel`, database version 1, object store `saves`, key `scoundrel:save` contains one JSON envelope: `{ version: 1, data: { session, preferences } }`. The database version and envelope format version are separate concerns. There are no imports from other releases.

The session contains the active or final game, room-start undo snapshot, attempt number, lifetime statistics, and newest 30 completed outcomes. Preferences contain language, motion, and rules for future runs. Card selection and announcements are transient and excluded. Active runs resume at the title; a final result reloads at its result screen when that was the saved screen.

The envelope is validated before use: cards and zones, board/snapshot invariants, outcome scores, timestamps, history ordering, and aggregate counts must be consistent. `migrateEnvelope` chains explicitly supplied supported-version migrations and rejects future versions or missing steps. No older released format exists yet. A future change must supply a real prior-version fixture and migration coverage before shipping.

## Writes and competing tabs

`save-storage.ts` compares the stored envelope with the tab's last successfully saved envelope and writes the replacement inside the same IndexedDB read/write transaction. Terminal results and their aggregate/history updates are committed together. The cursor advances only after transaction completion; a failed write leaves the previous envelope intact. Per-tab writes are queued in order.

IndexedDB serializes overlapping read/write transactions over the same store, as specified in [transaction scheduling](https://www.w3.org/TR/IndexedDB/#transaction-scheduling). This avoids a race observed with compare-then-set in localStorage, including when those calls were placed inside a Web Lock: Chromium renderer caches could briefly return an older value.

The UI responds immediately while writes settle in order. Routine save-status messages are omitted; gameplay also omits the footer to keep attention on the board. A failed write leaves the tab playable, displays an unsaved notice, and offers Retry saving for its latest state. BroadcastChannel and focus checks detect changes from another tab; the transactional comparison still prevents a stale write if a notification has not arrived. A conflicting tab pauses input and offers Reload saved game. Recovery clears its stale replay address before loading, so it does not replace the newer run.

Unreadable or unsupported envelopes are left unchanged; the app offers unsaved play and reload. If browser storage is unavailable, play remains in memory with a visible notice. Clearing site data removes saved progress; there is no account or cross-device synchronization. Saves are scoped to the browser profile and site origin, including the port.

## Replay versus resume

The browser history entry records its saved attempt number. Reloading that entry resumes the same matching seed/rules attempt. Opening a fresh external replay link starts a fresh attempt even if its seed matches the saved run. Invalid links preserve the existing run. New Run, valid seed entry, and history replay show a replacement confirmation when a run is active. Until confirmed, neither progress nor statistics change; Cancel or Escape discards the pending choice. History replay uses the recorded rules, while seed-only entry uses the current preferences.

The session reducer applies the PRD's outcome, abandonment, score, history, and streak rules. Reloading reads already-counted results; it does not apply an outcome again. Menu, close, and reload preserve an unfinished run. Selection is not saved, and undo remains available after resume only while the run is active.

## Verification

`pnpm test` covers envelope round trips, exact room undo, frozen active rules, result finality, lifetime aggregates, history trimming, invalid data, and the migration-chain helper. `pnpm build` checks types and artwork exclusion. After building, `pnpm e2e` covers real Chromium storage transactions, reload/reopen recovery, both final results, durable preferences, abandonment and replay, corrupt/newer envelopes, denied storage, failed-write preservation and retry, and deliberately overlapping writes from two tabs. Browser tests inspect IndexedDB directly and use normal UI actions for gameplay.

WebKit and real Safari verification remain phase-5 work.
