import { ErrorBoundary } from "./components/ErrorBoundary";
import { GameOverOverlay } from "./components/GameOverOverlay";
import { Hud } from "./components/Hud";
import { LogDrawer } from "./components/LogDrawer";
import { Room } from "./components/Room";
import { WeaponStack } from "./components/WeaponStack";
import { useGame } from "./hooks/useGame";
import styles from "./App.module.css";

function Game() {
  const { state, stats, offersFor, runOffer, dispatch, newGame } = useGame();

  const lastEntry = state.log.at(-1);
  const heavyHit = lastEntry?.kind === "fight" && lastEntry.damage >= 8;
  const shake = heavyHit ? (state.log.length % 2 === 0 ? styles.shakeA : styles.shakeB) : "";

  return (
    <>
      <div className={`${styles.stage}${shake === "" ? "" : ` ${shake}`}`}>
        <Hud state={state} stats={stats} runOffer={runOffer} onAction={dispatch} />
        <Room state={state} offersFor={offersFor} onAction={dispatch} />
        <WeaponStack weapon={state.weapon} />
        <LogDrawer log={state.log} />
      </div>
      <GameOverOverlay state={state} onNewGame={newGame} />
    </>
  );
}

export function App() {
  return (
    <div className={styles.app}>
      <ErrorBoundary
        fallback={(error, reset) => (
          <div className={styles.crash} role="alert">
            <h2>The dungeon collapsed</h2>
            <p>{error.message}</p>
            <p>Reload to resume, or start a new run.</p>
            <button onClick={reset}>Try again</button>
          </div>
        )}
      >
        <Game />
      </ErrorBoundary>
    </div>
  );
}
