/**
 * Router + shareable-URL codec tests: hash parsing, config round-trip, and
 * App-level renders of each route (title/stats/settings/about/play).
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from '../../App';
import { createGameStore } from '../../store/gameStore';
import { saveRun } from '../../persistence/run';
import { makeConfig, makeFakeEngine, makeState, slotsFor } from '../../test/fixtures';
import { decodeConfig, encodeConfig, replayHash } from './configCodec';
import { parseHash } from './useHashRoute';

beforeEach(() => {
  localStorage.clear();
});

describe('parseHash', () => {
  it('routes the five screens', () => {
    expect(parseHash('')).toEqual({ name: 'title' });
    expect(parseHash('#/')).toEqual({ name: 'title' });
    expect(parseHash('#/stats')).toEqual({ name: 'stats' });
    expect(parseHash('#/settings')).toEqual({ name: 'settings' });
    expect(parseHash('#/about')).toEqual({ name: 'about' });
    expect(parseHash('#/bogus')).toEqual({ name: 'title' });
  });

  it('parses a shareable play URL', () => {
    const route = parseHash('#/play?seed=a3f9k2&config=o1d');
    expect(route.name).toBe('play');
    if (route.name === 'play') {
      expect(route.seed).toBe('a3f9k2');
      expect(route.config).toEqual({
        runAwayMode: 'once',
        potionsPerRoom: 1,
        weaponDegradation: true,
      });
    }
  });

  it('returns nulls for missing/bogus params', () => {
    const route = parseHash('#/play');
    expect(route.name).toBe('play');
    if (route.name === 'play') {
      expect(route.seed).toBeNull();
      expect(route.config).toBeNull();
    }
  });
});

describe('config codec', () => {
  it('round-trips the canonical config as o1d', () => {
    const canonical = makeConfig();
    expect(encodeConfig(canonical)).toBe('o1d');
    expect(decodeConfig('o1d')).toEqual(canonical);
  });

  it('round-trips every toggle combination', () => {
    for (const runAwayMode of ['once', 'unlimited'] as const) {
      for (const potionsPerRoom of [1, Number.POSITIVE_INFINITY]) {
        for (const weaponDegradation of [true, false]) {
          const config = { runAwayMode, potionsPerRoom, weaponDegradation };
          expect(decodeConfig(encodeConfig(config))).toEqual(config);
        }
      }
    }
  });

  it('rejects malformed strings', () => {
    expect(decodeConfig(null)).toBeNull();
    expect(decodeConfig('')).toBeNull();
    expect(decodeConfig('ooo')).toBeNull();
    expect(decodeConfig('o1')).toBeNull();
    expect(decodeConfig('o1dd')).toBeNull();
  });

  it('replayHash composes the shareable run URL', () => {
    expect(replayHash('a3f9k2', makeConfig({ weaponDegradation: false }))).toBe(
      '#/play?seed=a3f9k2&config=o1n',
    );
  });
});

describe('App router renders', () => {
  const freshStore = () => createGameStore({ engine: makeFakeEngine() });

  it('renders title at #/', async () => {
    window.location.hash = '#/';
    render(<App store={freshStore()} />);
    expect(await screen.findByRole('heading', { name: 'Scoundrel' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'New Run' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Enter Seed' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Stats' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Settings' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'About' })).toBeInTheDocument();
    // No save → no Continue.
    expect(screen.queryByRole('button', { name: 'Continue' })).not.toBeInTheDocument();
  });

  it('renders stats at #/stats', async () => {
    window.location.hash = '#/stats';
    render(<App store={freshStore()} />);
    expect(await screen.findByRole('heading', { name: 'Stats' })).toBeInTheDocument();
    expect(screen.getByText('No runs yet — the dungeon awaits.')).toBeInTheDocument();
  });

  it('renders settings switches at #/settings', async () => {
    window.location.hash = '#/settings';
    render(<App store={freshStore()} />);
    expect(await screen.findByRole('switch', { name: /restrict run-away/i })).toBeInTheDocument();
    expect(screen.getByRole('switch', { name: /one potion per room/i })).toBeInTheDocument();
    expect(screen.getByRole('switch', { name: /weapon degradation/i })).toBeInTheDocument();
  });

  it('renders about at #/about', async () => {
    window.location.hash = '#/about';
    render(<App store={freshStore()} />);
    expect(await screen.findByRole('heading', { name: 'About' })).toBeInTheDocument();
    expect(screen.getByText(/Scoundrel is a solitaire card game/)).toBeInTheDocument();
  });

  it('renders the play screen at #/play from a persisted run', async () => {
    const state = makeState({ seed: 'saved1' });
    saveRun({
      state,
      slots: slotsFor(state.room),
      slotsSnapshot: slotsFor(state.room),
      carriedCardId: 'club-8',
      statsWritten: false,
      outcome: null,
    });
    window.location.hash = '#/play';
    const store = createGameStore({ engine: makeFakeEngine() });
    render(<App store={store} />);
    expect(
      await screen.findByRole('button', { name: '8 of Clubs, monster, value 8' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Seed saved1/ })).toBeInTheDocument();
  });

  it('starts a run from a seeded URL using the encoded config', async () => {
    window.location.hash = '#/play?seed=zz9999&config=uun';
    const store = createGameStore({ engine: makeFakeEngine() });
    render(<App store={store} />);
    expect(
      await screen.findByRole('button', { name: '8 of Clubs, monster, value 8' }),
    ).toBeInTheDocument();
    expect(store.getState().game?.seed).toBe('zz9999');
    expect(store.getState().game?.config).toEqual({
      runAwayMode: 'unlimited',
      potionsPerRoom: Number.POSITIVE_INFINITY,
      weaponDegradation: false,
    });
  });
});
