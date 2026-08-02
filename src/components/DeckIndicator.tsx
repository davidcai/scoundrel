import type { GameState } from '../game/types';

export default function DeckIndicator({ state }: { state: GameState }) {
  return (
    <div className="deck-indicator">
      <div className="deck-stack" aria-hidden>
        <div className="deck-card" />
        <div className="deck-card" />
        <div className="deck-card" />
      </div>
      <div className="deck-label">Dungeon: {state.dungeon.length}</div>
      <div className="deck-sub">Resolved: {state.resolvedCount}/{state.requiredResolves}</div>
    </div>
  );
}