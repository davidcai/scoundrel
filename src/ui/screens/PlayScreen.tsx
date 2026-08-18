/**
 * Play screen (#/play): three bands per style guide §6.2 — sticky HUD, the
 * table (preview line, room row, weapon zone), actions bar. Renders the
 * win/lose scorecard instead once the run is terminal.
 *
 * Route behavior:
 *  - '#/play?seed=…&config=…' starts that deterministic run when it doesn't
 *    already match the live store (shareable/replayable URLs, Q63).
 *  - Bare '#/play' renders the live run; with none in memory it restores the
 *    persisted one; failing that it bounces to title (Q45: never auto-drop).
 *
 * Keyboard (style guide §6.2): ←/→ across resolvable cards, Enter select →
 * confirm, Esc cancel, U undo, R run.
 */
import { useCallback, useEffect, useRef } from 'react';
import { useGame, useGameStoreApi } from '../../store/gameStore';
import { loadSettings } from '../../persistence/settings';
import { navigate, type Route } from '../router/useHashRoute';
import { encodeConfig } from '../router/configCodec';
import { ActionsBar } from '../components/ActionsBar';
import { Hud } from '../components/Hud';
import { PreviewLine } from '../components/PreviewLine';
import { RoomRow } from '../components/RoomRow';
import { WeaponZone } from '../components/WeaponZone';
import { EndScreen } from './EndScreen';
import './PlayScreen.css';

interface PlayScreenProps {
  route: Extract<Route, { name: 'play' }>;
}

export function PlayScreen({ route }: PlayScreenProps) {
  const store = useGameStoreApi();
  const game = useGame((s) => s.game);
  const outcome = useGame((s) => s.outcome);
  const slots = useGame((s) => s.slots);
  const selected = useGame((s) => s.selected);
  const cardRefs = useRef<(HTMLButtonElement | null)[]>([]);

  // URL → run reconciliation (idempotent; safe under StrictMode).
  useEffect(() => {
    if (route.seed !== null) {
      const config = route.config ?? loadSettings();
      const cur = store.getState().game;
      const sameRun = cur !== null && cur.seed === route.seed;
      const sameConfig = cur !== null && encodeConfig(cur.config) === encodeConfig(config);
      if (!sameRun || !sameConfig) {
        store.getState().newRun(route.seed, config);
      }
      return;
    }
    if (store.getState().game === null) {
      if (!store.getState().loadSavedRun()) {
        navigate('#/');
      }
    }
  }, [route.seed, route.config, route.query, store]);

  const resolvableIndexes = slots.map((slot, i) => (slot.resolved ? -1 : i)).filter((i) => i >= 0);

  const focusResolvable = useCallback(
    (direction: 1 | -1) => {
      const order = resolvableIndexes;
      if (order.length === 0) return;
      const active = document.activeElement;
      const currentIdx = cardRefs.current.findIndex((el) => el !== null && el === active);
      const currentPos = order.indexOf(currentIdx);
      const nextPos =
        currentPos === -1
          ? direction === 1
            ? 0
            : order.length - 1
          : (currentPos + direction + order.length) % order.length;
      const el = cardRefs.current[order[nextPos]];
      el?.focus();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- resolvable set derived from slots
    [slots],
  );

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.target instanceof HTMLInputElement) return;
    switch (e.key) {
      case 'ArrowLeft':
        e.preventDefault();
        focusResolvable(-1);
        break;
      case 'ArrowRight':
        e.preventDefault();
        focusResolvable(1);
        break;
      case 'Escape':
        if (selected !== null) {
          e.preventDefault();
          store.getState().cancelSelection();
        }
        break;
      case 'u':
      case 'U':
        e.preventDefault();
        store.getState().undo();
        break;
      case 'r':
      case 'R':
        e.preventDefault();
        store.getState().runAway();
        break;
      default:
        break;
    }
  };

  const terminal = outcome !== null || (game !== null && game.phase !== 'playing');

  return (
    <div className="play-screen" onKeyDown={onKeyDown}>
      {terminal && game !== null ? (
        <EndScreen />
      ) : (
        <>
          <Hud />
          <main className="play-table">
            <PreviewLine />
            <RoomRow cardRefs={cardRefs} />
            <WeaponZone />
          </main>
          <ActionsBar />
        </>
      )}
    </div>
  );
}
