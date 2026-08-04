import { finalScore, type GameState } from "../../engine";
import { outcomeHeadline } from "../format";
import styles from "./GameOverOverlay.module.css";

export function GameOverOverlay({
  state,
  onNewGame,
}: {
  state: GameState;
  onNewGame: (seed?: string) => void;
}) {
  if (state.status === "playing") return null;

  return (
    <div className={styles.scrim} role="dialog" aria-modal="true" aria-label={outcomeHeadline(state)}>
      <div className={styles.panel}>
        <h2 className={styles.headline}>{outcomeHeadline(state)}</h2>
        <p className={styles.caption}>Final score</p>
        <p className={styles.score} data-testid="score">
          {finalScore(state)}
        </p>
        <p className={styles.seed}>Seed {state.seed}</p>
        <div className={styles.actions}>
          <button type="button" className={styles.button} onClick={() => onNewGame()}>
            New game
          </button>
          <button type="button" className={styles.button} onClick={() => onNewGame(state.seed)}>
            Replay this seed
          </button>
        </div>
      </div>
    </div>
  );
}
