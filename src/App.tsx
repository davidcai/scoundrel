import { useReducer, useState, useCallback } from 'react';
import './index.css';
import {
  createGame,
  reduce,
  canRun,
  requiredResolves,
  type Action,
  type GameState,
} from './engine';
import { RoomCard } from './components/RoomCard';
import { WeaponPanel } from './components/WeaponPanel';
import { LogPanel } from './components/LogPanel';
import { EndScreen } from './components/EndScreen';

const MAX_HEALTH = 20;

function healthClass(health: number): string {
  const pct = health / MAX_HEALTH;
  if (pct > 0.5) return 'high';
  if (pct > 0.25) return 'mid';
  return 'low';
}

function healthColor(health: number): string {
  const pct = health / MAX_HEALTH;
  if (pct > 0.5) return 'var(--accent-health)';
  if (pct > 0.25) return 'var(--accent-health-mid)';
  return 'var(--accent-health-low)';
}

export default function App() {
  const [state, dispatch] = useReducer<(s: GameState, a: Action) => GameState, undefined>(
    reduce,
    undefined,
    () => createGame(),
  );
  const [seedInput, setSeedInput] = useState('');

  const handleNewGame = useCallback((seed?: number) => {
    dispatch({ type: 'newGame', seed });
  }, []);

  const handleFight = useCallback((cardId: string, useWeapon: boolean) => {
    dispatch({ type: 'fight', cardId, useWeapon });
  }, []);

  const handleEquip = useCallback((cardId: string) => {
    dispatch({ type: 'equip', cardId });
  }, []);

  const handleDrink = useCallback((cardId: string) => {
    dispatch({ type: 'drink', cardId });
  }, []);

  const handleRun = useCallback(() => {
    dispatch({ type: 'run' });
  }, []);

  const handleSeededNew = useCallback(() => {
    const trimmed = seedInput.trim();
    const seed = trimmed === '' ? undefined : Number(trimmed);
    dispatch({ type: 'newGame', seed: Number.isNaN(seed) ? undefined : seed });
    setSeedInput('');
  }, [seedInput]);

  const healthPct = Math.max(0, Math.min(100, (state.health / MAX_HEALTH) * 100));
  const resolvesNeeded = requiredResolves(state);
  const isOver = state.status === 'won' || state.status === 'lost';

  return (
    <div className="game">
      <header className="header">
        <div className="header-left">
          <h1 className="title">SCOUNDREL</h1>
        </div>
        <div className="header-controls">
          <div className="seed-control">
            <input
              className="seed-input"
              type="number"
              placeholder="seed"
              value={seedInput}
              onChange={(e) => setSeedInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSeededNew();
              }}
            />
            <button className="btn btn-ghost" onClick={handleSeededNew}>
              Seeded
            </button>
          </div>
          <button className="btn btn-primary" onClick={() => handleNewGame()}>
            New Game
          </button>
        </div>
      </header>

      <div className="health-bar-container">
        <div className="health-bar-label">
          <span>Health</span>
          <span className="health-value" style={{ color: healthColor(state.health) }}>
            {Math.max(0, state.health)} / {MAX_HEALTH}
          </span>
        </div>
        <div className="health-bar-track">
          <div
            className={`health-bar-fill ${healthClass(state.health)}`}
            style={{ width: `${healthPct}%` }}
          />
        </div>
      </div>

      <div className="stats-row">
        <div className="stat-pill">
          <span className="stat-pill-label">Dungeon</span>
          <span className="stat-pill-value">{state.deck.length} cards</span>
        </div>
        <div className="stat-pill">
          <span className="stat-pill-label">Room</span>
          <span className="stat-pill-value">#{state.roomId}</span>
        </div>
        <div className="stat-pill">
          <span className="stat-pill-label">Resolve</span>
          <span className="stat-pill-value">
            {state.resolvedThisRoom} / {resolvesNeeded}
          </span>
        </div>
        {state.enteredByRun && (
          <div className="stat-pill">
            <span className="stat-pill-label">Status</span>
            <span className="stat-pill-value warning">Can't run</span>
          </div>
        )}
      </div>

      <div className="main-grid">
        <div className="left-column">
          <div className="room-section">
            <div className="room-header">
              <div className="room-title">
                The Room
                {state.isFinalRoom && <span className="final-badge">FINAL</span>}
              </div>
              <div className="resolve-progress">
                Resolve <strong>{state.resolvedThisRoom}</strong> / {resolvesNeeded} cards
              </div>
            </div>
            <div className="room-cards">
              {state.room.map((card) => (
                <RoomCard
                  key={card.id}
                  state={state}
                  card={card}
                  onFight={handleFight}
                  onEquip={handleEquip}
                  onDrink={handleDrink}
                />
              ))}
            </div>
          </div>

          <div className="action-bar">
            <button
              className="btn btn-run"
              onClick={handleRun}
              disabled={!canRun(state)}
              title={
                state.enteredByRun
                  ? "Can't run two rooms in a row"
                  : state.resolvedThisRoom > 0
                    ? "Can't run after resolving cards"
                    : 'Run away to a new room'
              }
            >
              Run Away
            </button>
          </div>
        </div>

        <div className="right-column">
          <WeaponPanel state={state} />
          <LogPanel state={state} />
        </div>
      </div>

      {isOver && state.score !== null && (
        <EndScreen
          status={state.status as 'won' | 'lost'}
          score={state.score}
          onNewGame={() => handleNewGame()}
        />
      )}
    </div>
  );
}