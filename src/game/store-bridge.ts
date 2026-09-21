import type { CardId, GameResult, GameState } from '../engine';
import { previewFight } from '../engine';
import type { StoreResult } from '../store/game-store';
import type { BridgeCommand, RunEndedInfo, TableSceneApi, TerminalPresentation } from './scene-api';

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
 * The scene's currently-rendered state, mirrored for drift detection AND for
 * terminal/Phase-3 re-derivation: `preState` retains the pre-action snapshot of
 * the most recently rendered state so `GameWon`/`GameLost` (which REPLACE the
 * base result via `withTerminal`, engine.ts:162) can be reconstructed from the
 * diff. `roomSnapshot`/highlights/turnCount are not visually rendered.
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

/**
 * Reconstructs the terminal action's presentation from the mirrored pre-action
 * model vs the post-action state: HP delta (the killing blow), kill-stack
 * append (weapon kill), room diff. This is the bridge's responsibility because
 * `withTerminal` substitutes GameWon/GameLost for the base resolve result.
 */
export function reconstructTerminalPresentation(
  pre: TableModel,
  post: GameState,
  preActionState: GameState | null = null,
): TerminalPresentation {
  const removedFromRoom = pre.room.filter((id) => !post.room.includes(id));
  const addedToRoom = post.room.filter((id) => !pre.room.includes(id));
  const killAppendedId =
    post.killStack.length === pre.killStack.length + 1
      ? (post.killStack[post.killStack.length - 1] ?? null)
      : null;
  return {
    hpDelta: post.hp - pre.hp,
    hpBefore: pre.hp,
    hpAfter: post.hp,
    killAppendedId,
    removedFromRoom,
    addedToRoom,
    weaponBefore: pre.weapon,
    weaponAfter: post.weapon,
    weaponBreak: terminalWeaponBreak(
      preActionState,
      killAppendedId,
      removedFromRoom,
      post.hp - pre.hp,
    ),
  };
}

/**
 * Phase 3 WEAPON-BREAK KEYING (plan §4 Phase 3 / §6): `MonsterDefeated.weaponBroke`
 * is vestigial — no engine code path sets it true — and `WeaponEquipped.discardedWeaponId`
 * is set on EVERY equip including honest upgrades, so keying a flash to either
 * would misfire. The break is re-derived from the bridge's retained pre-action
 * state via `previewFight` (engine.ts:87-121, mirroring the reducer's gating):
 *
 * - The kill USED the weapon (`usedWeaponId !== null`) → clean cut, no flash
 *   (degradation is real, but that is the threshold feedback, not a break).
 * - Barehanded kill with NO weapon held → nothing to strain, no flash.
 * - Barehanded kill while holding a weapon whose path `previewFight(pre, cardId,
 *   false)` rejects with `weapon-too-weak` → the weapon could not cut this
 *   kill → flash. This is exactly the plan's "MonsterDefeated whose weapon path
 *   was illegal" — cleanly derivable from previewFight's shape, no faking.
 * - `WeaponEquipped` → NEVER flashes (honest swap / voluntary upgrade).
 */
export function deriveWeaponBreak(
  preActionState: GameState | null,
  cardId: CardId,
  usedWeaponId: CardId | null,
): boolean {
  if (usedWeaponId !== null) return false; // the weapon cut it — no break
  if (preActionState === null || preActionState.weapon === null) return false;
  const weaponPath = previewFight(preActionState, cardId, false);
  return !weaponPath.legal && weaponPath.reason === 'weapon-too-weak';
}

/** Terminal variant: the reconstructed kill was barehanded (no stack append) and lethal. */
function terminalWeaponBreak(
  preActionState: GameState | null,
  killAppendedId: CardId | null,
  removedFromRoom: readonly CardId[],
  hpDelta: number,
): boolean {
  if (killAppendedId !== null) return false; // weapon cut it cleanly
  const killId = removedFromRoom[0];
  if (killId === undefined || hpDelta >= 0) return false; // not a damaging resolve
  return deriveWeaponBreak(preActionState, killId, null);
}

/**
 * Maps every `GameResult` variant to a presentation command.
 *
 * - `RunStarted` never reaches the store (`startRun` bypasses the reducer and
 *   publishes the `DealRoom` result directly), but the case is kept so the
 *   `never` exhaustiveness check covers the full union — a future engine
 *   variant fails the build here instead of silently doing nothing.
 * - Terminal results (`GameWon`/`GameLost`) replace the base result via
 *   `withTerminal` (engine.ts:162), so their presentation is reconstructed from
 *   the pre/post state diff before the flourish plays.
 * - `RunAwayBlocked`/`InvalidAction` are no-op state diffs: they MUST flow
 *   through this mapping (as error feedback), never through the diff fallback.
 */
