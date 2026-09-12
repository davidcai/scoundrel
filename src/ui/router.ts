import { useEffect, useState } from 'react';

export interface Route {
  path: string;
  params: URLSearchParams;
}

export function parseHash(hash: string): Route {
  const raw = hash.replace(/^#/, '');
  const queryIndex = raw.indexOf('?');
  const path = queryIndex === -1 ? raw : raw.slice(0, queryIndex);
  const params = new URLSearchParams(queryIndex === -1 ? '' : raw.slice(queryIndex + 1));
  return { path: path === '' ? '/' : path, params };
}

export function navigate(to: string): void {
  window.location.hash = to;
}

export function useHashRoute(): Route {
  const [route, setRoute] = useState<Route>(() => parseHash(window.location.hash));

  useEffect(() => {
    const onChange = () => setRoute(parseHash(window.location.hash));
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);

  return route;
}
