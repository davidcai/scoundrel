import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import App from '../src/App';
import { createTranslator } from '../src/i18n';
import { createScoundrelStore } from '../src/store';
import { createMemoryStorage } from '../src/store/storage';

const t = createTranslator('en');

function renderAt(hash: string, store: ReturnType<typeof createScoundrelStore>) {
  window.history.replaceState(null, '', hash);
  return render(<App store={store} />);
}

function roomCards(): HTMLElement[] {
  return Array.from(document.querySelectorAll<HTMLElement>('[data-card]'));
}

function openStoredRun(
  storage: ReturnType<typeof createMemoryStorage>,
): ReturnType<typeof createScoundrelStore> {
  const store = createScoundrelStore({ storage });
  const first = renderAt('#/', store);
  fireEvent.click(screen.getByRole('button', { name: t('title.newRun') }));
  expect(roomCards()).toHaveLength(4);
  first.unmount();
  renderAt('#/', store);
  return store;
}

describe('title entry points', () => {
  it('starts from a seed with the chosen house rules', () => {
    const store = createScoundrelStore({ storage: createMemoryStorage() });
    renderAt('#/', store);

    fireEvent.click(screen.getByRole('button', { name: t('title.settings') }));
    fireEvent.click(
      screen.getByRole('checkbox', { name: new RegExp(t('rule.consecutiveEscapesAllowed')) }),
    );
    fireEvent.click(screen.getByRole('button', { name: t('settings.close') }));
    fireEvent.click(screen.getByRole('button', { name: t('title.enterSeed') }));
    fireEvent.change(screen.getByRole('textbox', { name: t('title.seedLabel') }), {
      target: { value: 'entry-seed' },
    });
    fireEvent.click(screen.getByRole('button', { name: t('title.startWithSeed') }));

    expect(window.location.hash).toContain('seed=entry-seed');
    expect(window.location.hash).toContain('config=1');
    expect(screen.getByLabelText(t('a11y.seed', { seed: 'entry-seed' }))).toBeInTheDocument();
    expect(roomCards()).toHaveLength(4);
    expect(store.getSnapshot().activeRun?.config).toBe(1);
  });

  it('traps focus in the discard dialog and restores it on Escape', () => {
    const store = openStoredRun(createMemoryStorage());

    const trigger = screen.getByRole('button', { name: t('title.newRun') });
    trigger.focus();
    fireEvent.click(trigger);

    const dialog = screen.getByRole('dialog', { name: t('title.discardTitle') });
    const close = within(dialog).getByRole('button', { name: t('title.closeDialog') });
    expect(close).toHaveFocus();

    const confirm = within(dialog).getByRole('button', { name: t('title.discardConfirm') });
    confirm.focus();
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(close).toHaveFocus();

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
    expect(store.getSnapshot().activeRun).not.toBeNull();
  });

  it('replaces the unfinished run from the seed form with one abandoned loss', () => {
    const store = openStoredRun(createMemoryStorage());

    fireEvent.click(screen.getByRole('button', { name: t('title.enterSeed') }));
    fireEvent.change(screen.getByRole('textbox', { name: t('title.seedLabel') }), {
      target: { value: 'replacement-seed' },
    });
    fireEvent.click(screen.getByRole('button', { name: t('title.startWithSeed') }));

    const snapshot = store.getSnapshot();
    expect(snapshot.activeRun?.seed).toBe('replacement-seed');
    expect(snapshot.statistics).toMatchObject({ gamesPlayed: 1, losses: 1 });
    expect(snapshot.history).toHaveLength(1);
    expect(snapshot.history[0]?.abandoned).toBe(true);
  });
});
