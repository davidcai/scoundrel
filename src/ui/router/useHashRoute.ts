/**
 * Hand-rolled hash router (Q13c). Routes: #/ #/play #/stats #/settings
 * #/about. The play route accepts ?seed=…&config=… for shareable runs.
 * Hash routing needs no SPA fallback and tolerates any base path (Q20a).
 */
import { useEffect, useState } from 'react';
import type { GameConfig } from '../../engine';
import { decodeConfig } from './configCodec';

export type Route =
  | { name: 'title' }
  | {
      name: 'play';
      seed: string | null;
      config: GameConfig | null;
      /** Raw query after '?', kept as an effect dependency for stability. */
      query: string;
    }
  | { name: 'stats' }
  | { name: 'settings' }
  | { name: 'about' };

export function parseHash(hash: string): Route {
  const raw = hash.replace(/^#/, '') || '/';
  const qIndex = raw.indexOf('?');
  const path = qIndex === -1 ? raw : raw.slice(0, qIndex);
  const query = qIndex === -1 ? '' : raw.slice(qIndex + 1);
  switch (path) {
    case '/':
    case '':
      return { name: 'title' };
    case '/play': {
      const params = new URLSearchParams(query);
      const seedRaw = params.get('seed');
      return {
        name: 'play',
        seed: seedRaw !== null && seedRaw !== '' ? seedRaw : null,
        config: decodeConfig(params.get('config')),
        query,
      };
    }
    case '/stats':
      return { name: 'stats' };
    case '/settings':
      return { name: 'settings' };
    case '/about':
      return { name: 'about' };
    default:
      return { name: 'title' };
  }
}

export function navigate(hash: string): void {
  window.location.hash = hash;
}

export function useHashRoute(): Route {
  const [route, setRoute] = useState<Route>(() => parseHash(window.location.hash));
  useEffect(() => {
    const onHashChange = () => setRoute(parseHash(window.location.hash));
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);
  return route;
}
