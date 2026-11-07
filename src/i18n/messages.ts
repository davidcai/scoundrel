/**
 * Message composition for cards, previews, status lines, and announcements.
 *
 * These helpers are the only place that turns rules-engine data into display
 * strings. Components call them with a typed translator; the engine itself
 * never returns display text.
 */
import {
  MAX_HEALTH,
  cardKind,
  cardRank,
  cardSuit,
  cardValue,
  ruleOptions,
  type CardId,
  type CardKind,
  type GameEvent,
  type MonsterPreview,
  type RejectionReason,
  type RuleOptionName,
  type RuleConfig,
} from '../engine';
import { LOCALE_TAGS, formatList, type Locale, type MessageKey, type Translate } from './index';

export const REJECTION_KEYS: Readonly<Record<RejectionReason, MessageKey>> = {
  'run-over': 'rejection.run-over',
  'card-not-in-room': 'rejection.card-not-in-room',
  'card-not-resolvable': 'rejection.card-not-resolvable',
  'not-a-monster': 'rejection.not-a-monster',
  'attack-mode-required': 'rejection.attack-mode-required',
  'no-weapon': 'rejection.no-weapon',
  'weapon-ineligible': 'rejection.weapon-ineligible',
  'escape-final-room': 'rejection.escape-final-room',
  'escape-after-resolution': 'rejection.escape-after-resolution',
  'escape-consecutive-blocked': 'rejection.escape-consecutive-blocked',
  'room-not-cleared': 'rejection.room-not-cleared',
  'undo-unavailable': 'rejection.undo-unavailable',
};

const TYPE_KEYS: Readonly<Record<CardKind, MessageKey>> = {
  monster: 'card.type.monster',
  weapon: 'card.type.weapon',
  potion: 'card.type.potion',
};

export const RULE_LABEL_KEYS: Readonly<Record<RuleOptionName, MessageKey>> = {
  consecutiveEscapesAllowed: 'rule.consecutiveEscapesAllowed',
  unlimitedPotions: 'rule.unlimitedPotions',
  degradationOff: 'rule.degradationOff',
};

export const RULE_HINT_KEYS: Readonly<Record<RuleOptionName, MessageKey>> = {
  consecutiveEscapesAllowed: 'rule.consecutiveEscapesAllowedHint',
  unlimitedPotions: 'rule.unlimitedPotionsHint',
  degradationOff: 'rule.degradationOffHint',
};

export const RULE_OPTION_ORDER: readonly RuleOptionName[] = [
  'consecutiveEscapesAllowed',
  'unlimitedPotions',
  'degradationOff',
];

export function rejectionText(t: Translate, reason: RejectionReason): string {
  return t(REJECTION_KEYS[reason]);
}

export function formatCardName(t: Translate, card: CardId): string {
  return t('card.name', {
    rank: t(`card.rank.${cardRank(card)}` as MessageKey),
    suit: t(`card.suit.${cardSuit(card)}` as MessageKey),
  });
}

/** Capitalized card type shown in captions and narrow-screen metadata rows. */
export function formatCardType(t: Translate, kind: CardKind): string {
  return t(TYPE_KEYS[kind]);
}

export function formatCardNameByValue(t: Translate, card: CardId): string {
  return `${formatCardName(t, card)} (${cardValue(card)})`;
}

/** Visible caption: capitalized card type plus state fragments, e.g. "Monster · Selected". */
export function formatCardCaption(
  t: Translate,
  parts: {
    readonly kind: CardKind;
    readonly selected?: boolean;
    readonly carried?: boolean;
    readonly reason?: RejectionReason | null;
  },
): string {
  const pieces: string[] = [formatCardType(t, parts.kind)];
  if (parts.carried === true) pieces.push(t('card.state.carried'));
  if (parts.selected === true) pieces.push(t('card.state.selected'));
  if (parts.reason != null) {
    pieces.push(t('card.state.notUsable', { reason: rejectionText(t, parts.reason) }));
  }
  return pieces.join(t('card.captionSeparator'));
}

