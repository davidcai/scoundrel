import { render, type RenderResult } from '@testing-library/react';
import type { ReactElement } from 'react';
import {
  ScoundrelStoreProvider,
  createScoundrelStore,
  type ScoundrelStore,
  type ScoundrelStoreOptions,
} from '../../src/store';
import { createMemoryStorage } from '../../src/store/storage';
import { PreferencesProvider } from '../../src/store/preferences';
import { AnnouncerProvider } from '../../src/ui/components/Announcer';

export interface RenderWithProvidersOptions {
  /** Reuse a prepared store (e.g. one with a saved run or statistics). */
  store?: ScoundrelStore;
}

export interface RenderWithProvidersResult extends RenderResult {
  store: ScoundrelStore;
}

/** A store backed by in-memory storage, isolated from localStorage. */
export function createTestStore(options: ScoundrelStoreOptions = {}): ScoundrelStore {
  return createScoundrelStore({
    storage: createMemoryStorage(),
    ...options,
  });
}

/** Render interface components inside the store, preference, and announcer providers. */
export function renderWithProviders(
  ui: ReactElement,
  { store = createTestStore() }: RenderWithProvidersOptions = {},
): RenderWithProvidersResult {
  const result = render(
    <ScoundrelStoreProvider store={store}>
      <PreferencesProvider>
        <AnnouncerProvider>{ui}</AnnouncerProvider>
      </PreferencesProvider>
    </ScoundrelStoreProvider>,
  );
  return { ...result, store };
}
