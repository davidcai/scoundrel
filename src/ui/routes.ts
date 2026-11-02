/**
 * Minimal hash router (implementation-plan foundation decision: hash routing
 * keeps every route on index.html, so no server rewrites are required).
 *
 * Phase 3 routes:
 * - `#/`                                   title
 * - `#/play?seed=<seed>&config=<0–7>`      play a run (also serves the future replay link)
 *
 * Result is an in-session screen; reload restoration arrives with Phase 4.
 */
import { formatRuleConfig, parseRuleConfig, parseSeed, type RuleConfig } from '../engine';

export type Route =
  | { readonly name: 'title' }
  | { readonly name: 'play'; readonly seed: string; readonly config: RuleConfig };

const PLAY_PREFIX = '/play';

export function parseRoute(hash: string): Route {
  const path = hash.replace(/^#/, '');
  // Exact route match: '#/playground?...' must not be treated as '#/play'.
  const isPlayRoute = path === PLAY_PREFIX || path.startsWith(`${PLAY_PREFIX}?`);
  if (!isPlayRoute) return { name: 'title' };

  const queryIndex = path.indexOf('?');
  const search = queryIndex >= 0 ? path.slice(queryIndex + 1) : '';
  const params = new URLSearchParams(search);
  const seedParam = params.get('seed');
  const configParam = params.get('config');
  const seed = seedParam === null ? null : parseSeed(seedParam);
  const config = configParam === null ? null : parseRuleConfig(configParam);

  if (seed === null || config === null) return { name: 'title' };
  return { name: 'play', seed, config };
}

export function playPath(seed: string, config: RuleConfig): string {
  return `${PLAY_PREFIX}?seed=${encodeURIComponent(seed)}&config=${formatRuleConfig(config)}`;
}

export function currentRoute(): Route {
  if (typeof window === 'undefined') return { name: 'title' };
  return parseRoute(window.location.hash);
}

export function navigate(path: string): void {
  window.history.pushState(null, '', `#${path}`);
}
