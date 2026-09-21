import type { CardId, GameResult, GameState } from '../engine';
import type { StoreResult } from '../store/game-store';
import type { BridgeCommand, TableSceneApi } from './scene-api';

/**
 * Minimal vanilla-Zustand shape the bridge depends on (so unit tests can stub
 * it): `useGameStore` satisfies this directly via its `.getState()/.subscribe()`.
 */
export interface StoreView {
  getState(): {
    game: GameState | null;
    selectedCardId: CardId | null;
    lastResult: StoreResult | null;
    selectCard(cardId: CardId | null): void;
  };
  subscribe(listener: () => void): () => void;
}

/**
 * The scene's currently-rendered state, mirrored for drift detection. Only the
 * fields the table renders (plus identity fields that force a rebuild on a new
 * run); `roomSnapshot`/highlights/turnCount are not visually rendered.
 */
export interface TableModel {
  seed: string;
  startedAt: number;
  phase: GameState['phase'];
  hp: number;
  maxHp: number;
  room: readonly CardId[];
  resolvedCount: number;
  carriedCardId: CardId | null;
  weapon: CardId | null;
  killStack: readonly CardId[];
  potionsUsedThisRoom: number;
  ranAwayLastRoom: boolean;
  deckCount: number;
}

export function snapshotModel(state: GameState | null): TableModel | null {
  if (state === null) return null;
  return {
    seed: state.seed,
    startedAt: state.startedAt,
    phase: state.phase,
    hp: state.hp,
    maxHp: state.maxHp,
    room: state.room,
    resolvedCount: state.resolvedCount,
    carriedCardId: state.carriedCardId,
    weapon: state.weapon,
    killStack: state.killStack,
    potionsUsedThisRoom: state.potionsUsedThisRoom,
    ranAwayLastRoom: state.ranAwayLastRoom,
    deckCount: state.dungeon.length,
  };
}

export function modelEquals(a: TableModel | null, b: TableModel | null): boolean {
  if (a === b) return true;
  if (a === null || b === null) return false;
  return (
    a.seed === b.seed &&
    a.startedAt === b.startedAt &&
    a.phase === b.phase &&
    a.hp === b.hp &&
    a.maxHp === b.maxHp &&
    a.resolvedCount === b.resolvedCount &&
    a.carriedCardId === b.carriedCardId &&
    a.weapon === b.weapon &&
    a.potionsUsedThisRoom === b.potionsUsedThisRoom &&
    a.ranAwayLastRoom === b.ranAwayLastRoom &&
    a.deckCount === b.deckCount &&
    cardListEquals(a.room, b.room) &&
    cardListEquals(a.killStack, b.killStack)
  );
}

function cardListEquals(a: readonly CardId[], b: readonly CardId[]): boolean {
  return a.length === b.length && a.every((id, i) => id === b[i]);
}

/**
 * PlayScreen's render-path filter (PlayScreen.tsx:104-105): a selection is only
 * visible while it points at a card still in the room — ring off otherwise.
 */
export function filteredSelection(
  game: GameState | null,
  selectedCardId: CardId | null,
): CardId | null {
  return game !== null && selectedCardId !== null && game.room.includes(selectedCardId)
    ? selectedCardId
    : null;
}

/** The acted-on card for a result, when one exists. */
function cardIdOf(result: GameResult): CardId | null {
  switch (result.type) {
    case 'MonsterDefeated':
    case 'WeaponEquipped':
    case 'PotionQuaffed':
      return result.cardId;
    default:
      return null;
  }
}

/**
 * Maps every `GameResult` variant to a presentation command.
 *
 * - `RunStarted` never reaches the store (`startRun` bypasses the reducer and
 *   publishes the `DealRoom` result directly), but the case is kept so the
 *   `never` exhaustiveness check covers the full union — a future engine
 *   variant fails the build here instead of silently doing nothing.
 * - Terminal results (`GameWon`/`GameLost`) replace the base result via
 *   `withTerminal` (engine.ts:162), so Phase 1 just re-renders from state; the
 *   killing-blow/final-resolve presentation is the state diff, and React owns
 *   the screen switch.
 */
