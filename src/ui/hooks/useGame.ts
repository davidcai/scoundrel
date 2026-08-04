import { useCallback, useEffect, useReducer, useState } from "react";
import {
  applyAction, createGame, finalScore,
  offersFor as engineOffersFor, runOffer as engineRunOffer,
  type Action, type Card, type GameState, type Offer,
} from "../../engine";
import {
  SCHEMA, loadRun, loadStats, recordResult, saveRun, saveStats, type Stats,
} from "../../storage/persistence";
import { resolveStart } from "../../storage/resolveStart";
import { randomSeed, readSeedFromUrl, writeSeedToUrl } from "../../storage/seedUrl";

export type UseGame = {
  state: GameState;
  stats: Stats;
  offersFor: (card: Card) => readonly Offer[];
  runOffer: Offer;
  dispatch: (action: Action) => void;
  newGame: (seed?: string) => void;
};

type Session = { state: GameState; statsRecorded: boolean };

type SessionAction = { kind: "game"; action: Action } | { kind: "statsRecorded" };

function initialSession(): Session {
  const decision = resolveStart(readSeedFromUrl(), loadRun(), randomSeed);
  return decision.kind === "resume"
    ? { state: decision.run.state, statsRecorded: decision.run.statsRecorded }
    : { state: createGame(decision.seed), statsRecorded: false };
}

function sessionReducer(session: Session, sessionAction: SessionAction): Session {
  if (sessionAction.kind === "statsRecorded") return { ...session, statsRecorded: true };

  const state = applyAction(session.state, sessionAction.action);
  return {
    state,
    statsRecorded: sessionAction.action.type === "NEW_GAME" ? false : session.statsRecorded,
  };
}

export function useGame(): UseGame {
  const [session, dispatchSession] = useReducer(sessionReducer, undefined, initialSession);
  const [stats, setStats] = useState<Stats>(loadStats);

  const { state, statsRecorded } = session;

  // Keep the address bar showing the current dungeon so it is shareable.
  useEffect(() => {
    writeSeedToUrl(state.seed);
  }, [state.seed]);

  // Persist on every change. The snapshot is small; no debounce is warranted.
  useEffect(() => {
    saveRun({ schema: SCHEMA, state, statsRecorded });
  }, [state, statsRecorded]);

  // Record a terminal result exactly once, across reloads.
  useEffect(() => {
    if (state.status === "playing" || statsRecorded) return;
    const updated = recordResult(stats, state.status, finalScore(state));
    setStats(updated);
    saveStats(updated);
    dispatchSession({ kind: "statsRecorded" });
  }, [state, statsRecorded, stats]);

  const dispatch = useCallback((action: Action) => {
    dispatchSession({ kind: "game", action });
  }, []);

  const newGame = useCallback((seed?: string) => {
    dispatchSession({ kind: "game", action: { type: "NEW_GAME", seed: seed ?? randomSeed() } });
  }, []);

  const offersFor = useCallback((card: Card) => engineOffersFor(state, card), [state]);

  return { state, stats, offersFor, runOffer: engineRunOffer(state), dispatch, newGame };
}
