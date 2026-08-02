import './style.css';
import { type Action, type GameState, applyAction, createGame, isLegal } from './game/engine.js';
import { render, resetAnimations } from './ui/render.js';

const root = document.querySelector<HTMLElement>('#app');
if (!root) throw new Error('Missing #app mount point');

/** A `?seed=` in the URL reproduces a specific dungeon. */
function seedFromUrl(): number | undefined {
  const raw = new URLSearchParams(window.location.search).get('seed');
  if (raw === null) return undefined;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed >>> 0 : undefined;
}

let state: GameState = createGame(seedFromUrl());

function draw(): void {
  render(root as HTMLElement, state, { dispatch, newGame });
}

function dispatch(action: Action): void {
  // Guard rather than throw: a double-click can land on a card that the first
  // click already resolved.
  if (!isLegal(state, action)) return;
  state = applyAction(state, action);
  draw();
}

function newGame(seed?: number): void {
  state = createGame(seed);
  resetAnimations();
  draw();
}

draw();