/**
 * Accessible name: starts with the visible caption verbatim (WCAG 2.5.3 Label
 * in Name), then the card identity.
 */
export function formatCardAccessibleName(
  t: Translate,
  parts: {
    readonly card: CardId;
    readonly kind: CardKind;
    readonly selected?: boolean;
    readonly carried?: boolean;
    readonly reason?: RejectionReason | null;
  },
): string {
  return t('a11y.cardLabel', {
    caption: formatCardCaption(t, parts),
    cardName: formatCardName(t, parts.card),
  });
}

export function formatPreviewTitle(t: Translate, card: CardId): string {
  const cardName = formatCardName(t, card);
  switch (cardKind(card)) {
    case 'monster':
      return t('preview.monsterTitle', { cardName, value: cardValue(card) });
    case 'weapon':
      return t('preview.weaponTitle', { cardName, value: cardValue(card) });
    case 'potion':
      return t('preview.potionTitle', { cardName });
  }
}

/** Both monster choices and the weapon restriction, as one announcement. */
export function describeMonsterPreview(
  t: Translate,
  preview: MonsterPreview,
  weaponValue: number | null,
): string {
  const parts: string[] = [
    t('preview.barehanded', {
      damage: preview.barehanded.damage,
      before: preview.barehanded.healthAfter + preview.barehanded.damage,
      after: preview.barehanded.healthAfter,
    }),
  ];
  if (preview.weapon !== null) {
    if (preview.weapon.eligible) {
      parts.push(
        t('preview.weaponAttack', {
          weaponValue: weaponValue ?? 0,
          damage: preview.weapon.damage,
          before: preview.weapon.healthAfter + preview.weapon.damage,
          after: preview.weapon.healthAfter,
        }),
      );
    } else {
      parts.push(
        t('preview.weaponIneligible', {
          weaponValue: weaponValue ?? 0,
          limit: preview.weapon.limit ?? 0,
        }),
      );
    }
  }
  return parts.join(' ');
}

/** Status-line and announcement text for a resolved action. */
export function describeEvent(t: Translate, event: GameEvent): string {
  switch (event.type) {
    case 'cardResolved': {
      const cardName = formatCardName(t, event.card);
      let text: string;
      if (event.cardKind === 'monster') {
        text =
          event.attack === 'weapon'
            ? t('status.resolvedWeapon', {
                weaponValue: event.weapon?.value ?? 0,
                cardName,
                damage: event.damage,
                health: event.healthAfter,
              })
            : t('status.resolvedBarehanded', {
                cardName,
                damage: event.damage,
                health: event.healthAfter,
              });
      } else if (event.cardKind === 'weapon') {
        text =
          event.weaponReplaced !== null
            ? t('status.weaponReplaced', {
                value: cardValue(event.card),
                oldValue: cardValue(event.weaponReplaced),
                kills: event.weaponReplacedKills.length,
              })
            : t('status.weaponEquipped', { value: cardValue(event.card) });
      } else {
        text = event.potionWasted
          ? t('status.potionWasted', { health: event.healthAfter })
          : t('status.resolvedPotion', { healing: event.healing, health: event.healthAfter });
      }
      if (event.roomCleared) text = `${text} ${t('status.roomCleared')}`;
      if (event.runOutcome === 'won') text = `${text} ${t('status.runWon')}`;
      if (event.runOutcome === 'lost') text = `${text} ${t('status.runLost')}`;
      return text;
    }
    case 'runAway':
      return t('status.escaped', { count: event.returnedCards.length });
    case 'enterNextRoom':
      return t('status.enteredRoom');
    case 'undoRoom':
      return t('status.undone');
  }
}

/**
 * Announcement for a selected card before it is resolved. Uses the same message
 * keys as the visible preview panel, so assistive text and visible text agree.
 */
