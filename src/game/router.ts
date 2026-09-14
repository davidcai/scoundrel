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

function sameRoute(a: Route, b: Route): boolean {
  return a.path === b.path && a.params.toString() === b.params.toString();
}

/**
 * Framework-free hash router for Phaser scenes. `onRoute` fires only when
 * the parsed route actually changed; `stop()` removes the listener so the
 * owning scene can shut down cleanly.
 */
export class RouteController {
  private route: Route;
  private onRoute: (route: Route) => void;
  private readonly onChange = (): void => {
    const next = parseHash(window.location.hash);
    if (!sameRoute(next, this.route)) {
      this.route = next;
      this.onRoute(next);
    }
  };

  constructor(onRoute: (route: Route) => void) {
    this.onRoute = onRoute;
    this.route = parseHash(window.location.hash);
  }

  /** Parse the current hash, notify the handler, and start listening. */
  start(): void {
    const initial = parseHash(window.location.hash);
    this.route = initial;
    this.onRoute(initial);
    window.addEventListener('hashchange', this.onChange);
  }

  /** Remove the hashchange listener (call from scene shutdown). */
  stop(): void {
    window.removeEventListener('hashchange', this.onChange);
  }

  current(): Route {
    return this.route;
  }
}
