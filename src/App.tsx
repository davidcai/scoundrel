import { useState } from 'react';
import { canUseWeapon, drinkPotion, equipWeapon, fightMonster, runAway, startGame } from './game/rules';
import type { Card, GameState } from './game/types';
import ActionLog from './components/ActionLog';
import CardView from './components/CardView';
import GameOverScreen from './components/GameOverScreen';
import HUD from './components/HUD';
import RoomView from './components/RoomView';
import StartScreen from './components/StartScreen';

export default function App() {
  const [screen, setScreen] = useState<'menu' | 'game'>('menu');
  const [state, setState] = useState<GameState | null>(null);
  const [pendingMonster, setPendingMonster] = useState<Card | null>(null);

  const start = () => {
    setState(startGame());
    setScreen('game');
    setPendingMonster(null);
  };

  const handleCardClick = (card: Card) => {
    if (!state || state.phase !== 'playing' || pendingMonster) return;
    const kind = card.suit === 'clubs' || card.suit === 'spades' ? 'monster'
      : card.suit === 'diamonds' ? 'weapon' : 'potion';
    if (kind === 'monster') {
      if (state.weapon && canUseWeapon(state.weapon, card)) {
        setPendingMonster(card);
      } else {
        setState(fightMonster(state, card.id, false));
      }
    } else if (kind === 'weapon') {
      setState(equipWeapon(state, card.id));
    } else {
      setState(drinkPotion(state, card.id));
    }
  };

  const fightChoice = (useWeapon: boolean) => {
    if (!state || !pendingMonster) return;
    setState(fightMonster(state, pendingMonster.id, useWeapon));
    setPendingMonster(null);
  };

  if (screen === 'menu' || !state) {
    return <StartScreen onStart={start} />;
  }

  return (
    <div className="app">
      <header className="topbar">
        <h1>Scoundrel</h1>
        <button type="button" className="btn small" onClick={() => setScreen('menu')}>
          Rules
        </button>
      </header>

      <HUD
        state={state}
        onRunAway={() => state.phase === 'playing' && setState(runAway(state))}
      />

      <RoomView
        room={state.room}
        resolved={state.resolved}
        carried={state.carried}
        onCardClick={handleCardClick}
      />

      <ActionLog log={state.log} />

      {pendingMonster && state.weapon && (
        <div className="modal-backdrop" onClick={() => setPendingMonster(null)}>
          <div className="fight-choice" onClick={(e) => e.stopPropagation()}>
            <p className="fight-title">Face {pendingMonster.value} with your weapon or barehanded?</p>
            <div className="fight-cards">
              <CardView card={pendingMonster} />
            </div>
            <div className="fight-buttons">
              <button type="button" className="btn primary" onClick={() => fightChoice(true)}>
                ⚔️ Fight with your {state.weapon.card.value}
              </button>
              <button type="button" className="btn danger" onClick={() => fightChoice(false)}>
                👊 Fight barehanded
              </button>
            </div>
          </div>
        </div>
      )}

      {state.phase !== 'playing' && state.score !== null && (
        <div className="modal-backdrop">
          <GameOverScreen
            won={state.phase === 'won'}
            score={state.score}
            onNewGame={start}
            onMenu={() => setScreen('menu')}
          />
        </div>
      )}
    </div>
  );
}
