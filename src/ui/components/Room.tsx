import type { Action, Card, GameState, Offer } from "../../engine";
import { CardView } from "./CardView";
import styles from "./Room.module.css";

export type RoomProps = {
  state: GameState;
  offersFor: (card: Card) => readonly Offer[];
  onAction: (action: Action) => void;
};

export function Room({ state, offersFor, onAction }: RoomProps) {
  return (
    <section className={styles.room} aria-label={`Room ${state.roomNumber}`}>
      {state.room.map((card, index) => (
        <CardView
          key={card.id}
          card={card}
          offers={offersFor(card)}
          state={state}
          onAction={onAction}
          dealIndex={index}
        />
      ))}
    </section>
  );
}
