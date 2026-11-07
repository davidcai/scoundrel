import { en } from './en';
import { zh } from './zh';
import type { MessageKey } from './en';
import type { ActionResult, CardId } from '../engine';
export type Translate = (key: MessageKey, values?: Record<string, string | number>) => string;
export function translator(locale: 'en' | 'zh'): Translate {
  return (key, values = {}) =>
    (locale === 'zh' ? zh : en)[key].replace(/\{(\w+)\}/g, (match, name: string) =>
      String(values[name] ?? match),
    );
}
export function cardName(id: CardId, t: Translate): string {
  const suit = id.slice(0, id.indexOf('-')) as 'club' | 'spade' | 'diamond' | 'heart';
  return t('cardName', { rank: id.slice(id.indexOf('-') + 1).toUpperCase(), suit: t(suit) });
}
export function describeResult(result: ActionResult, t: Translate): string {
  switch (result.type) {
    case 'invalid':
      return t(result.reason);
    case 'fought':
      return t('fightFeedback', {
        card: cardName(result.cardId, t),
        damage: result.damage,
        health: result.healthAfter,
      });
    case 'equipped':
      return t('equipFeedback', {
        card: cardName(result.cardId, t),
        count: result.discarded.length,
      });
    case 'drank':
      return result.wasted
        ? t('wastedFeedback')
        : t('healFeedback', { healed: result.healed, health: result.healthAfter });
    case 'escaped':
      return t('escapedFeedback');
    case 'entered-room':
      return t('enteredFeedback');
    case 'undone':
      return t('undoFeedback');
    case 'abandoned':
      return t('abandonedFeedback');
  }
}
