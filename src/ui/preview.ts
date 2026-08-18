/**
 * Damage/cost preview model for the click-to-select → preview → confirm flow
 * (Q17d). Monster combat numbers come from the ENGINE'S previewFightMonster
 * so combat math is never re-implemented in the UI; potion/equip previews are
 * arithmetically trivial and derived from GameState.
 */
import type { CardId, GameState } from '../engine';
import type { EngineApi } from '../store/engineApi';
import { kindOfId, numericValueOf, rankLabel, SUIT_GLYPH } from './cards/cardMeta';

export interface MonsterPreview {
  kind: 'monster';
  legal: boolean;
  reason: string | null;
  /** Damage with weapon (null when no weapon equipped). */
  weaponDamage: number | null;
  weaponLegal: boolean;
  weaponReason: string | null;
  barehandedDamage: number;
  /** Effective damage for the armed mode. */
  damage: number;
  barehanded: boolean;
  hasWeapon: boolean;
  headline: string;
  context: string;
}

export interface PotionPreview {
  kind: 'potion';
  heal: number;
  wasted: boolean;
  headline: string;
  context: string;
}

export interface WeaponPreview {
  kind: 'weapon';
  strength: number;
  discardsCurrent: boolean;
  headline: string;
  context: string;
}

export type Preview = MonsterPreview | PotionPreview | WeaponPreview;

function glyphRank(id: CardId): string {
  return `${SUIT_GLYPH[id.slice(0, id.indexOf('-')) as keyof typeof SUIT_GLYPH]} ${rankLabel(id)}`;
}

export function buildPreview(
  engine: EngineApi,
  state: GameState,
  cardId: CardId,
  barehanded: boolean,
): Preview {
  const kind = kindOfId(cardId);
  if (kind === 'monster') {
    const hasWeapon = state.weapon !== null;
    const weapon = hasWeapon
      ? engine.previewFightMonster(state, cardId, false)
      : { legal: false, damage: 0, reason: 'No weapon equipped' };
    const bare = engine.previewFightMonster(state, cardId, true);
    const active = barehanded ? bare : hasWeapon ? weapon : bare;
    const value = numericValueOf(cardId);
    const weaponText =
      hasWeapon && state.weapon !== null
        ? `${glyphRank(cardId)} (${value}) vs ${glyphRank(state.weapon)} (${numericValueOf(state.weapon)})`
        : `${glyphRank(cardId)} (${value})`;
    const headline = active.legal
      ? `${weaponText} → take ${active.damage}`
      : bare.legal
        ? `${weaponText} → barehanded: take ${bare.damage}`
        : `Cannot fight ${glyphRank(cardId)}`;
    return {
      kind: 'monster',
      legal: active.legal || bare.legal,
      reason: active.legal ? null : (active.reason ?? bare.reason ?? null),
      weaponDamage: hasWeapon ? weapon.damage : null,
      weaponLegal: hasWeapon ? weapon.legal : false,
      weaponReason: hasWeapon ? (weapon.reason ?? null) : null,
      barehandedDamage: bare.damage,
      damage: active.legal ? active.damage : bare.damage,
      barehanded: barehanded || !hasWeapon,
      hasWeapon,
      headline,
      context: barehanded || !hasWeapon ? 'fighting barehanded' : 'fighting with weapon',
    };
  }
  if (kind === 'potion') {
    const value = numericValueOf(cardId);
    const capHit = state.potionsUsedThisRoom >= state.config.potionsPerRoom;
    const heal = Math.min(value, state.maxHp - state.hp);
    const wasted = capHit || heal <= 0;
    const headline = capHit
      ? `${glyphRank(cardId)} (${value}) → wasted (potion cap reached)`
      : heal < value
        ? `${glyphRank(cardId)} → heal ${heal} (capped at ${state.maxHp})`
        : `${glyphRank(cardId)} → heal ${heal}`;
    return {
      kind: 'potion',
      heal: wasted ? 0 : heal,
      wasted,
      headline,
      context: 'drink potion',
    };
  }
  const strength = numericValueOf(cardId);
  const discardsCurrent = state.weapon !== null;
  const headline = `${glyphRank(cardId)} → equip weapon (strength ${strength})`;
  return {
    kind: 'weapon',
    strength,
    discardsCurrent,
    headline,
    context: discardsCurrent ? 'current weapon and its kills will be discarded' : 'equip weapon',
  };
}