export function describeCardPreview(
  t: Translate,
  preview:
    | { readonly kind: 'monster'; readonly preview: MonsterPreview }
    | { readonly kind: 'action'; readonly event: GameEvent },
  context: { readonly health: number; readonly weaponValue: number | null },
): string {
  if (preview.kind === 'monster') {
    return describeMonsterPreview(t, preview.preview, context.weaponValue);
  }
  const event = preview.event;
  if (event.type !== 'cardResolved') return describeEvent(t, event);
  switch (event.cardKind) {
    case 'weapon':
      return event.weaponReplaced !== null
        ? t('preview.weaponReplace', {
            oldValue: cardValue(event.weaponReplaced),
            kills: event.weaponReplacedKills.length,
          })
        : t('preview.weaponEquip');
    case 'potion':
      if (!event.potionWasted) return t('preview.potionHeal', { healing: event.healing });
      return context.health >= MAX_HEALTH
        ? t('preview.potionWastedFull')
        : t('preview.potionWastedUsed');
    default:
      return describeEvent(t, event);
  }
}

/** Human description of the selected house rules for the result screen. */
export function formatRulesDescription(t: Translate, locale: Locale, config: RuleConfig): string {
  const enabled = ruleOptions(config);
  const labels = RULE_OPTION_ORDER.filter((option) => enabled[option]).map((option) =>
    t(RULE_LABEL_KEYS[option]),
  );
  if (labels.length === 0) return t('result.defaultRules');
  return t('result.enabledRules', { rules: formatList(locale, labels) });
}

/** Room label shared by the header and the play-screen heading. */
export function formatRoomLabel(t: Translate, roomsExplored: number, finalRoom: boolean): string {
  return finalRoom ? t('play.finalRoom') : t('play.roomNumber', { number: roomsExplored });
}

/** Health bar text used for the visible label and the accessible value. */
export function formatHealth(t: Translate, health: number): string {
  return t('a11y.healthBar', { health, max: MAX_HEALTH });
}

/** Reasons a saved-run start can fail; mapped to player-facing explanations. */
export type StartFailureReason =
  | 'invalid-seed'
  | 'invalid-config'
  | 'invalid-link'
  | 'history-run-missing'
  | 'seed-unavailable'
  | 'write-failed'
  | 'discard-failed';

export function startFailureText(t: Translate, reason: StartFailureReason): string {
  switch (reason) {
    case 'invalid-seed':
      return t('error.invalidSeed');
    case 'invalid-config':
      return t('error.invalidConfig');
    case 'invalid-link':
      return t('error.invalidLink');
    case 'history-run-missing':
      return t('error.historyRunMissing');
    case 'seed-unavailable':
      return t('error.seedUnavailable');
    case 'write-failed':
      return t('error.writeFailed');
    case 'discard-failed':
      return t('error.discardFailed');
  }
}

/** Reasons an in-progress save can fail; mapped to player-facing explanations. */
export type SaveFailureReason =
  'invalid-state' | 'run-replaced' | 'run-completed' | 'state-mismatch';

export function saveFailureText(t: Translate, reason: SaveFailureReason): string {
  switch (reason) {
    case 'run-replaced':
      return t('error.runReplaced');
    case 'run-completed':
      return t('error.runCompleted');
    case 'state-mismatch':
      return t('error.stateMismatch');
    case 'invalid-state':
      return t('error.saveFailed');
  }
}

/** History outcome label, distinguishing abandoned runs from played losses. */
export function historyOutcomeText(
  t: Translate,
  outcome: 'won' | 'lost',
  abandoned: boolean,
): string {
  if (abandoned) return t('stats.outcomeAbandoned');
  return outcome === 'won' ? t('stats.outcomeWon') : t('stats.outcomeLost');
}

/** Win-rate value: an em dash before the first completed run (REQ-013). */
export function formatWinRate(t: Translate, percent: number | null): string {
  return percent === null ? t('stats.none') : t('stats.winRateValue', { percent });
}

/** History timestamps are stored as UTC ISO strings and shown in local time. */
export function formatHistoryDate(locale: Locale, isoTimestamp: string): string {
  const date = new Date(isoTimestamp);
  if (Number.isNaN(date.getTime())) return isoTimestamp;
  try {
    return new Intl.DateTimeFormat(LOCALE_TAGS[locale], {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(date);
  } catch {
    return isoTimestamp;
  }
}
