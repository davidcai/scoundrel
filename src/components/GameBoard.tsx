import type { Card, GameState } from '../engine/types';
import './styles.css';
import Controls from './Controls';
import DeckCounter from './DeckCounter';
import EventLog from './EventLog';
import GameOverScreen from './GameOverScreen';
import HealthBar from './HealthBar';
import RoomArea from './RoomArea';
import WeaponPanel from './WeaponPanel';

interface GameBoardProps {
  state: GameState;
  onSelectCard: (id: string) => void;
  onEquip: (id: string) => void;
  onDrink: (id: string) => void;
  onFight: (id: string, mode: 'barehanded' | 'weapon') => void;
  onRun: () => void;
  onRestart: () => void;
  canRun: boolean;
  canFightWithWeapon: (id: string) => boolean;
  selectedId: string | null;
}

function deriveKind(suit: Card['suit']) {
  switch (suit) {
    case 'clubs':
    case 'spades':
      return 'monster';
    case 'diamonds':
      return 'weapon';
    case 'hearts':
      return 'potion';
  }
}

export default function GameBoard({
  state,
  onSelectCard,
  onEquip,
  onDrink,
  onFight,
  onRun,
  onRestart,
  canRun,
  canFightWithWeapon,
  selectedId,
}: GameBoardProps) {
  function actionButtonsFor(card: Card) {
    const kind = deriveKind(card.suit);
    switch (kind) {
      case 'weapon':
        return (
          <button
            className="btn btn-equip"
            onClick={() => onEquip(card.id)}
          >
            Equip
          </button>
        );
      case 'potion':
        return (
          <button
            className="btn btn-drink"
            onClick={() => onDrink(card.id)}
          >
            Drink
          </button>
        );
      case 'monster': {
        const canUseWeapon = canFightWithWeapon(card.id);
        return (
          <>
            <button
              className="btn btn-fight-bare"
              onClick={() => onFight(card.id, 'barehanded')}
            >
              Fight Barehanded
            </button>
            <button
              className="btn btn-fight-weapon"
              onClick={() => onFight(card.id, 'weapon')}
              disabled={!canUseWeapon}
              title={
                canUseWeapon
                  ? 'Fight with equipped weapon'
                  : 'Weapon cannot defeat this monster'
              }
            >
              Fight with Weapon
            </button>
          </>
        );
      }
    }
  }

  return (
    <div className="game-board">
      <header className="game-top-bar">
        <HealthBar health={state.health} max={state.maxHealth} />
        <DeckCounter count={state.deckCount} />
        <Controls
          canRun={canRun}
          onRun={onRun}
          onRestart={onRestart}
        />
      </header>

      <main className="game-main">
        <RoomArea
          room={state.room}
          roomSize={state.roomSize}
          isFinalRoom={state.isFinalRoom}
          resolvedThisRoom={state.resolvedThisRoom}
          selectedId={selectedId}
          onSelectCard={onSelectCard}
          actionButtonsFor={actionButtonsFor}
        />
      </main>

      <aside className="game-side">
        <WeaponPanel weapon={state.equippedWeapon} />
        <EventLog log={state.log} />
      </aside>

      {(state.status === 'won' || state.status === 'lost') &&
        state.score !== null && (
          <GameOverScreen
            status={state.status}
            score={state.score}
            onRestart={onRestart}
          />
        )}
    </div>
  );
}
