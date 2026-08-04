import styles from "./App.module.css";
import { ErrorBoundary } from "./components/ErrorBoundary";

export function App() {
  return (
    <div className={styles.app}>
      <ErrorBoundary
        fallback={(error, reset) => (
          <div className={styles.crash} role="alert">
            <h2>The dungeon collapsed</h2>
            <p>{error.message}</p>
            <button onClick={reset}>Try again</button>
          </div>
        )}
      >
        <div className={styles.stage}>
          <h1>Scoundrel</h1>
        </div>
      </ErrorBoundary>
    </div>
  );
}
