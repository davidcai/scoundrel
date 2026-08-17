/**
 * Engine barrel + function contract. Implementation lands from the
 * engine-dev lane; until then these stubs throw so accidental use fails
 * loudly. Signatures here ARE the contract — see ./types.ts for shapes.
 */
import type {
  CardId,
  CardKind,
  GameConfig,
  GameState,
  Action,
  Result,
  RunAwayBlockReason,
  Suit,
} from './types'

export * from './types'
export { CARD_IDS } from './cards'

const notImplemented = (name: string): never => {
  throw new Error(`engine '${name}' is not implemented yet (lane: engine-dev)`)
}

/** Creates the initial run state: shuffles the 44-card dungeon via mulberry32(seed). */
export const createInitialState: (seed: string, config: GameConfig) => GameState = () =>
  notImplemented('createInitialState')

/** Pure reducer: (state, action) -> { state, result } (Q21b/Q25b). */
export const reduce: (
  state: GameState,
  action: Action,
) => { state: GameState; result: Result } = () => notImplemented('reduce')

/** Q53a + run-away restriction gate; drives the greyed-out Run button. */
export const canRunAway: (state: GameState) => {
  allowed: boolean
  reason?: RunAwayBlockReason
} = () => notImplemented('canRunAway')

/** Q17d: engine-computed damage preview so the UI never re-implements combat math. */
export const previewFightMonster: (
  state: GameState,
  cardId: CardId,
  barehanded: boolean,
) => { legal: boolean; damage: number; reason?: string } = () =>
  notImplemented('previewFightMonster')

/** Rules.md values: J=11, Q=12, K=13, A=14. */
export const numericValue: (card: CardId) => number = () => notImplemented('numericValue')
export const suitOf: (card: CardId) => Suit = () => notImplemented('suitOf')
export const kindOf: (card: CardId) => CardKind = () => notImplemented('kindOf')

/** Canonical rules config from docs/rules.md. */
export const DEFAULT_CONFIG: GameConfig = {
  runAwayMode: 'once',
  potionsPerRoom: 1,
  weaponDegradation: true,
}
