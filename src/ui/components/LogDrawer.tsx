import { useState } from "react";
import type { LogEntry } from "../../engine";
import { logLine } from "../format";
import styles from "./LogDrawer.module.css";

export function LogDrawer({ log }: { log: readonly LogEntry[] }) {
  const [expanded, setExpanded] = useState(false);
  const newest = log.at(-1);
  const newestFirst = [...log].reverse();

  return (
    <section className={styles.drawer}>
      <button
        type="button"
        className={styles.bar}
        aria-expanded={expanded}
        aria-label="Run log"
        onClick={() => setExpanded((open) => !open)}
      >
        <span className={styles.newest} data-testid="log-live" aria-live="polite">
          {newest === undefined ? "" : logLine(newest)}
        </span>
        <span className={styles.toggle}>Run log {expanded ? "\u2228" : "\u2227"}</span>
      </button>

      {expanded && (
        <ul className={styles.list}>
          {newestFirst.map((entry, index) => (
            <li key={`${log.length - index}-${entry.kind}`}>{logLine(entry)}</li>
          ))}
        </ul>
      )}
    </section>
  );
}
