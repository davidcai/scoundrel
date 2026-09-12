import { navigate } from '../router';

export function AboutScreen() {
  return (
    <main className="screen">
      <div className="panel about">
        <header className="panel-header">
          <h2>About Scoundrel</h2>
          <button type="button" className="btn ghost" onClick={() => navigate('#/')}>
            ← Title
          </button>
        </header>

        <section>
          <h3>The rules in brief</h3>
          <ul className="rules-list">
            <li>
              <strong>Monsters</strong> (♣ ♠) hit for their value. <strong>Weapons</strong> (♦)
              block damage: you take the monster's value minus the weapon's.{' '}
              <strong>Potions</strong> (♥) restore their value, capped at 20 health.
            </li>
            <li>
              Each room deals 4 cards; you must resolve 3. The 4th carries over to the next room.
            </li>
            <li>
              After a weapon kills a monster it can only fight <em>weaker</em> monsters. Picking up
              a new weapon discards the old one and its kill stack.
            </li>
            <li>Only the first potion you drink in a room heals you.</li>
            <li>
              Once per turn you may run away: all four cards sink to the bottom of the dungeon and a
              fresh room is dealt — but never twice in a row.
            </li>
            <li>
              Clear every room to win. Your score is your remaining health; die and it's zero minus
              the monsters still lurking in the deck.
            </li>
          </ul>
        </section>

        <section>
          <h3>Credits & links</h3>
          <p className="muted">
            Scoundrel was designed by Zach Gage and Kurt Bieg. This is a browser implementation of
            the original one-player roguelike.
          </p>
          <ul className="links-list">
            <li>
              <a href="http://stfj.net/art/2011/Scoundrel.pdf" target="_blank" rel="noreferrer">
                Original rule book (PDF)
              </a>
            </li>
            <li>
              <a href="https://rpdillon.net/scoundrel.html" target="_blank" rel="noreferrer">
                rpdillon.net — annotated rules
              </a>
            </li>
          </ul>
        </section>
      </div>
    </main>
  );
}
