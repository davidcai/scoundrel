import { type ReactNode } from 'react';
import type { ScoundrelStore } from './scoundrelStore';
import { ScoundrelStoreContext } from './scoundrelStoreContext';

export interface ScoundrelStoreProviderProps {
  readonly store: ScoundrelStore;
  readonly children: ReactNode;
}

/** Makes one persisted store available to the Phase 4 interface tree. */
export function ScoundrelStoreProvider({ store, children }: ScoundrelStoreProviderProps) {
  return <ScoundrelStoreContext.Provider value={store}>{children}</ScoundrelStoreContext.Provider>;
}
