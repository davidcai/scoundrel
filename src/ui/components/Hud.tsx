import { MAX_HEALTH, type Action, type GameState, type Offer } from "../../engine";
import type { Stats } from "../../storage/persistence";
import { offerLabel, offerReason } from "../format";
import styles from "./Hud.module.css";

export type HudProps = {
  state: GameState;
  stats: Stats;
  runOffer: Offer;
  onAction: (action: Action) => void;
};

export function Hud({ state, stats, runOffer, onAction }: HudProps) {
  const percent = (state.health / MAX_HEALTH) * 100;
  const reason = offerReason(runOffer, state);
  const damage = latestDamage(state);

  return (
    <header className={styles.hud}>
      <span className={styles.health} aria-label={`Health ${state.health} of ${MAX_HEALTH}`}>
        <span className={styles.value}>{state.health}</span>
        <span className={styles.bar}>
          <span className={styles.fill} style={{ width: `${percent}%` }} />
        </span>
        {/*
          Keyed on log length so an identical repeat still restarts the animation.
          Derived from committed state, so nothing here can gate a dispatch.
        */}
        {damage !== null && (
          <span key={state.log.length} className={styles.float} aria-hidden="true">
            -{damage}
          </span>
        )}
      </span>

      <span className={styles.stat}>Deck <b>{state.deck.length}</b></span>
      <span className={styles.stat}>Room <b>{state.roomNumber}</b></span>
      <span className={styles.stat}>Best <b>{stats.best ?? "\u2014"}</b></span>
      <span className={styles.stat}>Seed <b>{state.seed}</b></span>

      <span className={styles.runWrap}>
        <button
          type="button"
          className={styles.run}
          disabled={!runOffer.enabled}
          onClick={() => onAction(runOffer.action)}
        >
          {offerLabel(runOffer, state)}
        </button>
        {reason !== null && <span className={styles.reason}>{reason}</span>}
      </span>
    </header>
  );
}

/** Damage from the most recent action, or null if it was not a damaging fight. */
function latestDamage(state: GameState): number | null {
  const entry = state.log.at(-1);
  if (entry === undefined || entry.kind !== "fight" || entry.damage === 0) return null;
  return entry.damage;
}
