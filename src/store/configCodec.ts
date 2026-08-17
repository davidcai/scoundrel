import type { GameConfig } from '../engine';

/**
 * JSON-safe form of GameConfig. `potionsPerRoom: Infinity` is not representable
 * in JSON (JSON.stringify turns it into null), so we encode it as 'inf'.
 */
export interface SerializedConfig {
  runAwayMode: 'once' | 'unlimited';
  potionsPerRoom: 1 | 'inf';
  weaponDegradation: boolean;
}

export function serializeConfig(config: GameConfig): SerializedConfig {
  return {
    runAwayMode: config.runAwayMode,
    potionsPerRoom: config.potionsPerRoom === Infinity ? 'inf' : 1,
    weaponDegradation: config.weaponDegradation,
  };
}

export function parseConfig(serialized: SerializedConfig): GameConfig {
  return {
    runAwayMode: serialized.runAwayMode === 'unlimited' ? 'unlimited' : 'once',
    potionsPerRoom: serialized.potionsPerRoom === 'inf' ? Infinity : 1,
    weaponDegradation: serialized.weaponDegradation !== false,
  };
}

/** Build the `config` query string for a shareable replay URL. */
export function configToQuery(config: GameConfig): string {
  const s = serializeConfig(config);
  return 'runAway=' + s.runAwayMode + '&potions=' + s.potionsPerRoom + '&degrade=' + (s.weaponDegradation ? '1' : '0');
}

/** Read a GameConfig back from a URLSearchParams object. */
export function configFromQuery(params: URLSearchParams): GameConfig {
  return parseConfig({
    runAwayMode: params.get('runAway') === 'unlimited' ? 'unlimited' : 'once',
    potionsPerRoom: params.get('potions') === 'inf' ? 'inf' : 1,
    weaponDegradation: params.get('degrade') !== '0',
  });
}
