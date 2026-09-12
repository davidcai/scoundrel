import { DEFAULT_CONFIG, type GameConfig } from '../engine';

/**
 * Shareable run URLs: `#/play?seed=...&config=...`. The config parameter
 * encodes only the non-default toggles as comma-separated tokens, so canonical
 * rules produce a clean, config-less link.
 */
const TOKEN_FREE_RUN = 'free-run';
const TOKEN_FREE_POTIONS = 'free-potions';
const TOKEN_NO_DEGRADATION = 'no-degradation';

export function encodeConfig(config: GameConfig): string {
  const tokens: string[] = [];
  if (config.runAwayMode === 'unlimited') tokens.push(TOKEN_FREE_RUN);
  if (config.potionsPerRoom === 'unlimited') tokens.push(TOKEN_FREE_POTIONS);
  if (!config.weaponDegradation) tokens.push(TOKEN_NO_DEGRADATION);
  return tokens.join(',');
}

export function decodeConfig(encoded: string | null): GameConfig {
  const config = { ...DEFAULT_CONFIG };
  if (encoded === null || encoded === '') return config;
  for (const token of encoded.split(',')) {
    if (token === TOKEN_FREE_RUN) config.runAwayMode = 'unlimited';
    else if (token === TOKEN_FREE_POTIONS) config.potionsPerRoom = 'unlimited';
    else if (token === TOKEN_NO_DEGRADATION) config.weaponDegradation = false;
  }
  return config;
}

export function runUrl(seed: string, config: GameConfig): string {
  const params = new URLSearchParams({ seed });
  const encoded = encodeConfig(config);
  if (encoded !== '') params.set('config', encoded);
  return `#/play?${params.toString()}`;
}
