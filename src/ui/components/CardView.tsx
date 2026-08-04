import { roleOf, type Action, type Card, type GameState, type Offer } from "../../engine";
import { cardName, offerLabel, offerNote, offerReason, rankLabel, suitSymbol } from "../format";
import styles from "./CardView.module.css";

export type CardViewProps = {
  card: Card;
  offers: readonly Offer[];
  state: GameState;
  onAction: (action: Action) => void;
  exiting?: boolean;
  dealIndex?: number;
};

export function CardView({ card, offers, state, onAction, exiting = false, dealIndex = 0 }: CardViewProps) {
  const role = roleOf(card);
  const isRed = card.suit === "hearts" || card.suit === "diamonds";

  return (
    <div
      role="group"
      aria-label={cardName(card)}
      className={`${styles.slot}${exiting ? ` ${styles.exiting}` : ""}`}
    >
      <div
        className={`${styles.card}${isRed ? ` ${styles.red}` : ""}`}
        style={{ ["--deal-index" as string]: String(dealIndex) }}
      >
        <span className={styles.rank}>{rankLabel(card.rank)}</span>
        <span className={styles.suit}>{suitSymbol(card.suit)}</span>
        <span className={styles.role}>{role}</span>
      </div>

      {offers.map((offer) => {
        const barehanded = offer.action.type === "FIGHT" && !offer.action.useWeapon;
        const reason = offerReason(offer, state);
        const note = offerNote(offer);
        return (
          <div key={offerKey(offer)} className={styles.offerGroup}>
            <button
              type="button"
              data-testid="offer"
              className={`${styles.offer}${barehanded ? ` ${styles.bare}` : ""}`}
              disabled={!offer.enabled}
              onClick={() => onAction(offer.action)}
            >
              {offerLabel(offer, state)}
            </button>
            {reason !== null && <span className={styles.reason}>{reason}</span>}
            {note !== null && <span className={styles.note}>{note}</span>}
          </div>
        );
      })}
    </div>
  );
}

function offerKey(offer: Offer): string {
  return offer.action.type === "FIGHT"
    ? `FIGHT-${offer.action.useWeapon ? "weapon" : "bare"}`
    : offer.action.type;
}
