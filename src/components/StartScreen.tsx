interface Props {
  onStart: () => void;
}

const RULES: Array<[string, string]> = [
  ['Room', 'Four cards are dealt from the dungeon deck. Resolve 3 of them in any order; the 4th carries over.'],
  ['Monsters (♣ ♠)', 'Take damage equal to their value (Ace = 14).'],
  ['Weapons (♦)', 'Equip to subtract its value from a monster\u2019s damage. After a kill, it can only fight monsters weaker than its last kill.'],
  ['Potions (♥)', 'Drink to heal up to 20. Only one potion per room — extras are wasted.'],
  ['Running', 'Bury the room and deal a new one. Never twice in a row.'],
  ['Score', 'Win: your health. Lose: negative sum of the monsters left in the deck.'],
];

export default function StartScreen({ onStart }: Props) {
  return (
    <div className="start-screen">
      <h1>Scoundrel</h1>
      <p className="tagline">A solo roguelike in a single deck of cards.</p>
      <ul className="rules">
        {RULES.map(([term, desc]) => (
          <li key={term}>
            <strong>{term}.</strong> {desc}
          </li>
        ))}
      </ul>
      <button type="button" className="btn primary start-btn" onClick={onStart}>
        Enter the dungeon
      </button>
      <p className="credit">
        Based on <em>Scoundrel</em> by Zach Gage &amp; Kurt Bieg.
      </p>
    </div>
  );
}
