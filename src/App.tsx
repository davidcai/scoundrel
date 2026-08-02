import { useGame } from './hooks/useGame';
import HealthBar from './components/HealthBar';
import DeckIndicator from './components/DeckIndicator';
import ActionBar from './components/ActionBar';
import WeaponPanel from './components/WeaponPanel';
import Room from './components/Room';
import Log from './components/Log';
import GameOver from './components/GameOver';

export default function App() {
  const { state, actions } = useGame();

  return (
    <div className="app">
      <header className="app-header">
        <h1>Scoundrel</h1>
        <p className="tagline">A solo roguelike dungeon crawl with a deck of cards.</p>
      </header>

      <div className="hud">
        <HealthBar state={state} />
        <DeckIndicator state={state} />
        <ActionBar
          state={state}
          onRun={actions.run}
          onNext={actions.dealNext}
          onNew={() => actions.newGame()}
        />
      </div>

      <div className="play-area">
        <WeaponPanel state={state} />
        <Room
          state={state}
          onFightBarehanded={actions.fightBarehanded}
          onFightWithWeapon={actions.fightWithWeapon}
          onEquip={actions.equip}
          onDrink={actions.drink}
        />
      </div>

      <Log state={state} />

      <details className="legend">
        <summary>How to play</summary>
        <ul>
          <li><strong>Clubs/Spades</strong> are monsters (damage = value). Fight barehanded and take full damage, or with a weapon and take the difference.</li>
          <li><strong>Diamonds</strong> are weapons. After a kill, a weapon can only fight strictly weaker monsters. Equipping a new weapon discards the old one.</li>
          <li><strong>Hearts</strong> are potions. Only the first potion each room heals; extras fizzle.</li>
          <li>Resolve <strong>3 of 4</strong> cards each room; the leftover carries to the next. You may <strong>flee</strong> once per room (never twice in a row).</li>
          <li>Clear the whole dungeon to <strong>win</strong> (score = remaining health). Hit 0 health and you <strong>lose</strong> (score = &minus; remaining monster values).</li>
        </ul>
      </details>

      <GameOver state={state} onNew={() => actions.newGame()} onRetry={() => actions.newGame(state.seed)} />

      <footer className="seed-line">Seed: {state.seed}</footer>
    </div>
  );
}