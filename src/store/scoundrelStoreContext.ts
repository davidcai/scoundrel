import { createContext } from 'react';
import type { ScoundrelStore } from './scoundrelStore';

/** Shared by the provider and the hooks; not part of the public store API. */
export const ScoundrelStoreContext = createContext<ScoundrelStore | null>(null);
