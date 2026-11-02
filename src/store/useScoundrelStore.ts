import { useContext, useSyncExternalStore } from 'react';
import type { ScoundrelStore, StoreSnapshot } from './scoundrelStore';
import { ScoundrelStoreContext } from './scoundrelStoreContext';

/** Access the persisted store for actions (start, save, complete, discard, settings). */
export function useScoundrelStore(): ScoundrelStore {
  const store = useContext(ScoundrelStoreContext);
  if (store === null) {
    throw new Error('useScoundrelStore must be used inside ScoundrelStoreProvider');
  }
  return store;
}

/** Subscribe to the latest store snapshot for rendering. */
export function useScoundrelSnapshot(): StoreSnapshot {
  const store = useScoundrelStore();
  return useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
}
