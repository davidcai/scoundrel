import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import App from '../src/App';
import { DEFAULT_RULE_CONFIG, type GameState } from '../src/engine';
import { createTranslator } from '../src/i18n';
import { createScoundrelStore, type ScoundrelStore, type StoreSnapshot } from '../src/store';
import { saveFailureText } from '../src/i18n/messages';
import { applyStepThroughUi, doomedPolicy, findSeed, playThroughUi } from './helpers/game';
import { createMemoryStoreFixture } from './helpers/appStore';

const t = createTranslator('en');

function renderAppAt(hash: string, store?: ScoundrelStore) {
  window.history.replaceState(null, '', hash);
  return store === undefined ? render(<App />) : render(<App store={store} />);
}

/** Read the browser-persisted snapshot without the mounted app's store. */
function probe(): StoreSnapshot {
  const store = createScoundrelStore();
  try {
    return store.getSnapshot();
  } finally {
    store.close();
  }
}

function seedFromHash(): string {
  const match = /[?&]seed=([^&]*)/.exec(window.location.hash);
  if (match === null) throw new Error(`No seed in ${window.location.hash}`);
  return decodeURIComponent(match[1]!);
}

function roomCards(): HTMLElement[] {
  return Array.from(document.querySelectorAll<HTMLElement>('[data-card]'));
}

/** Resolve the first rendered card through its primary preview action. */
function resolveFirstCard(): void {
  const card = roomCards()[0]!;
  fireEvent.click(card);
  const confirm = document.querySelector<HTMLElement>('.preview__actions button.button--primary');
  if (confirm === null) throw new Error('No primary preview action.');
  fireEvent.click(confirm);
}

