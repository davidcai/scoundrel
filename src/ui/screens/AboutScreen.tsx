import { useEffect } from 'react'
import { Card, Panel, PixelButton, SuitGlyph } from '../components'

interface AboutScreenProps {
  onBack: () => void
}

const LEGEND = [
  { cardId: 'AS', caption: 'Monster — fight or take its value in damage' },
  { cardId: '9D', caption: 'Weapon — soak damage up to its value' },
  { cardId: '10H', caption: 'Potion — heal its value, one per room' },
]

export function AboutScreen({ onBack }: AboutScreenProps) {
  // Escape anywhere on the screen returns to title.
  useEffect(() => {
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') onBack()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [onBack])

  return (
    <main className="screen about-screen" aria-labelledby="about-heading">
      <header className="screen-header">
        <PixelButton variant="ghost" onClick={onBack}>
          ← Back
        </PixelButton>
        <h1 id="about-heading">About</h1>
      </header>

      <div className="about-scroll">
        <Panel title="How to Play" shadowed>
          <ul className="rules-list">
            <li>
              A 44-card dungeon: <SuitGlyph suit="C" /> Clubs and <SuitGlyph suit="S" /> Spades are
              monsters, <SuitGlyph suit="D" /> Diamonds are weapons, <SuitGlyph suit="H" /> Hearts
              are potions. No red faces, no red aces.
            </li>
            <li>You start with 20 hit points. Nothing takes you above 20.</li>
            <li>
              Each room deals 4 cards. Resolve 3 of them in any order — the leftover card follows
              you into the next room.
            </li>
            <li>
              Monsters deal their full value barehanded. Equip a weapon to subtract its value — but
              a weapon only stays sharp against monsters weaker than the last one it killed.
            </li>
            <li>One potion per room. Extra potions are poured out.</li>
            <li>
              You may run from a room, sending all 4 cards to the dungeon's bottom — but never two
              rooms in a row.
            </li>
            <li>
              Clear every room to win; your score is your remaining HP. Fall to 0 HP and the dungeon
              scores what it still holds against you.
            </li>
          </ul>

          <div className="legend-row" aria-label="Card types">
            {LEGEND.map(({ cardId, caption }) => (
              <figure className="legend-item" key={cardId}>
                <Card cardId={cardId} />
                <figcaption className="legend-caption">{caption}</figcaption>
              </figure>
            ))}
          </div>
        </Panel>

        <Panel title="Credits" shadowed className="about-panel">
          <p>
            Scoundrel was designed by Zach Gage and Kurt Bieg in 2011, played with a standard deck
            of cards. This is an unofficial pixel-roguelike web adaptation.
          </p>
          <p className="about-links">
            <a href="http://stfj.net/art/2011/Scoundrel.pdf" target="_blank" rel="noreferrer">
              Original rule sheet (PDF)
            </a>
            <a href="https://github.com/" target="_blank" rel="noreferrer">
              Source code — repo link coming soon
            </a>
          </p>
        </Panel>

        <p className="about-hint">
          Press <b>Esc</b> to return to the title.
        </p>
      </div>
    </main>
  )
}
