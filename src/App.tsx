import clubEight from '../assets/club-8.png';

/**
 * Minimal Phase 1 scaffold: proves the approved warm palette, display serif,
 * and current PNG artwork load in a React screen. Game screens arrive later.
 */
export default function App() {
  return (
    <div className="app">
      <header className="masthead">
        <h1 className="wordmark">Scoundrel</h1>
        <p className="premise">
          A single-player rogue-like dungeon crawl played with a standard deck.
        </p>
      </header>

      <main className="preview">
        <section className="card-demo" aria-labelledby="card-demo-title">
          <h2 id="card-demo-title" className="card-demo-title">
            Current artwork preview
          </h2>
          <figure className="card-figure">
            <div className="card-frame">
              <div className="card-mat">
                <img className="card-art" src={clubEight} alt="Eight of clubs" />
              </div>
            </div>
            <figcaption className="card-caption">Card 1 of 1 · Eight of clubs</figcaption>
          </figure>
          <p className="card-note">
            Phase 1 foundation · approved warm palette · current PNG artwork only
          </p>
        </section>
      </main>
    </div>
  );
}