export function mapResultToCommand(result: GameResult, state: GameState | null): BridgeCommand {
  switch (result.type) {
    case 'RoomDealt':
    case 'MonsterDefeated':
    case 'WeaponEquipped':
    case 'PotionQuaffed':
    case 'RanAway':
    case 'GameWon':
    case 'GameLost':
      if (state !== null) {
        // Phase 1 static parity: instant re-render from the authoritative
        // post-action state. `cardId` marks the acted-on sprite for Phase 2.
        return { kind: 'render', cardId: cardIdOf(result) };
      }
      return { kind: 'noop' };

    case 'UndoDone':
      // Restores from roomSnapshot with no payload diff — forward tweens cannot
      // represent a backward jump; rebuild fully (Phase 2: cross-fade).
      if (state !== null) return { kind: 'rebuild' };
      return { kind: 'noop' };

    case 'RunAwayBlocked':
    case 'InvalidAction':
      // No-op state diffs: no render (nothing changed) — these must flow
      // through this mapping, never through the diff fallback, or they would
      // be invisible. Phase 2: shake/nudge.
      return { kind: 'noop' };

    case 'RunStarted':
      // Unreachable via the store; defensively rebuild if a state exists.
      if (state !== null) return { kind: 'rebuild' };
      return { kind: 'noop' };

    default: {
      const exhaustive: never = result;
      throw new Error(
        `Unhandled GameResult variant — engine gained a cue the bridge does not play: ${String(
          (exhaustive as GameResult).type,
        )}`,
      );
    }
  }
}

export interface StoreBridge {
  destroy(): void;
}

/**
 * THE CENTRAL MECHANISM: subscribes to the Zustand game store (vanilla
 * getState/subscribe — no React) and drives the Phaser scene from it.
 *
 * Ordering per notification:
 * 1. **Seq-gated result consumption** — every `lastResult` with
 *    `seq > expectedSeq` is mapped to a command. `expectedSeq` is seeded from
 *    the store's `lastResult?.seq` at attach time, so a result published before
 *    the scene mounted (hydrate/replay/StrictMode remount) is never replayed.
 * 2. **Selection sync** — the filtered selection is applied idempotently; this
 *    handles the second notification of each resolve (`selectCard(null)`) and
 *    never replays or cancels presentation.
 * 3. **Model compare (diff fallback)** — after every notification the mirrored
 *    model is compared to the store state; any mismatch (undo, hydrate, any
 *    state change that bypassed the result channel) triggers a full rebuild
 *    from state. The fallback supplements `lastResult`, never replaces it —
 *    it cannot detect no-op results.
 */
export function attachStoreBridge(
  scene: TableSceneApi,
  store: StoreView,
  opts?: { reducedMotion?: boolean },
): StoreBridge {
  // `reducedMotion` is carried for Phase 2 tweens; Phase 1 is fully static.
  void opts?.reducedMotion;

  let expectedSeq = store.getState().lastResult?.seq ?? 0;
  let model: TableModel | null = snapshotModel(store.getState().game);
  let appliedSelection: CardId | null = null;

  const selection = () => {
    const { game, selectedCardId } = store.getState();
    return filteredSelection(game, selectedCardId);
  };

  // First sync: render the full current state statically, intro animations
  // suppressed (Phase 1 is static; `firstSync` marks the snapshot for Phase 2).
  const initial = store.getState().game;
  scene.renderState(initial, selection());
  appliedSelection = selection();

  // Canvas pointer input routes through the store's selection slice with
  // PlayScreen's toggle semantics: clicking a selected card deselects it.
  scene.onCardPointerDown((cardId) => {
    store.getState().selectCard(appliedSelection === cardId ? null : cardId);
  });

  const unsubscribe = store.subscribe(() => {
    const { game, lastResult } = store.getState();
    const currentSelection = selection();

    // 1. Cue sheet: never replay a stale result seen before mount.
    if (lastResult !== null && lastResult.seq > expectedSeq) {
      expectedSeq = lastResult.seq;
      const command = mapResultToCommand(lastResult.result, game);
      if (command.kind === 'render' || command.kind === 'rebuild') {
        scene.renderState(game, currentSelection);
      }
      model = snapshotModel(game);
    }

    // 2. Selection sync — idempotent, never replays presentation.
    if (currentSelection !== appliedSelection) {
      appliedSelection = currentSelection;
      scene.setSelection(currentSelection);
    }

    // 3. Diff fallback: rebuild whenever the scene's model drifted from truth
    //    (undo, hydrate, a state change with no fresh result). Supplements the
    //    cue sheet; cannot detect no-op results.
    const nextModel = snapshotModel(game);
    if (!modelEquals(model, nextModel)) {
      model = nextModel;
      scene.renderState(game, currentSelection);
    }
  });

  return {
    destroy() {
      unsubscribe();
      scene.destroy();
    },
  };
}
