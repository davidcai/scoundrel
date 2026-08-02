import { useReducer } from 'react';
import { createGame, gameReducer } from '../engine/game';

export function useGame() {
  return useReducer(gameReducer, undefined, createGame);
}
