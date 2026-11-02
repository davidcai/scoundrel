import { z } from 'zod';
import { DEFAULT_CONFIG, getCard, isCardId, lossScore } from '../engine';
import type { GameState, RoomState, CardId } from '../engine';
import { EMPTY_SESSION } from './session';
import type { Session } from './session';

export const SAVE_KEY = 'scoundrel:save';
export const SAVE_VERSION = 1;
const integer = z.number().int().nonnegative();
const configSchema = z.object({
  allowConsecutiveEscapes: z.boolean(),
  unlimitedPotions: z.boolean(),
  weaponDegradation: z.boolean(),
});
const seedSchema = z.string().regex(/^[A-Za-z0-9_-]{1,32}$/);
const cardSchema = z.custom<CardId>(isCardId);
const highlightsSchema = z.object({
  roomsExplored: integer,
  roomsCleared: integer,
  monstersDefeated: integer,
  potionsWasted: integer,
});
const boardSchema = z
  .object({
    health: z.number().int().min(-13).max(20),
    dungeon: z.array(cardSchema),
    room: z.array(cardSchema).max(4),
    carriedCard: cardSchema.nullable(),
    weapon: cardSchema.nullable(),
    kills: z.array(cardSchema),
    discard: z.array(cardSchema),
    potionsUsed: integer.max(4),
    resolved: integer.max(4),
    previousRoomEscaped: z.boolean(),
    highlights: highlightsSchema,
  })
  .refine(validBoard);
function validBoard(b: RoomState) {
  const zones = [
    ...b.dungeon,
    ...b.room,
    ...b.kills,
    ...b.discard,
    ...(b.weapon ? [b.weapon] : []),
  ];
  return (
    zones.length === 44 &&
    new Set(zones).size === 44 &&
    zones.every(isCardId) &&
    (!b.weapon || getCard(b.weapon).kind === 'weapon') &&
    (b.weapon !== null || b.kills.length === 0) &&
    b.kills.every((id) => getCard(id).kind === 'monster') &&
    (b.carriedCard === null || b.room.includes(b.carriedCard)) &&
    b.potionsUsed <= b.resolved &&
    b.highlights.roomsExplored >= 1 &&
    b.highlights.roomsCleared <= b.highlights.roomsExplored
  );
}
const base = { seed: seedSchema, config: configSchema, board: boardSchema };
const gameSchema: z.ZodType<GameState> = z
  .discriminatedUnion('status', [
    z.object({ ...base, status: z.literal('playing'), roomStart: boardSchema }),
    z.object({
      ...base,
      status: z.literal('won'),
      score: integer.max(20),
      reason: z.literal('cleared'),
    }),
    z.object({
      ...base,
      status: z.literal('lost'),
      score: z.number().int().max(0),
      reason: z.enum(['death', 'abandoned']),
    }),
  ])
  .refine((game) => {
    const b = game.board;
    if (game.status === 'playing') {
      const start = game.roomStart;
      return (
        b.health > 0 &&
        b.room.length > 0 &&
        start.health > 0 &&
        start.resolved === 0 &&
        start.potionsUsed === 0 &&
        b.resolved === start.room.length - b.room.length &&
        start.highlights.roomsExplored === b.highlights.roomsExplored &&
        start.previousRoomEscaped === b.previousRoomEscaped &&
        JSON.stringify(start.dungeon) === JSON.stringify(b.dungeon) &&
        (b.dungeon.length === 0 || (b.room.length + b.resolved === 4 && b.resolved <= 3))
      );
    }
    if (game.status === 'won')
      return (
        b.health > 0 && b.room.length === 0 && b.dungeon.length === 0 && game.score === b.health
      );
    return (
      game.score === lossScore(b.dungeon) &&
      (game.reason === 'death' ? b.health <= 0 : b.health > 0)
    );
  });