describe('persistence and run lifecycle', () => {
  it('keeps unfinished progress and resumes it after a reload', () => {
    const first = renderAppAt('#/');
    fireEvent.click(screen.getByRole('button', { name: t('title.newRun') }));
    const seed = seedFromHash();
    resolveFirstCard();
    expect(roomCards()).toHaveLength(3);
    first.unmount();

    // Reloading the play route restores the saved room, not a fresh deal.
    const second = renderAppAt(`#/play?seed=${encodeURIComponent(seed)}&config=0`);
    expect(roomCards()).toHaveLength(3);
    second.unmount();

    renderAppAt('#/');
    expect(screen.getByRole('button', { name: t('title.continue') })).toBeInTheDocument();
    expect(screen.getByText(new RegExp(seed))).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: t('title.continue') }));
    expect(roomCards()).toHaveLength(3);
  });

  it('re-renders a completed result after reload and offers no undo', () => {
    const lostSeed = findSeed('lost', doomedPolicy);
    const finalState = playThroughUi(lostSeed, DEFAULT_RULE_CONFIG, doomedPolicy);
    expect(finalState.status).toBe('lost');

    const heading = screen.getByRole('heading', { level: 1, name: t('result.lostTitle') });
    expect(heading).toBeInTheDocument();
    const score = document.querySelector('.result-score')?.textContent;
    const resultHash = window.location.hash;
    cleanup();

    renderAppAt(resultHash);
    expect(
      screen.getByRole('heading', { level: 1, name: t('result.lostTitle') }),
    ).toBeInTheDocument();
    expect(document.querySelector('.result-score')?.textContent).toBe(score);
    expect(screen.queryByRole('button', { name: t('play.undo') })).not.toBeInTheDocument();

    const snapshot = probe();
    expect(snapshot.statistics.gamesPlayed).toBe(1);
    expect(snapshot.statistics.losses).toBe(1);
    expect(snapshot.activeRun).toBeNull();
    expect(snapshot.completedResult).not.toBeNull();
  });

  it('replaces an unfinished run without confirmation and records one abandoned loss', () => {
    renderAppAt('#/');
    fireEvent.click(screen.getByRole('button', { name: t('title.newRun') }));
    const firstSeed = seedFromHash();
    resolveFirstCard();
    cleanup();

    renderAppAt('#/');
    expect(screen.getByRole('button', { name: t('title.continue') })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: t('title.newRun') }));

    const secondSeed = seedFromHash();
    expect(secondSeed).not.toBe(firstSeed);

    const snapshot = probe();
    expect(snapshot.activeRun?.seed).toBe(secondSeed);
    expect(snapshot.statistics).toMatchObject({ gamesPlayed: 1, wins: 0, losses: 1 });
    expect(snapshot.history).toHaveLength(1);
    expect(snapshot.history[0]?.abandoned).toBe(true);
    expect(snapshot.history[0]?.seed).toBe(firstSeed);
  });

  it('asks before discarding and records one abandoned loss on confirm', () => {
    renderAppAt('#/');
    fireEvent.click(screen.getByRole('button', { name: t('title.newRun') }));
    cleanup();

    renderAppAt('#/');
    fireEvent.click(screen.getByRole('button', { name: t('title.discardRun') }));
    expect(screen.getByRole('dialog', { name: t('title.discardTitle') })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: t('title.discardCancel') }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(probe().activeRun).not.toBeNull();

    fireEvent.click(screen.getByRole('button', { name: t('title.discardRun') }));
    const dialog = screen.getByRole('dialog', { name: t('title.discardTitle') });
    fireEvent.click(within(dialog).getByRole('button', { name: t('title.discardConfirm') }));

    const snapshot = probe();
    expect(snapshot.activeRun).toBeNull();
    expect(snapshot.statistics).toMatchObject({ gamesPlayed: 1, losses: 1 });
    expect(screenshotText()).not.toContain(t('title.continue'));
    expect(screen.queryByRole('button', { name: t('title.continue') })).not.toBeInTheDocument();
  });

  it('explains invalid seed and link entries without changing saved data', () => {
    renderAppAt('#/');

    fireEvent.click(screen.getByRole('button', { name: t('title.enterSeed') }));
    const seedInput = screen.getByRole('textbox', { name: t('title.seedLabel') });
    fireEvent.change(seedInput, { target: { value: '   ' } });
    fireEvent.click(screen.getByRole('button', { name: t('title.startWithSeed') }));

    expect(screen.getByTestId('seed-error')).toHaveTextContent(t('error.invalidSeed'));
    expect(window.location.hash).toBe('#/');
    expect(probe().activeRun).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: t('title.replayLink') }));
    const linkInput = screen.getByRole('textbox', { name: t('title.linkLabel') });
    fireEvent.change(linkInput, { target: { value: 'not a link' } });
    fireEvent.click(screen.getByRole('button', { name: t('title.openLink') }));

    expect(screen.getByTestId('link-error')).toHaveTextContent(t('error.invalidLink'));
    expect(window.location.hash).toBe('#/');
    expect(probe().statistics.gamesPlayed).toBe(0);
  });

  it('records a completed outcome once when a second tab completes it too', async () => {
    const fixture = createMemoryStoreFixture();
    renderAppAt('#/', fixture.store);
    fireEvent.click(screen.getByRole('button', { name: t('title.newRun') }));

    let state: GameState = fixture.store.getSnapshot().activeRun!.state;
    for (let step = 0; step < 400 && state.status === 'playing'; step += 1) {
      state = applyStepThroughUi(doomedPolicy(state), state);
    }
    expect(state.status).toBe('lost');

    await waitFor(() => expect(fixture.store.getSnapshot().completedResult).not.toBeNull());
    const completed = fixture.store.getSnapshot().completedResult!;

    // A second tab sees the same saved run and must not record it twice.
    const secondTab = createScoundrelStore({ storage: fixture.storage });
    secondTab.refresh();
    expect(secondTab.getSnapshot().statistics.gamesPlayed).toBe(1);

    const again = secondTab.completeRun(completed.runId, completed.state);
    expect(again.ok).toBe(true);
    if (again.ok) {
      expect(again.alreadyCompleted).toBe(true);
      expect(again.recorded).toBe(false);
    }
    expect(secondTab.getSnapshot().statistics.gamesPlayed).toBe(1);
    secondTab.close();
  });

  it('keeps an in-flight selection when another tab refreshes, and yields to a replacement run', async () => {
    const fixture = createMemoryStoreFixture();
    renderAppAt('#/', fixture.store);
    fireEvent.click(screen.getByRole('button', { name: t('title.newRun') }));

    const firstCard = roomCards()[0]!;
    fireEvent.click(firstCard);
    expect(firstCard).toHaveAttribute('aria-pressed', 'true');

    // Same-run refresh (window focus) must not discard the unsaved selection.
    window.dispatchEvent(new Event('focus'));
    expect(firstCard).toHaveAttribute('aria-pressed', 'true');

    // Another tab starts a different run; this tab yields with an explanation.
    const secondTab = createScoundrelStore({ storage: fixture.storage });
    const replacement = secondTab.startRunWithSeed('other-tab-seed', 0);
    expect(replacement.ok).toBe(true);
    secondTab.close();
    window.dispatchEvent(new Event('focus'));

    await waitFor(() =>
      expect(screen.getByTestId('shell-notice')).toHaveTextContent(
        saveFailureText(t, 'run-replaced'),
      ),
    );
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(t('app.title'));
  });
});

function screenshotText(): string {
  return document.body.textContent ?? '';
}
