import { describe, expect, it } from 'vitest';
import { createElement, type ReactNode } from 'react';
import { act, renderHook } from '@testing-library/react';
import { ScoundrelStoreProvider } from './ScoundrelStoreProvider';
import { useScoundrelSnapshot, useScoundrelStore } from './useScoundrelStore';
import { createScoundrelStore, type ScoundrelStore } from './scoundrelStore';
import { createMemoryStorage } from './storage';

function makeStore(): ScoundrelStore {
  let runs = 0;
  return createScoundrelStore({
    storage: createMemoryStorage(),
    now: () => new Date('2026-10-31T12:00:00.000Z'),
    newRunId: () => `run-${String(++runs)}`,
    newSeed: () => 'hook-seed',
  });
}

function wrapperFor(store: ScoundrelStore) {
  return function Wrapper({ children }: { readonly children: ReactNode }) {
    return createElement(ScoundrelStoreProvider, { store, children });
  };
}

describe('ScoundrelStoreProvider', () => {
  it('renders the latest snapshot and updates it on store actions', () => {
    const store = makeStore();
    const { result } = renderHook(() => useScoundrelSnapshot(), { wrapper: wrapperFor(store) });

    expect(result.current.activeRun).toBeNull();
    expect(result.current.title.canContinue).toBe(false);

    act(() => {
      store.startNewRun(0);
    });

    expect(result.current.activeRun?.runId).toBe('run-1');
    expect(result.current.title.canContinue).toBe(true);
  });

  it('exposes the same store instance through the hook', () => {
    const store = makeStore();
    const { result } = renderHook(() => useScoundrelStore(), { wrapper: wrapperFor(store) });
    expect(result.current).toBe(store);
  });

  it('throws when used outside the provider', () => {
    const { result } = renderHook(() => {
      try {
        useScoundrelStore();
        return null;
      } catch (error) {
        return error as Error;
      }
    });
    expect(result.current?.message).toContain('ScoundrelStoreProvider');
  });
});
