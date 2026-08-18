/**
 * Run shard (`scoundrel:run`): the active run's full state so a browser close
 * mid-run resumess later (Q44) — land on title, then Continue (Q45).
 *
 * Holds the engine GameState (roomSnapshot included, since it is part of
 * GameState) plus the UI-side room-slot layout used for ghost slots, and the
 * terminal outcome inline so the win/lose scorecard survives reload (Q42).
 * `statsWritten` is the idempotency flag guaranteeing a run is counted in the
 * stats shard exactly once (Q43).
 */
import type { CardId, GameState } from '../engine';
import { normalizeConfig } from './settings';
import { readVersioned, removeKey, STORAGE_KEYS, writeEnvelope } from './storage';

export const RUN_VERSION = 1;

export interface RunOutcome {
  phase: 'won' | 'lost';
  score: number;
}

/** A room slot: ghost slots (resolved cards) keep their identity for display. */
export interface SlotCard {
  cardId: CardId;
  resolved: boolean;
}

export interface PersistedRun {
  state: GameState;
  slots: SlotCard[];
  slotsSnapshot: SlotCard[] | null;
  carriedCardId: CardId | null;
  statsWritten: boolean;
  outcome: RunOutcome | null;
  /** Wall-clock save stamp (GameState.startedAt stays engine-owned, always 0). */
  savedAt: number;
}

// No v0 run schema ever shipped; unknown versions fall back to "no save".
function migrateRun(): PersistedRun | null {
  return null;
}

/** Basic shape check so a corrupt shard never drops into the play screen. */
function plausibleRun(raw: PersistedRun): boolean {
  return (
    typeof raw === 'object' &&
    raw !== null &&
    typeof raw.state === 'object' &&
    raw.state !== null &&
    typeof raw.state.seed === 'string' &&
    Array.isArray(raw.slots)
  );
}

export function loadRun(): PersistedRun | null {
  const stored = readVersioned<PersistedRun | null>(
    STORAGE_KEYS.run,
    RUN_VERSION,
    migrateRun,
    null,
  );
  if (stored === null || !plausibleRun(stored)) return null;
  // Infinity cannot JSON-round-trip; restore the config's runtime shape.
  stored.state.config = normalizeConfig(stored.state.config);
  return stored;
}

type StorableRun = Omit<PersistedRun, 'savedAt'> & { savedAt?: number };

export function saveRun(run: StorableRun): void {
  // Wall-clock time is stamped here — GameState.startedAt stays engine-owned.
  writeEnvelope(STORAGE_KEYS.run, RUN_VERSION, { ...run, savedAt: Date.now() });
}

export function clearRunRecord(): void {
  removeKey(STORAGE_KEYS.run);
}