const statisticsSchema = z
  .object({
    gamesPlayed: integer,
    wins: integer,
    losses: integer,
    bestScore: z.number().int().nullable(),
    currentStreak: integer,
    bestStreak: integer,
  })
  .refine(
    (s) =>
      s.gamesPlayed === s.wins + s.losses &&
      s.currentStreak <= s.bestStreak &&
      s.bestStreak <= s.wins &&
      (s.gamesPlayed === 0 ? s.bestScore === null : s.bestScore !== null),
  );
const recordSchema = z
  .object({
    id: integer.positive(),
    seed: seedSchema,
    config: configSchema,
    outcome: z.enum(['won', 'lost']),
    reason: z.enum(['cleared', 'death', 'abandoned']),
    score: z.number().int(),
    date: integer.max(8640000000000000),
    highlights: highlightsSchema,
  })
  .refine((r) =>
    r.outcome === 'won'
      ? r.reason === 'cleared' && r.score > 0 && r.score <= 20
      : r.reason !== 'cleared' && r.score <= 0,
  );
const sessionSchema: z.ZodType<Session> = z
  .object({
    game: gameSchema.nullable(),
    screen: z.enum(['title', 'play', 'stats']),
    selected: z.null(),
    result: z.null(),
    runNumber: integer,
    statistics: statisticsSchema,
    history: z.array(recordSchema).max(50),
  })
  .refine((s) => {
    const ids = s.history.map((r) => r.id);
    return (
      new Set(ids).size === ids.length &&
      ids.every((id, i) => id <= s.runNumber && (i === 0 || id < ids[i - 1])) &&
      s.statistics.gamesPlayed >= s.history.length &&
      s.statistics.gamesPlayed === s.runNumber - (s.game?.status === 'playing' ? 1 : 0) &&
      (s.game === null || s.runNumber > 0) &&
      (s.game?.status === 'playing' || s.game === null || s.history[0]?.id === s.runNumber)
    );
  })
  .transform((s) => ({ ...s, history: s.history.slice(0, 30) }));
export const preferencesSchema = z.object({
  language: z.enum(['auto', 'en', 'zh']),
  reducedMotion: z.boolean(),
  config: configSchema,
});
export type Preferences = z.infer<typeof preferencesSchema>;
export const saveDataSchema = z.object({ session: sessionSchema, preferences: preferencesSchema });
export type SaveData = z.infer<typeof saveDataSchema>;
export function emptySave(): SaveData {
  return {
    session: EMPTY_SESSION,
    preferences: { language: 'auto', reducedMotion: false, config: { ...DEFAULT_CONFIG } },
  };
}
export class UnsupportedSave extends Error {}
export class SaveConflict extends Error {}
export type Migrations = Readonly<Record<number, (data: unknown) => unknown>>;
export function migrateEnvelope(
  raw: string,
  target = SAVE_VERSION,
  migrations: Migrations = {},
): unknown {
  const envelope = z
    .object({ version: integer.positive(), data: z.unknown() })
    .parse(JSON.parse(raw));
  if (envelope.version > target) throw new UnsupportedSave('Unsupported save version');
  let data = envelope.data;
  for (let version = envelope.version; version < target; version++) {
    const step = migrations[version];
    if (!step) throw new UnsupportedSave('Missing save migration');
    data = step(data);
  }
  return data;
}
export function decodeSave(raw: string): SaveData {
  return saveDataSchema.parse(migrateEnvelope(raw));
}
export function encodeSave(data: SaveData): string {
  return JSON.stringify({
    version: SAVE_VERSION,
    data: { ...data, session: { ...resumeSession(data.session), selected: null, result: null } },
  });
}
export function resumeSession(session: Session): Session {
  return {
    ...session,
    screen:
      session.game && session.game.status !== 'playing' && session.screen === 'play'
        ? 'play'
        : 'title',
    selected: null,
    result: null,
  };
}
export function sameRun(
  game: GameState | null,
  seed: string,
  config: SaveData['preferences']['config'],
) {
  return (
    game?.seed === seed &&
    game.config.allowConsecutiveEscapes === config.allowConsecutiveEscapes &&
    game.config.unlimitedPotions === config.unlimitedPotions &&
    game.config.weaponDegradation === config.weaponDegradation
  );
}
