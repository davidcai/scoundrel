import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import App from '../src/App';
import { DEFAULT_RULE_CONFIG } from '../src/engine';
import { createTranslator } from '../src/i18n';
import { SCHEMA_VERSION, STORAGE_KEYS, createScoundrelStore } from '../src/store';
import {
  createMemoryStorage,
  createUnavailableStorage,
  type StoreStorage,
} from '../src/store/storage';
import { createMemoryStoreFixture, failingWriteStorage, writeRawShard } from './helpers/appStore';

const t = createTranslator('en');

function renderAt(hash: string, store: ReturnType<typeof createScoundrelStore>) {
  window.history.replaceState(null, '', hash);
  return render(<App store={store} />);
}

function roomCards(): HTMLElement[] {
  return Array.from(document.querySelectorAll<HTMLElement>('[data-card]'));
}

describe('saved-data recovery', () => {
  it('reports an unreadable run without overwriting it and recovers that shard only', () => {
    const { storage } = createMemoryStoreFixture();
    const raw = '{ this is not a saved run';
    writeRawShard(storage, 'run', raw);
    const store = createScoundrelStore({ storage });

    renderAt('#/', store);
    const notice = screen.getByLabelText(t('a11y.storageNotice'));
    expect(within(notice).getByText(t('storage.unreadableRun'))).toBeInTheDocument();
    // The unreadable payload is preserved until the user chooses recovery.
    expect(storage.read(STORAGE_KEYS.run)).toEqual({ status: 'ok', value: raw });

    fireEvent.click(within(notice).getByRole('button', { name: t('storage.discardRun') }));
    expect(screen.queryByLabelText(t('a11y.storageNotice'))).not.toBeInTheDocument();
    const after = storage.read(STORAGE_KEYS.run);
    expect(after).toMatchObject({ status: 'ok', value: null });

    // Play is possible again after discarding the unreadable run.
    fireEvent.click(screen.getByRole('button', { name: t('title.newRun') }));
    expect(roomCards()).toHaveLength(4);
  });

  it('explains a newer saved-data version and preserved payload', () => {
    const { storage } = createMemoryStoreFixture();
    writeRawShard(
      storage,
      'run',
      JSON.stringify({ schemaVersion: SCHEMA_VERSION + 5, data: { state: 'future' } }),
    );
    const store = createScoundrelStore({ storage });

    renderAt('#/', store);
    const notice = screen.getByLabelText(t('a11y.storageNotice'));
    const message = within(notice)
      .getAllByText((_content, element) =>
        (element?.textContent ?? '').includes(t('storage.newerVersion')),
      )
      .at(0);
    expect(message).toBeDefined();
    expect(
      within(notice).getByRole('button', { name: t('storage.discardRun') }),
    ).toBeInTheDocument();
  });

  it('resets an unreadable statistics shard without touching a readable run', () => {
    const { storage, store } = createMemoryStoreFixture();
    const started = store.startNewRun(DEFAULT_RULE_CONFIG);
    expect(started.ok).toBe(true);
    writeRawShard(storage, 'stats', '{"schemaVersion":1,"data":');

    const reader = createScoundrelStore({ storage });
    renderAt('#/', reader);
    const notice = screen.getByLabelText(t('a11y.storageNotice'));
    expect(within(notice).getByText(t('storage.unreadableStats'))).toBeInTheDocument();

    fireEvent.click(within(notice).getByRole('button', { name: t('storage.resetStats') }));
    expect(screen.queryByLabelText(t('a11y.storageNotice'))).not.toBeInTheDocument();
    // The readable run shard is still there: Continue is offered.
    expect(screen.getByRole('button', { name: t('title.continue') })).toBeInTheDocument();
  });

  it('stays playable with a session-only run when storage is unavailable', () => {
    const store = createScoundrelStore({ storage: createUnavailableStorage() });
    renderAt('#/', store);

    const notice = screen.getByLabelText(t('a11y.storageNotice'));
    expect(within(notice).getByText(t('storage.unavailable'))).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: t('title.newRun') }));
    expect(roomCards()).toHaveLength(4);
    expect(screen.getByText(t('play.sessionOnly'))).toBeInTheDocument();
  });

  it('explains a failed start write instead of silently retrying', () => {
    const store = createScoundrelStore({ storage: failingWriteStorage() });
    renderAt('#/', store);
    fireEvent.click(screen.getByRole('button', { name: t('title.newRun') }));

    expect(screen.getByTestId('start-error')).toHaveTextContent(t('error.writeFailed'));
    expect(roomCards()).toHaveLength(0);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(t('app.title'));
  });

  it('keeps an in-progress run playable when a later save write fails', () => {
    const inner = createMemoryStorage();
    let failWrites = false;
    const flaky: StoreStorage = {
      available: true,
      read: inner.read,
      write: (key, value) => (failWrites ? { status: 'unavailable' } : inner.write(key, value)),
      remove: (key) => (failWrites ? { status: 'unavailable' } : inner.remove(key)),
      subscribe: inner.subscribe,
    };
    const store = createScoundrelStore({ storage: flaky });
    renderAt('#/', store);
    fireEvent.click(screen.getByRole('button', { name: t('title.newRun') }));
    expect(roomCards()).toHaveLength(4);

    failWrites = true;
    fireEvent.click(roomCards()[0]!);
    fireEvent.click(
      document.querySelector<HTMLElement>('.preview__actions button.button--primary')!,
    );

    expect(roomCards()).toHaveLength(3);
    expect(screen.getByText(t('play.sessionOnly'))).toBeInTheDocument();
    const notice = screen.getByLabelText(t('a11y.storageNotice'));
    expect(within(notice).getByText(t('storage.writeFailed'))).toBeInTheDocument();
  });
});
