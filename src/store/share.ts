/**
 * Replay and share links (REQ-014).
 *
 * A share link carries the seed and the run's original rule options as the
 * hash route `#/play?seed=<seed>&config=<digit>`. Starting from a link is a
 * fresh attempt: seed and options only, never moves or progress.
 *
 * Parsing validates through the rules engine (`parseSeed`, `parseRuleConfig`),
 * so callers must leave the active run and statistics untouched when parsing
 * fails. A seed-only link uses the recipient's selected rule options.
 */
import {
  formatRuleConfig,
  isRuleConfig,
  parseRuleConfig,
  parseSeed,
  requireSeed,
  type RuleConfig,
} from '../engine';

export const PLAY_ROUTE = '/play';

export type ReplayLinkIssue = 'invalid-link' | 'invalid-seed' | 'invalid-config';

export type ParseReplayLinkResult =
  | {
      readonly ok: true;
      readonly seed: string;
      readonly config: RuleConfig;
      /** True when the link named rule options; false when the fallback was used. */
      readonly configFromLink: boolean;
    }
  | { readonly ok: false; readonly reason: ReplayLinkIssue };

function fragmentOf(input: string): string | null {
  const hashIndex = input.indexOf('#');
  if (hashIndex >= 0) return input.slice(hashIndex + 1);
  // Also accept a bare fragment such as "/play?seed=..." for callers that
  // already stripped the leading "#".
  if (input.startsWith('/')) return input;
  return null;
}

function isPlayPath(path: string): boolean {
  return path === PLAY_ROUTE || path === `${PLAY_ROUTE}/`;
}

/**
 * Parse a share link or hash fragment. `fallbackConfig` is the rule options
 * the recipient currently has selected, used when the link has no `config`.
 */
export function parseReplayLink(input: string, fallbackConfig: RuleConfig): ParseReplayLinkResult {
  const fragment = fragmentOf(input);
  if (fragment === null) return { ok: false, reason: 'invalid-link' };
  const queryIndex = fragment.indexOf('?');
  const path = queryIndex >= 0 ? fragment.slice(0, queryIndex) : fragment;
  if (!isPlayPath(path)) return { ok: false, reason: 'invalid-link' };
  const query = queryIndex >= 0 ? fragment.slice(queryIndex + 1) : '';
  const params = new URLSearchParams(query);

  const rawSeed = params.get('seed');
  if (rawSeed === null) return { ok: false, reason: 'invalid-seed' };
  const seed = parseSeed(rawSeed);
  if (seed === null) return { ok: false, reason: 'invalid-seed' };

  const rawConfig = params.get('config');
  if (rawConfig === null) {
    return { ok: true, seed, config: fallbackConfig, configFromLink: false };
  }
  const config = parseRuleConfig(rawConfig);
  if (config === null) return { ok: false, reason: 'invalid-config' };
  return { ok: true, seed, config, configFromLink: true };
}

/** Build the in-app hash link `#/play?seed=...&config=...` for copying. */
export function buildReplayHash(seed: string, config: RuleConfig): string {
  const normalizedSeed = requireSeed(seed);
  if (!isRuleConfig(config)) throw new RangeError(`Unsupported rule config: ${String(config)}`);
  return `#${PLAY_ROUTE}?seed=${encodeURIComponent(normalizedSeed)}&config=${formatRuleConfig(config)}`;
}

/** Build an absolute replay URL from a base such as `location.origin + location.pathname`. */
export function buildReplayUrl(seed: string, config: RuleConfig, baseUrl: string): string {
  const base = baseUrl.replace(/#.*$/, '').replace(/\/+$/, '');
  return `${base}${buildReplayHash(seed, config)}`;
}
