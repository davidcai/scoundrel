/**
 * Transient interface session model.
 *
 * The engine state is the single source of game truth. Selection, preview, and
 * the last notice are interface-only state that must never be written back into
 * the engine (implementation-plan phase 3 decision). Previews come from the
 * engine's own preview functions, so preview and confirmed outcome always agree.
 */
import {
  applyAction,
  createInitialState,
  isMonster,
  previewCardResolution,
  previewMonster,
  type ActionResult,
  type AttackMode,
  type CardId,
  type GameEvent,
  type GameState,
  type MonsterPreview,
  type RejectionReason,
  type RuleConfig,
} from '../engine';

/** A monster selection: both attack choices and the weapon restriction. */
export interface MonsterCardPreview {
  readonly kind: 'monster';
  readonly card: CardId;
  readonly preview: MonsterPreview;
}

/** A weapon or potion selection: the exact event a confirmation would produce. */
export interface ActionCardPreview {
  readonly kind: 'action';
  readonly card: CardId;
  readonly event: GameEvent;
}

export type CardPreview = MonsterCardPreview | ActionCardPreview;

export type UiNotice =
  | { readonly kind: 'event'; readonly event: GameEvent }
  | { readonly kind: 'rejection'; readonly reason: RejectionReason };

export interface UiSession {
  /** Monotonic identifier so per-run UI state can be remounted on a new run. */
  readonly runId: number;
  readonly state: GameState;
  readonly selectedCard: CardId | null;
  /** The last confirmed card, so undo can restore its selection and focus. */
  readonly lastSelection: CardId | null;
  readonly preview: CardPreview | null;
  /** Rejection for the current selection, if the card cannot be resolved. */
  readonly previewRejection: RejectionReason | null;
  readonly notice: UiNotice | null;
  /** Increments on every notice so focus/announcement effects can react once. */
  readonly noticeSeq: number;
}

export type UiRoomAction =
  { readonly type: 'enterNextRoom' } | { readonly type: 'runAway' } | { readonly type: 'undoRoom' };

export type UiAction =
  | { readonly type: 'select'; readonly card: CardId }
  | { readonly type: 'clearSelection' }
  | { readonly type: 'resolve'; readonly attack?: AttackMode }
  | UiRoomAction
  | { readonly type: 'replace'; readonly session: UiSession }
  | { readonly type: 'clear' };

let nextRunId = 1;

/** Validate first, then construct: `createInitialState` throws on bad input. */
export function createSession(seed: string, config: RuleConfig): UiSession {
  const state = createInitialState(seed, config);
  return {
    runId: nextRunId++,
    state,
    selectedCard: null,
    lastSelection: null,
    preview: null,
    previewRejection: null,
    notice: null,
    noticeSeq: 0,
  };
}

/**
 * Restore an interface session from a saved engine state (reload, Continue, or
 * a run refreshed from another tab). Selection is interface-only, so it starts
 * empty; the caller may select a card again after mounting.
 */
export function createSessionFromState(state: GameState): UiSession {
  return {
    runId: nextRunId++,
    state,
    selectedCard: null,
    lastSelection: null,
    preview: null,
    previewRejection: null,
    notice: null,
    noticeSeq: 0,
  };
}

function buildPreview(
  state: GameState,
  card: CardId,
): { preview: CardPreview | null; rejection: RejectionReason | null } {
  if (isMonster(card)) {
    const result = previewMonster(state, card);
    if (result.ok)
      return { preview: { kind: 'monster', card, preview: result.preview }, rejection: null };
    return { preview: null, rejection: result.reason };
  }
  const result = previewCardResolution(state, card);
  if (result.ok) return { preview: { kind: 'action', card, event: result.event }, rejection: null };
  return { preview: null, rejection: result.reason };
}

function withNotice(session: UiSession, result: ActionResult): UiSession {
  if (!result.ok) {
    return {
      ...session,
      notice: { kind: 'rejection', reason: result.reason },
      noticeSeq: session.noticeSeq + 1,
    };
  }
  return {
    ...session,
    state: result.state,
    selectedCard: null,
    preview: null,
    previewRejection: null,
    notice: { kind: 'event', event: result.event },
    noticeSeq: session.noticeSeq + 1,
  };
}

export function sessionReducer(session: UiSession | null, action: UiAction): UiSession | null {
  switch (action.type) {
    case 'replace':
      return action.session;
    case 'clear':
      return null;
    default:
      break;
  }

  if (session === null) return null;

  switch (action.type) {
    case 'select': {
      const built = buildPreview(session.state, action.card);
      return {
        ...session,
        selectedCard: action.card,
        preview: built.preview,
        previewRejection: built.rejection,
      };
    }
    case 'clearSelection':
      return { ...session, selectedCard: null, preview: null, previewRejection: null };
    case 'resolve': {
      if (session.selectedCard === null) return session;
      const card = session.selectedCard;
      const isMonsterCard = session.preview?.kind === 'monster';
      const result = applyAction(session.state, {
        type: 'resolveCard',
        card,
        ...(isMonsterCard && action.attack !== undefined ? { attack: action.attack } : {}),
      });
      const next = withNotice(session, result);
      return result.ok ? { ...next, lastSelection: card } : next;
    }
    case 'enterNextRoom':
      return withNotice(session, applyAction(session.state, { type: 'enterNextRoom' }));
    case 'runAway':
      return withNotice(session, applyAction(session.state, { type: 'runAway' }));
    case 'undoRoom': {
      const result = applyAction(session.state, { type: 'undoRoom' });
      if (!result.ok) return withNotice(session, result);
      // Undo restores the room; reselect the last confirmed card when it is back.
      const restored =
        session.lastSelection !== null &&
        result.state.room.cards.some((roomCard) => roomCard.card === session.lastSelection)
          ? session.lastSelection
          : null;
      const built =
        restored === null
          ? { preview: null, rejection: null }
          : buildPreview(result.state, restored);
      return {
        ...session,
        state: result.state,
        selectedCard: restored,
        preview: built.preview,
        previewRejection: built.rejection,
        notice: { kind: 'event', event: result.event },
        noticeSeq: session.noticeSeq + 1,
      };
    }
  }
}
