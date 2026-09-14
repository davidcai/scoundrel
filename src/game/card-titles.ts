import type { CardId } from '../engine';
import type { TranslationFunctions } from '../i18n/i18n-types';

/**
 * Maps each card's artwork to its title accessor on the translation object.
 * Titles are placeholder names for now — replace them in `src/i18n/en.ts`
 * and `src/i18n/zh.ts` later.
 */
const cardTitleAccessors: Record<TitledCardId, (LL: TranslationFunctions) => string> = {
  'club-2': (LL) => LL.cardTitleClub2(),
  'club-3': (LL) => LL.cardTitleClub3(),
  'club-4': (LL) => LL.cardTitleClub4(),
  'club-5': (LL) => LL.cardTitleClub5(),
  'club-6': (LL) => LL.cardTitleClub6(),
  'club-7': (LL) => LL.cardTitleClub7(),
  'club-8': (LL) => LL.cardTitleClub8(),
  'club-9': (LL) => LL.cardTitleClub9(),
  'club-10': (LL) => LL.cardTitleClub10(),
  'club-j': (LL) => LL.cardTitleClubJ(),
  'club-q': (LL) => LL.cardTitleClubQ(),
  'club-k': (LL) => LL.cardTitleClubK(),
  'club-a': (LL) => LL.cardTitleClubA(),
  'spade-2': (LL) => LL.cardTitleSpade2(),
  'spade-3': (LL) => LL.cardTitleSpade3(),
  'spade-4': (LL) => LL.cardTitleSpade4(),
  'spade-5': (LL) => LL.cardTitleSpade5(),
  'spade-6': (LL) => LL.cardTitleSpade6(),
  'spade-7': (LL) => LL.cardTitleSpade7(),
  'spade-8': (LL) => LL.cardTitleSpade8(),
  'spade-9': (LL) => LL.cardTitleSpade9(),
  'spade-10': (LL) => LL.cardTitleSpade10(),
  'spade-j': (LL) => LL.cardTitleSpadeJ(),
  'spade-q': (LL) => LL.cardTitleSpadeQ(),
  'spade-k': (LL) => LL.cardTitleSpadeK(),
  'spade-a': (LL) => LL.cardTitleSpadeA(),
  'diamond-2': (LL) => LL.cardTitleDiamond2(),
  'diamond-3': (LL) => LL.cardTitleDiamond3(),
  'diamond-4': (LL) => LL.cardTitleDiamond4(),
  'diamond-5': (LL) => LL.cardTitleDiamond5(),
  'diamond-6': (LL) => LL.cardTitleDiamond6(),
  'diamond-7': (LL) => LL.cardTitleDiamond7(),
  'diamond-8': (LL) => LL.cardTitleDiamond8(),
  'diamond-9': (LL) => LL.cardTitleDiamond9(),
  'diamond-10': (LL) => LL.cardTitleDiamond10(),
  'heart-2': (LL) => LL.cardTitleHeart2(),
  'heart-3': (LL) => LL.cardTitleHeart3(),
  'heart-4': (LL) => LL.cardTitleHeart4(),
  'heart-5': (LL) => LL.cardTitleHeart5(),
  'heart-6': (LL) => LL.cardTitleHeart6(),
  'heart-7': (LL) => LL.cardTitleHeart7(),
  'heart-8': (LL) => LL.cardTitleHeart8(),
  'heart-9': (LL) => LL.cardTitleHeart9(),
  'heart-10': (LL) => LL.cardTitleHeart10(),
};

/** Ranks that exist for every suit. */
type FullRank = '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'j' | 'q' | 'k' | 'a';
/** Diamonds and hearts have no face cards (44-card deck). */
type NumberRank = '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10';

/** The 44 cards that actually exist (and have artwork/titles). */
type TitledCardId = `${'club' | 'spade'}-${FullRank}` | `${'diamond' | 'heart'}-${NumberRank}`;

/** Localized title of a card's artwork, resolved through the translation object. */
export function cardTitleKey(cardId: CardId, LL: TranslationFunctions): string {
  return cardTitleAccessors[cardId as TitledCardId](LL);
}
