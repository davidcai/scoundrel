import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import App from '../src/App';
import { DEFAULT_RULE_CONFIG, createInitialState } from '../src/engine';
import { createTranslator } from '../src/i18n';
import { playPath } from '../src/ui/routes';

const t = createTranslator('en');

describe('app shell', () => {
  it('shows the title screen at #/', () => {
    window.history.replaceState(null, '', '#/');
    render(<App />);

    expect(screen.getByRole('heading', { level: 1, name: t('app.title') })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: t('title.newRun') })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: t('title.rulesHelp') })).toBeInTheDocument();
  });

  it('starts a seeded run from the title screen and routes to #/play', () => {
    window.history.replaceState(null, '', '#/');
    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: t('title.newRun') }));

    expect(
      screen.getByRole('heading', { level: 1, name: t('play.roomNumber', { number: 1 }) }),
    ).toBeInTheDocument();
    expect(window.location.hash.startsWith('#/play?seed=')).toBe(true);
    expect(window.location.hash).toContain('config=0');
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '20');
    expect(screen.getByRole('group', { name: t('a11y.roomCards') })).toBeInTheDocument();
  });

  it('opens a direct #/play link with the linked seed and house rules', () => {
    window.history.replaceState(null, '', `#${playPath('linked-seed', DEFAULT_RULE_CONFIG)}`);
    render(<App />);

    expect(screen.getByText('linked-seed')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 1, name: t('play.roomNumber', { number: 1 }) }),
    ).toBeInTheDocument();
  });

  it('falls back to the title screen for an invalid play link', () => {
    window.history.replaceState(null, '', '#/play?seed=&config=9');
    render(<App />);

    expect(screen.getByRole('heading', { level: 1, name: t('app.title') })).toBeInTheDocument();
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
  });

  it('does not treat #/playground as the play route', () => {
    window.history.replaceState(null, '', '#/playground?seed=linked-seed&config=0');
    render(<App />);

    expect(screen.getByRole('heading', { level: 1, name: t('app.title') })).toBeInTheDocument();
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
  });

  it('keeps the engine seed from the linked route', () => {
    const state = createInitialState('linked-seed', DEFAULT_RULE_CONFIG);
    window.history.replaceState(null, '', `#${playPath(state.seed, state.config)}`);
    render(<App />);

    expect(screen.getByText(state.seed)).toBeInTheDocument();
  });
});
