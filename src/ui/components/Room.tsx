import type { Action, Card, GameState, Offer } from "../../engine";
import { useExitTransition } from "../hooks/useExitTransition";
import { CardView } from "./CardView";
import styles from "./Room.module.css";

/** Must match --dur-exit in tokens.css. */
const EXIT_MS = 200;

export type RoomProps = {
  state: GameState;
  offersFor: (card: Card) => readonly Offer[];
  onAction: (action: Action) => void;
};

export function Room({ state, offersFor, onAction }: RoomProps) {
  const cards = useExitTransition(state.room, (card) => card.id, EXIT_MS);

  return (
    <section className={styles.room} aria-label={`Room ${state.roomNumber}`}>
      {cards.map(({ item, key, exiting }, index) => (
        <CardView
          key={key}
          card={item}
          // A departing card must not offer actions; its offers are stale.
          offers={exiting ? [] : offersFor(item)}
          state={state}
          onAction={onAction}
          exiting={exiting}
          dealIndex={index}
        />
      ))}
    </section>
  );
}
