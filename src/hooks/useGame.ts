import { useMemo, useReducer } from 'react';
import { createInitialState, reducer } from '../game/engine';
import type { Action } from '../game/types';

export function useGame() {
  const [state, dispatch] = useReducer(reducer, undefined, () => createInitialState());

  const actions = useMemo(
    () => ({
      newGame: (seed?: number) => dispatch({ type: 'NEW_GAME', seed } as Action),
      run: () => dispatch({ type: 'RUN' }),
      dealNext: () => dispatch({ type: 'DEAL_NEXT_ROOM' }),
      fightBarehanded: (cardId: string) => dispatch({ type: 'FIGHT_BAREHANDED', cardId }),
      fightWithWeapon: (cardId: string) => dispatch({ type: 'FIGHT_WITH_WEAPON', cardId }),
      equip: (cardId: string) => dispatch({ type: 'EQUIP_WEAPON', cardId }),
      drink: (cardId: string) => dispatch({ type: 'DRINK_POTION', cardId }),
    }),
    [],
  );

  return { state, actions };
}