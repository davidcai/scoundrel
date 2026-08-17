import { useEffect, useState } from 'react';

export type Route = 'title' | 'play' | 'stats' | 'settings' | 'about';

export interface RouteInfo {
  route: Route;
  params: URLSearchParams;
}

const ROUTES: Route[] = ['play', 'stats', 'settings', 'about'];

export function parseHash(): RouteInfo {
  const raw = window.location.hash.replace(/^#\/?/, '');
  const [path, query = ''] = raw.split('?');
  const route: Route = ROUTES.includes(path as Route) ? (path as Route) : 'title';
  return { route, params: new URLSearchParams(query) };
}

export function useHashRoute(): RouteInfo {
  const [info, setInfo] = useState<RouteInfo>(() => parseHash());
  useEffect(() => {
    const onChange = () => setInfo(parseHash());
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return info;
}

export function navigate(route: string, query?: string): void {
  window.location.hash = query ? '#/' + route + '?' + query : '#/' + route;
}