export function mapResultToCommand(
  result: GameResult,
  state: GameState | null,
  pre: TableModel | null,
  preActionState: GameState | null = null,
): BridgeCommand {
  switch (result.type) {
    case 'RoomDealt':
      return state !== null
        ? { kind: 'deal', cards: result.cards, carriedFrom: result.carriedFrom }
        : { kind: 'noop' };

    case 'MonsterDefeated':
      return state !== null
        ? {
            kind: 'attack',
            cardId: result.cardId,
            damage: result.damage,
            usedWeaponId: result.usedWeaponId,
            // Weapon kills join the kill stack (engine appends on weapon fights);
            // the killCardId drives the stackDrop choreography.
            killCardId: result.usedWeaponId !== null ? result.cardId : null,
            weaponBreak: deriveWeaponBreak(preActionState, result.cardId, result.usedWeaponId),
          }
        : { kind: 'noop' };

    case 'WeaponEquipped':
      return state !== null
        ? {
            kind: 'weaponEquip',
            cardId: result.cardId,
            discardedWeaponId: result.discardedWeaponId,
            discardedMonsterIds: result.discardedMonsterIds,
          }
        : { kind: 'noop' };

    case 'PotionQuaffed':
      return state !== null
        ? { kind: 'potion', cardId: result.cardId, healed: result.healed, wasted: result.wasted }
        : { kind: 'noop' };

    case 'RanAway':
      return state !== null ? { kind: 'runAway', newCards: result.newCards } : { kind: 'noop' };

    case 'GameWon':
    case 'GameLost':
      return state !== null
        ? {
            kind: 'terminal',
            outcome: result.type === 'GameWon' ? 'won' : 'lost',
            reconstruction:
              pre !== null ? reconstructTerminalPresentation(pre, state, preActionState) : null,
          }
        : { kind: 'noop' };

    case 'UndoDone':
      // Restores from roomSnapshot with no payload diff — forward tweens cannot
      // represent a backward jump; rebuild fully with a cross-fade.
      return state !== null ? { kind: 'rebuild' } : { kind: 'noop' };

    case 'RunAwayBlocked':
    case 'InvalidAction':
      // No-op state diffs: no state motion — subtle shake, driven from
      // lastResult (the diff fallback cannot see these).
      return { kind: 'errorFeedback' };

    case 'RunStarted':
      // Unreachable via the store; defensively rebuild if a state exists.
      return state !== null ? { kind: 'rebuild' } : { kind: 'noop' };

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
  /**
   * Post-flourish gate: fires exactly once per run end, AFTER the scene
   * reports the terminal flourish complete. Never fires on undo/rebuild.
   * (React delays the GameOverScreen switch on this — time-bounded fail-open
   * is the React lane's responsibility.)
   */
  onRunEnded(cb: (info: RunEndedInfo) => void): () => void;
}

/**
 * THE CENTRAL MECHANISM: subscribes to the Zustand game store (vanilla
 * getState/subscribe — no React) and drives the Phaser scene from it.
 *
 * Ordering per notification:
 * 1. **Seq-gated result consumption** — every `lastResult` with
 *    `seq > expectedSeq` is mapped to a tween command and played. `expectedSeq`
 *    is seeded from the store's `lastResult?.seq` at attach time, so a result
 *    published before the scene mounted (hydrate/replay/StrictMode remount) is
 *    never replayed. The PRE-action mirrored model is what terminal
 *    reconstruction diffs against.
 * 2. **Selection sync** — the filtered selection is applied idempotently; this
 *    handles the second notification of each resolve (`selectCard(null)`) and
 *    never replays or cancels presentation.
 * 3. **Model compare (diff fallback)** — after every notification the mirrored
 *    model is compared to the store state; any mismatch (undo, hydrate, any
 *    state change that bypassed the result channel) triggers a cross-fade
 *    rebuild from state. The fallback supplements `lastResult`, never replaces
 *    it — it cannot detect no-op results.
 */
export function attachStoreBridge(
  scene: TableSceneApi,
  store: StoreView,
  opts?: { reducedMotion?: boolean },
): StoreBridge {
  // Reduced motion is a live scene concern (create opt + setReducedMotion);
  // the bridge carries the initial value through to the scene at attach time.
  if (opts?.reducedMotion === true) scene.setReducedMotion(true);

  let expectedSeq = store.getState().lastResult?.seq ?? 0;
  let model: TableModel | null = snapshotModel(store.getState().game);
  // Full pre-action GameState (not just the visual model) — previewFight reads
  // config/weapon/killStack, so the break re-derivation needs engine truth.
  let preActionGame: GameState | null = store.getState().game;
  let appliedSelection: CardId | null = null;

  const selection = () => {
    const { game, selectedCardId } = store.getState();
    return filteredSelection(game, selectedCardId);
  };

  // First sync: render the full current state statically, intro animations
  // suppressed (deal animations only play for results observed after mount).
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

    // 1. Cue sheet: never replay a stale result seen before mount. `model` is
    //    the pre-action snapshot and `preActionGame` the full pre-action state —
    //    the terminal diff and the weapon-break re-derivation read them BEFORE
    //    updating.
    if (lastResult !== null && lastResult.seq > expectedSeq) {
      expectedSeq = lastResult.seq;
      const command = mapResultToCommand(lastResult.result, game, model, preActionGame);
      scene.playCommand(command, game, currentSelection);
      model = snapshotModel(game);
      preActionGame = game;
    }

    // 2. Selection sync — idempotent, never replays presentation.
    if (currentSelection !== appliedSelection) {
      appliedSelection = currentSelection;
      scene.setSelection(currentSelection);
    }

    // 3. Diff fallback: cross-fade rebuild whenever the scene's model drifted
    //    from truth (undo, hydrate, a state change with no fresh result).
    //    Supplements the cue sheet; cannot detect no-op results.
    const nextModel = snapshotModel(game);
    if (!modelEquals(model, nextModel)) {
      model = nextModel;
      preActionGame = game;
      scene.playCommand({ kind: 'rebuild' }, game, currentSelection);
    }
  });

  const runEndedCbs = new Set<(info: RunEndedInfo) => void>();
  // The scene fires this after the terminal flourish completes (or instantly
  // under reduced motion). Undo/mismatch rebuilds never reach that path.
  scene.onFlourishComplete((info) => {
    runEndedCbs.forEach((cb) => cb(info));
  });

  return {
    destroy() {
      unsubscribe();
      runEndedCbs.clear();
      scene.destroy();
    },
    onRunEnded(cb) {
      runEndedCbs.add(cb);
      return () => {
        runEndedCbs.delete(cb);
      };
    },
  };
}
