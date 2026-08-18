/**
 * About screen (Q43a): condensed rules, credits, and links to the original
 * PDF and the repo. Plain, grounded copy — no marketing.
 */
import { navigate } from '../router/useHashRoute';
import './FormScreens.css';

export function AboutScreen() {
  return (
    <main className="form-screen">
      <h1 className="form-screen-title">About</h1>

      <section className="about-section" aria-labelledby="about-rules">
        <h2 id="about-rules">The rules, briefly</h2>
        <ul>
          <li>The dungeon is a 44-card deck: no jokers, no red face cards, no red aces.</li>
          <li>
            Each room deals 4 cards face up. Resolve 3 of them in any order; the 4th carries into
            the next room.
          </li>
          <li>
            Clubs and spades are monsters. Fight barehanded and take the card's full value as damage
            (Jacks 11, Queens 12, Kings 13, Aces 14).
          </li>
          <li>
            Diamonds are weapons. Fighting with a weapon, you take monster minus weapon in damage —
            but a weapon only damages monsters weaker than the last one it killed.
          </li>
          <li>
            Hearts are potions: heal the card's value, up to 20 HP. Only one potion heals per room.
          </li>
          <li>
            Once per turn you may run away: the room goes to the bottom of the deck and a new room
            is dealt. You can't run from two rooms in a row.
          </li>
          <li>
            Clear the deck and your remaining HP is your score. Drop to 0 HP and your score is
            negative — zero minus the monsters left unbeaten.
          </li>
        </ul>
      </section>

      <section className="about-section" aria-labelledby="about-credits">
        <h2 id="about-credits">Credits</h2>
        <p>
          Scoundrel is a solitaire card game by Zach Gage and Kurt Bieg (2011). This is an
          unofficial fan implementation for the browser.
        </p>
        <p>
          <a href="http://stfj.net/art/2011/Scoundrel.pdf" target="_blank" rel="noreferrer">
            Original rules (PDF, stfj.net)
          </a>
        </p>
        <p>
          <a href="https://github.com/davidcai/scoundrel" target="_blank" rel="noreferrer">
            Source code on GitHub
          </a>
        </p>
      </section>

      <button type="button" className="btn btn--ghost" onClick={() => navigate('#/')}>
        Back to title
      </button>
    </main>
  );
}
