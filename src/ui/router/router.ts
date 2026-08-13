/**
 * Hash router + shareable-run URL codec (docs/spec.md "Routing & flow", US62).
 *
 * Routes: '#/' (title), '#/play', '#/stats', '#/settings', '#/about'. Unknown
 * routes resolve to title. '#/play?seed=X[&config=Y]' is the shareable replay
 * URL: `seed` is a base36 string (case-insensitive, 1–16 chars) and `config`
 * is the compact GameConfig triple documented on {@link encodeConfig}. Both
 * are validated on parse; anything invalid is dropped, never trusted.
 */

import type { GameConfig } from '../../engine/types'
import { isGameConfig } from '../persistence'

export type RouteName = 'title' | 'play' | 'stats' | 'settings' | 'about'

export interface Route {
  name: RouteName
  /** Validated, lowercase-normalized base36 seed. Absent when missing/invalid. */
  seed?: string
  /** Validated GameConfig decoded from the URL. Absent when missing/invalid. */
  config?: GameConfig
}

const SEED_PATTERN = /^[0-9a-z]{1,16}$/

/**
 * Normalize a raw seed string (URL param, dialog input) to its canonical
 * lowercase form, or null when it isn't 1–16 base36 characters.
 */
export function normalizeSeed(raw: string): string | null {
  const trimmed = raw.trim().toLowerCase()
  return SEED_PATTERN.test(trimmed) ? trimmed : null
}

/**
 * Compact, stable GameConfig encoding for replay URLs: a
 * `runAway,potions,degradation` triple —
 *   runAway:     'once' | 'unlimited'   (GameConfig.runAwayMode)
 *   potions:     '1' | 'unlimited'      (GameConfig.potionsPerRoom)
 *   degradation: 'on' | 'off'           (GameConfig.weaponDegradation)
 * Example: 'once,1,on' is the canonical-rules default.
 *
 * {@link decodeConfig} round-trips through the persistence layer's
 * `isGameConfig` guard, so a URL can never smuggle a malformed config in.
 */
export function encodeConfig(config: GameConfig): string {
  const runAway = config.runAwayMode
  const potions = config.potionsPerRoom === 1 ? '1' : 'unlimited'
  const degradation = config.weaponDegradation ? 'on' : 'off'
  return `${runAway},${potions},${degradation}`
}

/** Inverse of {@link encodeConfig}; null on any deviation from the triple format. */
export function decodeConfig(raw: string | null): GameConfig | null {
  if (raw === null) return null
  const parts = raw.split(',')
  if (parts.length !== 3) return null
  const [runAway, potions, degradation] = parts
  const candidate: unknown = {
    runAwayMode: runAway === 'once' || runAway === 'unlimited' ? runAway : undefined,
    potionsPerRoom: potions === '1' ? 1 : potions === 'unlimited' ? 'unlimited' : undefined,
    weaponDegradation: degradation === 'on' ? true : degradation === 'off' ? false : undefined,
  }
  return isGameConfig(candidate) ? candidate : null
}

/** Parse a location hash into a validated Route. Unknown paths → title. */
export function parseHashRoute(hash: string): Route {
  const withoutHash = hash.startsWith('#') ? hash.slice(1) : hash
  const [rawPath = '', rawQuery = ''] = withoutHash.split('?')
  const path = rawPath === '' ? '/' : rawPath
  const params = new URLSearchParams(rawQuery)

  switch (path) {
    case '/':
      return { name: 'title' }
    case '/play': {
      const seed = normalizeSeed(params.get('seed') ?? '')
      const config = decodeConfig(params.get('config'))
      return {
        name: 'play',
        ...(seed !== null ? { seed } : {}),
        ...(config !== null ? { config } : {}),
      }
    }
    case '/stats':
      return { name: 'stats' }
    case '/settings':
      return { name: 'settings' }
    case '/about':
      return { name: 'about' }
    default:
      return { name: 'title' }
  }
}

/** The shareable replay URL (US40/US62): '#/play?seed=X&config=Y'. */
export function buildReplayUrl(seed: string, config: GameConfig): string {
  const params = new URLSearchParams({ seed, config: encodeConfig(config) })
  return `#/play?${params.toString()}`
}

/** Navigate to a hash route given its path ('/play', '/stats', …). */
export function navigate(path: string): void {
  window.location.hash = path
}
