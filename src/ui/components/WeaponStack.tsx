import { weaponThreshold, type Weapon } from "../../engine";
import { cardShort } from "../format";
import styles from "./WeaponStack.module.css";

export function WeaponStack({ weapon }: { weapon: Weapon | null }) {
  if (weapon === null) {
    return (
      <section className={styles.stack} aria-label="Equipped weapon">
        <span className={styles.label}>Weapon</span>
        <span className={styles.empty}>No weapon</span>
      </section>
    );
  }

  const threshold = weaponThreshold(weapon);
  const newestFirst = [...weapon.kills].reverse();

  return (
    <section className={styles.stack} aria-label="Equipped weapon">
      <span className={styles.label}>Weapon</span>
      <span className={`${styles.mini} ${styles.red}`}>{cardShort(weapon.card)}</span>
      {newestFirst.length > 0 && (
        <span className={styles.fan}>
          {newestFirst.map((kill) => (
            <span key={kill.id} className={styles.mini} data-testid="kill">
              {cardShort(kill)}
            </span>
          ))}
        </span>
      )}
      <span className={styles.threshold}>
        {threshold === null ? "kills anything" : <>kills below <b>{threshold}</b></>}
      </span>
    </section>
  );
}
