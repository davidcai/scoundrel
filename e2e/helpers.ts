/**
 * Shared e2e fixtures + helpers (Playwright seam 3, docs/spec.md "Testing Decisions").
 *
 * Determinism hooks pinned against the engine (mulberry32 / Fisher-Yates):
 * - seed 'w10' deals room 1 = [8C, 7S, 2S, 3D]; fighting 2S with a 3D weapon
 *   deals 0, after which the degradation gate blocks the weapon against 7S.
 * - seed '0' deals room 1 = [2D, 9H, 6C, 3D] (weapon + potion + monster).
 * - seed 'a' deals room 1 = [5S, 8S, QS, 7H]; barehanding QS then 8S is a
 *   two-click loss scoring exactly -183 (roomsCleared 1).
 *
 * localStorage reads go through context.storageState() and writes through a
 * one-shot string-form init script, because the e2e tsconfig project has no
 * DOM lib — string form keeps page-context code out of the type checker.
 */
import { expect } from '@playwright/test'
import type { BrowserContext, Page } from '@playwright/test'

/** Dev-server origin the playwright.config webServer boots. */
const ORIGIN = 'http://localhost:4173'

/** Suit letter → [suit name, meaning] per the 44-card Scoundrel deck. */
const SUIT_INFO: Record<string, { suit: string; meaning: string }> = {
  C: { suit: 'Clubs', meaning: 'monster' },
  S: { suit: 'Spades', meaning: 'monster' },
  D: { suit: 'Diamonds', meaning: 'weapon' },
  H: { suit: 'Hearts', meaning: 'potion' },
}

const RANK_VALUES: Record<string, number> = {
  '2': 2,
  '3': 3,
  '4': 4,
  '5': 5,
  '6': 6,
  '7': 7,
  '8': 8,
  '9': 9,
  '10': 10,
  J: 11,
  Q: 12,
  K: 13,
  A: 14,
}

/** CardId ('10D') → the card button's accessible name ("10 of Diamonds, weapon, value 10"). */
export function cardLabel(cardId: string): string {
  const suitLetter = cardId.slice(-1)
  const rank = cardId.slice(0, -1)
  const suit = SUIT_INFO[suitLetter]
  const value = RANK_VALUES[rank]
  if (suit === undefined || value === undefined) throw new Error(`bad card id: ${cardId}`)
  return `${rank} of ${suit.suit}, ${suit.meaning}, value ${String(value)}`
}

/** Title → Enter Seed → submit → the seeded room is on screen. */
export async function startSeededRun(page: Page, seed: string): Promise<void> {
  await page.goto('/#/')
  await page.getByRole('button', { name: 'Enter Seed' }).click()
  await page.getByLabel('Dungeon seed').fill(seed)
  await page.getByRole('button', { name: 'Descend' }).click()
  await expect(page.getByRole('group', { name: 'Room cards' })).toBeVisible()
}

/** Click a room card, then click one of the confirm-strip actions by name. */
export async function resolveCard(page: Page, cardId: string, actionName: string): Promise<void> {
  await page.getByRole('button', { name: cardLabel(cardId), exact: true }).click()
  await page.getByRole('button', { name: actionName }).click()
}

/** Raw localStorage entry for the dev origin, or null. */
export async function readLocalStorage(
  context: BrowserContext,
  key: string,
): Promise<string | null> {
  const state = await context.storageState()
  const origin = state.origins.find((entry) => entry.origin === ORIGIN)
  return origin?.localStorage.find((entry) => entry.name === key)?.value ?? null
}

/** Unwrap a `{version, data}` localStorage shard. Returns null when absent. */
function readShard(raw: string | null): unknown {
  if (raw === null) return null
  const wrapper: unknown = JSON.parse(raw)
  if (typeof wrapper !== 'object' || wrapper === null || !('data' in wrapper)) return null
  return wrapper.data
}

/** Views of the persisted shards (mirror src/ui/persistence/types.ts). */
export interface StatsShardView {
  gamesPlayed: number
  wins: number
  losses: number
  runs: { seed: string; outcome: 'won' | 'lost'; score: number; roomsCleared: number }[]
}

export interface RunShardView {
  seed: string
  statsWritten: boolean
  outcome: { type: 'won' | 'lost'; score: number } | null
}

export async function readStatsShard(context: BrowserContext): Promise<StatsShardView | null> {
  return readShard(await readLocalStorage(context, 'scoundrel:stats')) as StatsShardView | null
}

export async function readRunShard(context: BrowserContext): Promise<RunShardView | null> {
  return readShard(await readLocalStorage(context, 'scoundrel:run')) as RunShardView | null
}

/**
 * Inject a finished run (terminal RunData) via an init script that stamps the
 * shard only on the FIRST load — later reloads see the app's own persisted
 * shard, so the idempotent-stats invariant gets a real workout.
 */
export async function injectTerminalRunOnce(page: Page, runData: unknown): Promise<void> {
  const payload = JSON.stringify(JSON.stringify({ version: 1, data: runData }))
  await page.addInitScript(
    [
      "if (!window.localStorage.getItem('e2e:inject-once')) {",
      "  window.localStorage.setItem('e2e:inject-once', '1');",
      `  window.localStorage.setItem('scoundrel:run', ${payload});`,
      '}',
    ].join('\n'),
  )
}

/** A won seed-'w10' run in the exact RunData shape the app persists. */
export function terminalWinRunData(): unknown {
  const config = { runAwayMode: 'once', potionsPerRoom: 1, weaponDegradation: true }
  return {
    state: {
      seed: 'w10',
      config,
      phase: 'won',
      hp: 17,
      maxHp: 20,
      dungeon: [],
      room: [],
      resolvedCount: 0,
      weapon: '10D',
      killStack: ['KS'],
      potionsUsedThisRoom: 0,
      ranAwayLastRoom: false,
      turnCount: 41,
      runHighlights: { monstersKilled: 26, potionsWasted: 2, roomsExplored: 13 },
      startedAt: 1_700_000_000_000,
      roomSnapshot: null,
    },
    seed: 'w10',
    config,
    startedAt: 1_700_000_000_000,
    outcome: { type: 'won', score: 17 },
    statsWritten: false,
  }
}
