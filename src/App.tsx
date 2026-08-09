import { useCallback, useState } from 'react';
import GameBoard from './components/GameBoard';
import {
  canFightWithWeapon,
  canRun,
  createGame,
  drinkPotion,
  equipWeapon,
  fightMonster,
  runAway,
} from './engine/game';
import type { GameState } from './engine/types';

export default function App() {
  const [state, setState] = useState<GameState>(() => createGame());
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const restart = useCallback(() => {
    setState(createGame());
    setSelectedId(null);
  }, []);

  const selectCard = useCallback((id: string) => {
    setSelectedId((prev) => (prev === id ? null : id));
  }, []);

  const equip = useCallback(
    (id: string) => {
      setState((s) => {
        try {
          return equipWeapon(s, id);
        } catch (e) {
          console.error(e);
          return s;
        }
      });
      setSelectedId(null);
    },
    [],
  );

  const drink = useCallback(
    (id: string) => {
      setState((s) => {
        try {
          return drinkPotion(s, id);
        } catch (e) {
          console.error(e);
          return s;
        }
      });
      setSelectedId(null);
    },
    [],
  );

  const fight = useCallback(
    (id: string, mode: 'barehanded' | 'weapon') => {
      setState((s) => {
        try {
          return fightMonster(s, id, mode);
        } catch (e) {
          console.error(e);
          return s;
        }
      });
      setSelectedId(null);
    },
    [],
  );

  const run = useCallback(() => {
    setState((s) => {
      try {
        return runAway(s);
      } catch (e) {
        console.error(e);
        return s;
      }
    });
    setSelectedId(null);
  }, []);

  return (
    <GameBoard
      state={state}
      selectedId={selectedId}
      onSelectCard={selectCard}
      onEquip={equip}
      onDrink={drink}
      onFight={fight}
      onRun={run}
      onRestart={restart}
      canRun={canRun(state)}
      canFightWithWeapon={(id: string) => canFightWithWeapon(state, id)}
    />
  );
}