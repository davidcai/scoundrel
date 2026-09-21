import { useEffect, useLayoutEffect, useRef, type RefObject } from 'react';
import { useGameStore } from '../store/game-store';
import type { GameState } from '../engine';
import { MotionDirector } from './motion';

/**
 * Wires the Phase 1a motion director to the game store. Mounted once by
 * PlayScreen: the subscription reacts only to meaningful beats — `fxSeq`
 * bumps, run start/replace (null → game), and run teardown — and skips the
 * no-op `selectCard(null)` notification that follows every resolve, so
 * in-flight choreography is never interrupted by selection changes.
 */
export function useMotionDirector(rootRef: RefObject<HTMLElement | null>): void {
  const directorRef = useRef<MotionDirector | null>(null);
  if (directorRef.current === null) {
    directorRef.current = new MotionDirector(() => rootRef.current);
  }

  // Board already rendered when this screen mounted (deep link / resume):
  // consumed on the first commit so the mount deal runs before first paint.
  const pendingMountRef = useRef<GameState | null>(useGameStore.getState().game);

  // Post-commit, pre-paint: executes any choreography planned by the latest
  // store notification against the freshly reconciled DOM.
  useLayoutEffect(() => {
    const director = directorRef.current;
    if (director === null) return;
    const mountGame = pendingMountRef.current;
    if (mountGame !== null) {
      pendingMountRef.current = null;
      director.onMounted(mountGame);
    }
    director.onCommit();
  });

  useEffect(() => {
    const director = directorRef.current;
    if (director === null) return;
    const unsubscribe = useGameStore.subscribe((state, prevState) => {
      director.onStoreChange(
        { game: state.game, lastResult: state.lastResult, fxSeq: state.fxSeq },
        { game: prevState.game, lastResult: prevState.lastResult, fxSeq: prevState.fxSeq },
      );
    });
    return () => {
      unsubscribe();
      director.dispose();
      // StrictMode replays mount effects after disposing: re-arm the mount
      // deal so the replayed layout effect deals again. Harmless on real
      // unmounts (the instance is discarded).
      pendingMountRef.current = useGameStore.getState().game;
    };
  }, []);
}
