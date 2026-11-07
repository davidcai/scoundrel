import { createGame, transition } from '../engine';
import type { Action, ActionResult, CardId, GameConfig, GameState } from '../engine';
import { EMPTY_STATISTICS, recordOutcome } from './statistics';
import type { RunRecord, Statistics } from './statistics';
export type FinishedRun = Exclude<GameState, { status: 'playing' }>;
export interface Session {
  readonly game: GameState | null;
  readonly screen: 'title' | 'play' | 'stats';
  readonly selected: CardId | null;
  readonly result: ActionResult | null;
  readonly runNumber: number;
  readonly statistics: Statistics;
  readonly history: readonly RunRecord[];
}
export const EMPTY_SESSION: Session = {
  game: null,
  screen: 'title',
  selected: null,
  result: null,
  runNumber: 0,
  statistics: EMPTY_STATISTICS,
  history: [],
};
export type SessionAction =
  | { type: 'start'; seed: string; config: GameConfig; at?: number }
  | { type: 'select'; cardId: CardId }
  | { type: 'act'; action: Action; at?: number }
  | { type: 'discard'; at?: number }
  | { type: 'title' | 'continue' | 'stats' };
function finishOutgoing(session: Session, at: number) {
  if (session.game?.status !== 'playing')
    return { statistics: session.statistics, history: session.history };
  const outgoing = transition(session.game, { type: 'abandon' }).state;
  return outgoing.status !== 'playing'
    ? recordOutcome(session.statistics, session.history, outgoing, session.runNumber, at)
    : { statistics: session.statistics, history: session.history };
}
export function sessionReducer(session: Session, action: SessionAction): Session {
  switch (action.type) {
    case 'start': {
      const game = createGame(action.seed, action.config);
      return {
        game,
        screen: 'play',
        selected: null,
        result: null,
        runNumber: session.runNumber + 1,
        ...finishOutgoing(session, action.at ?? 0),
      };
    }
    case 'select':
      return session.game?.status === 'playing' && session.game.board.room.includes(action.cardId)
        ? { ...session, selected: action.cardId }
        : session;
    case 'act': {
      if (!session.game) return session;
      const { state, result } = transition(session.game, action.action);
      if (result.type === 'invalid') return { ...session, result };
      const finished =
        state.status !== 'playing'
          ? recordOutcome(
              session.statistics,
              session.history,
              state,
              session.runNumber,
              action.at ?? 0,
            )
          : { statistics: session.statistics, history: session.history };
      return { ...session, ...finished, game: state, result, selected: null };
    }
    case 'discard':
      return {
        ...session,
        ...finishOutgoing(session, action.at ?? 0),
        game: null,
        screen: 'title',
        selected: null,
        result: null,
      };
    case 'title':
      return { ...session, screen: 'title', selected: null };
    case 'stats':
      return { ...session, screen: 'stats', selected: null };
    case 'continue':
      return session.game ? { ...session, screen: 'play' } : session;
  }
}
