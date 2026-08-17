import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import type { GameState } from '../../engine';
import { DEFAULT_CONFIG, cardAriaLabel } from '../../engine';
import { useGameStore } from '../../store/gameStore';
import { PlayScreen } from '../screens/PlayScreen';

function playingState(overrides: Partial<GameState> = {}): GameState {
  return {
    seed: 'test',
    config: { ...DEFAULT_CONFIG },
    phase: 'playing',
    hp: 20,
    maxHp: 20,
    dungeon: ['club-6', 'club-7', 'club-8', 'club-9'],
    room: ['club-10', 'heart-2', 'diamond-3', 'spade-4'],
    resolvedCount: 0,
    weapon: null,
    killStack: [],
    potionsUsedThisRoom: 0,
    ranAwayLastRoom: false,
    turnCount: 1,
    runHighlights: { monstersKilled: 0, potionsWasted: 0, roomsExplored: 1 },
    startedAt: 0,
    roomSnapshot: null,
    ...overrides,
  };
}

describe('PlayScreen', () => {
  beforeEach(() => {
    localStorage.clear();
    cleanup();
    useGameStore.setState({ state: null, selectedCardId: null, carriedCardIds: [], announcement: '' });
  });

  it('renders four room cards and resolves a monster fight barehanded', () => {
    useGameStore.setState({ state: playingState() });
    render(<PlayScreen params={new URLSearchParams()} />);

    const monsterCard = screen.getByRole('button', { name: cardAriaLabel('club-10') });
    fireEvent.click(monsterCard);

    const fightBtn = screen.getByRole('button', { name: /Fight barehanded \(10 dmg\)/ });
    fireEvent.click(fightBtn);

    const next = useGameStore.getState().state as GameState;
    expect(next.resolvedCount).toBe(1);
    expect(next.hp).toBe(10);
    expect(next.room).not.toContain('club-10');
  });

  it('offers both weapon and barehanded options when a weapon is equipped', () => {
    useGameStore.setState({
      state: playingState({ room: ['club-3'], weapon: 'diamond-5' }),
    });
    render(<PlayScreen params={new URLSearchParams()} />);

    fireEvent.click(screen.getByRole('button', { name: cardAriaLabel('club-3') }));

    expect(screen.getByRole('button', { name: /Fight barehanded \(3 dmg\)/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Fight with weapon \(0 dmg\)/ })).toBeInTheDocument();
  });

  it('drinks a potion and heals', () => {
    useGameStore.setState({
      state: playingState({ room: ['heart-5'], hp: 10 }),
    });
    render(<PlayScreen params={new URLSearchParams()} />);

    fireEvent.click(screen.getByRole('button', { name: cardAriaLabel('heart-5') }));
    fireEvent.click(screen.getByRole('button', { name: /Drink \(heal 5\)/ }));

    const next = useGameStore.getState().state as GameState;
    expect(next.hp).toBe(15);
  });
});
