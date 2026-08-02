"use client";

import { useEffect, useMemo, useState } from "react";

type Suit = "clubs" | "spades" | "diamonds" | "hearts";
type GameStatus = "playing" | "won" | "lost";

type Card = {
  id: string;
  suit: Suit;
  value: number;
};

type Weapon = {
  card: Card;
  lastMonster: number | null;
};

type GameState = {
  deck: Card[];
  room: Card[];
  health: number;
  weapon: Weapon | null;
  roomNumber: number;
  resolvedThisRoom: number;
  roomGoal: number;
  potionUsed: boolean;
  fledPreviousRoom: boolean;
  selectedId: string | null;
  status: GameStatus;
  score: number | null;
  log: string[];
};

const SUITS: Record<
  Suit,
  { symbol: string; label: string; kind: "Monster" | "Weapon" | "Potion" }
> = {
  clubs: { symbol: "♣", label: "Clubs", kind: "Monster" },
  spades: { symbol: "♠", label: "Spades", kind: "Monster" },
  diamonds: { symbol: "♦", label: "Diamonds", kind: "Weapon" },
  hearts: { symbol: "♥", label: "Hearts", kind: "Potion" },
};

const MAX_HEALTH = 20;
const TOTAL_CARDS = 44;

function rank(value: number) {
  if (value === 14) return "A";
  if (value === 13) return "K";
  if (value === 12) return "Q";
  if (value === 11) return "J";
  return String(value);
}

function cardName(card: Card) {
  return `${rank(card.value)} of ${SUITS[card.suit].label}`;
}

function isMonster(card: Card) {
  return card.suit === "clubs" || card.suit === "spades";
}

function buildDeck() {
  const cards: Card[] = [];

  for (const suit of ["clubs", "spades"] as const) {
    for (let value = 2; value <= 14; value += 1) {
      cards.push({ id: `${suit}-${value}`, suit, value });
    }
  }

  for (const suit of ["diamonds", "hearts"] as const) {
    for (let value = 2; value <= 10; value += 1) {
      cards.push({ id: `${suit}-${value}`, suit, value });
    }
  }

  return cards;
}

function shuffle<T>(items: T[]) {
  const shuffled = [...items];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [
      shuffled[swapIndex],
      shuffled[index],
    ];
  }
  return shuffled;
}

function createGame(): GameState {
  const cards = shuffle(buildDeck());
  const room = cards.slice(0, 4);

  return {
    deck: cards.slice(4),
    room,
    health: MAX_HEALTH,
    weapon: null,
    roomNumber: 1,
    resolvedThisRoom: 0,
    roomGoal: 3,
    potionUsed: false,
    fledPreviousRoom: false,
    selectedId: null,
    status: "playing",
    score: null,
    log: ["The first room waits in silence."],
  };
}

function addLog(state: GameState, message: string) {
  return [message, ...state.log].slice(0, 5);
}

function remainingMonsterScore(deck: Card[]) {
  return -deck.filter(isMonster).reduce((sum, card) => sum + card.value, 0);
}

function completeCard(
  state: GameState,
  card: Card,
  message: string,
): GameState {
  const room = state.room.filter((candidate) => candidate.id !== card.id);
  const resolvedThisRoom = state.resolvedThisRoom + 1;
  const log = addLog(state, message);

  if (state.health <= 0) {
    return {
      ...state,
      room,
      resolvedThisRoom,
      selectedId: null,
      status: "lost",
      score: remainingMonsterScore(state.deck),
      log,
    };
  }

  if (resolvedThisRoom < state.roomGoal) {
    return {
      ...state,
      room,
      resolvedThisRoom,
      selectedId: null,
      log,
    };
  }

  if (room.length === 0 && state.deck.length === 0) {
    return {
      ...state,
      room,
      resolvedThisRoom,
      selectedId: null,
      status: "won",
      score: state.health,
      log: addLog({ ...state, log }, "The dungeon is clear. You survived."),
    };
  }

  const drawCount = Math.min(3, state.deck.length);
  const nextRoom = [...room, ...state.deck.slice(0, drawCount)];
  const nextDeck = state.deck.slice(drawCount);

  if (nextRoom.length === 0) {
    return {
      ...state,
      deck: nextDeck,
      room: nextRoom,
      resolvedThisRoom: 0,
      selectedId: null,
      status: "won",
      score: state.health,
      log: addLog({ ...state, log }, "The dungeon is clear. You survived."),
    };
  }

  return {
    ...state,
    deck: nextDeck,
    room: nextRoom,
    roomNumber: state.roomNumber + 1,
    resolvedThisRoom: 0,
    roomGoal: nextRoom.length === 4 ? 3 : nextRoom.length,
    potionUsed: false,
    fledPreviousRoom: false,
    selectedId: null,
    log: addLog(
      { ...state, log },
      nextRoom.length === 4
        ? "A new room is dealt. One card followed you in."
        : "The last cards of the dungeon are revealed.",
    ),
  };
}

function PlayingCard({
  card,
  selected = false,
  compact = false,
  onClick,
}: {
  card: Card;
  selected?: boolean;
  compact?: boolean;
  onClick?: () => void;
}) {
  const suit = SUITS[card.suit];
  const red = card.suit === "diamonds" || card.suit === "hearts";
  const cardContent = (
    <>
      <span className="card-corner card-corner-top" aria-hidden="true">
        <strong>{rank(card.value)}</strong>
        <span>{suit.symbol}</span>
      </span>
      <span className="card-emblem" aria-hidden="true">
        {suit.symbol}
      </span>
      <span className="card-value">{card.value}</span>
      <span className="card-kind">{suit.kind}</span>
      <span className="card-corner card-corner-bottom" aria-hidden="true">
        <strong>{rank(card.value)}</strong>
        <span>{suit.symbol}</span>
      </span>
    </>
  );

  if (!onClick) {
    return (
      <div
        className={`playing-card ${red ? "card-red" : "card-black"} ${compact ? "card-compact" : ""}`}
        aria-label={cardName(card)}
      >
        {cardContent}
      </div>
    );
  }

  return (
    <button
      className={`playing-card ${red ? "card-red" : "card-black"} ${selected ? "is-selected" : ""}`}
      onClick={onClick}
      aria-label={`${cardName(card)}, ${suit.kind.toLowerCase()}, value ${card.value}`}
      aria-pressed={selected}
    >
      {cardContent}
    </button>
  );
}

export default function Home() {
  const [game, setGame] = useState<GameState | null>(null);
  const [showRules, setShowRules] = useState(false);

  useEffect(() => {
    setGame(createGame());
  }, []);

  const selectedMonster = useMemo(() => {
    if (!game?.selectedId) return null;
    const card = game.room.find((candidate) => candidate.id === game.selectedId);
    return card && isMonster(card) ? card : null;
  }, [game]);

  if (!game) {
    return (
      <main className="loading-table">
        <div className="brand-mark">♦</div>
        <p>Shuffling the dungeon…</p>
      </main>
    );
  }

  const choicesLeft = Math.max(game.roomGoal - game.resolvedThisRoom, 0);
  const canRun =
    game.status === "playing" &&
    game.resolvedThisRoom === 0 &&
    game.room.length === 4 &&
    !game.fledPreviousRoom;
  const weaponLegal = Boolean(
    selectedMonster &&
      game.weapon &&
      (game.weapon.lastMonster === null ||
        selectedMonster.value < game.weapon.lastMonster),
  );
  const weaponDamage =
    selectedMonster && game.weapon
      ? Math.max(0, selectedMonster.value - game.weapon.card.value)
      : 0;
  const progress = ((game.deck.length + game.room.length) / TOTAL_CARDS) * 100;

  function resolveItem(card: Card) {
    setGame((current) => {
      if (!current || current.status !== "playing") return current;

      if (card.suit === "diamonds") {
        const discarded = current.weapon
          ? `, replacing the ${cardName(current.weapon.card)}`
          : "";
        return completeCard(
          {
            ...current,
            weapon: { card, lastMonster: null },
          },
          card,
          `Equipped the ${cardName(card)}${discarded}.`,
        );
      }

      if (card.suit === "hearts") {
        if (current.potionUsed) {
          return completeCard(
            current,
            card,
            `${cardName(card)} was discarded — one potion per room.`,
          );
        }

        const healed = Math.min(card.value, MAX_HEALTH - current.health);
        return completeCard(
          {
            ...current,
            health: current.health + healed,
            potionUsed: true,
          },
          card,
          healed > 0
            ? `${cardName(card)} restored ${healed} health.`
            : `${cardName(card)} was used, but your health was already full.`,
        );
      }

      return current;
    });
  }

  function chooseCard(card: Card) {
    if (game.status !== "playing") return;
    if (isMonster(card)) {
      setGame((current) =>
        current
          ? {
              ...current,
              selectedId: current.selectedId === card.id ? null : card.id,
            }
          : current,
      );
      return;
    }
    resolveItem(card);
  }

  function fight(mode: "weapon" | "bare") {
    if (!selectedMonster) return;

    setGame((current) => {
      if (!current || current.status !== "playing") return current;
      const monster = current.room.find(
        (card) => card.id === selectedMonster.id && isMonster(card),
      );
      if (!monster) return current;

      if (mode === "weapon") {
        if (
          !current.weapon ||
          (current.weapon.lastMonster !== null &&
            monster.value >= current.weapon.lastMonster)
        ) {
          return current;
        }

        const damage = Math.max(0, monster.value - current.weapon.card.value);
        return completeCard(
          {
            ...current,
            health: current.health - damage,
            weapon: { ...current.weapon, lastMonster: monster.value },
          },
          monster,
          damage === 0
            ? `${cardName(monster)} fell to your ${cardName(current.weapon.card)} without a scratch.`
            : `${cardName(monster)} dealt ${damage} damage through your weapon.`,
        );
      }

      return completeCard(
        { ...current, health: current.health - monster.value },
        monster,
        `${cardName(monster)} was fought barehanded for ${monster.value} damage.`,
      );
    });
  }

  function runAway() {
    setGame((current) => {
      if (
        !current ||
        current.status !== "playing" ||
        current.resolvedThisRoom > 0 ||
        current.room.length !== 4 ||
        current.fledPreviousRoom
      ) {
        return current;
      }

      const rotatedDungeon = [...current.deck, ...current.room];
      const room = rotatedDungeon.slice(0, 4);
      return {
        ...current,
        deck: rotatedDungeon.slice(4),
        room,
        roomNumber: current.roomNumber + 1,
        roomGoal: 3,
        potionUsed: false,
        fledPreviousRoom: true,
        selectedId: null,
        log: addLog(
          current,
          "You slipped away. This room must be faced — no running twice.",
        ),
      };
    });
  }

  return (
    <main className="game-shell">
      <header className="topbar">
        <a className="wordmark" href="#game" aria-label="Scoundrel home">
          <span className="wordmark-sigil">♦</span>
          <span>
            <strong>Scoundrel</strong>
            <small>A solo dungeon crawl</small>
          </span>
        </a>
        <button className="rules-button" onClick={() => setShowRules(true)}>
          <span aria-hidden="true">?</span> How to play
        </button>
      </header>

      <section className="status-rail" aria-label="Game status">
        <div className="status-block health-block">
          <div className="status-heading">
            <span>Health</span>
            <strong>{Math.max(0, game.health)} / {MAX_HEALTH}</strong>
          </div>
          <div className="health-track" aria-hidden="true">
            <span style={{ width: `${Math.max(0, game.health) * 5}%` }} />
          </div>
        </div>
        <div className="status-block">
          <span className="status-icon card-stack" aria-hidden="true">▰</span>
          <span>
            <small>Dungeon</small>
            <strong>{game.deck.length + game.room.length} cards</strong>
          </span>
        </div>
        <div className="status-block">
          <span className="status-icon" aria-hidden="true">✦</span>
          <span>
            <small>Score</small>
            <strong>{game.score ?? "—"}</strong>
          </span>
        </div>
        <div className="dungeon-progress" aria-label={`${Math.round(progress)} percent of the dungeon remains`}>
          <span style={{ width: `${progress}%` }} />
        </div>
      </section>

      <section className="table-layout" id="game">
        <aside className="loadout-panel">
          <div className="eyebrow">Current loadout</div>
          <h2>Your weapon</h2>
          {game.weapon ? (
            <div className="weapon-equipped">
              <PlayingCard card={game.weapon.card} compact />
              <div className="weapon-copy">
                <strong>{cardName(game.weapon.card)}</strong>
                <span>Strength {game.weapon.card.value}</span>
                <p>
                  {game.weapon.lastMonster === null
                    ? "Fresh blade — it can face any monster."
                    : `Next monster must be lower than ${game.weapon.lastMonster}.`}
                </p>
              </div>
            </div>
          ) : (
            <div className="empty-weapon">
              <span aria-hidden="true">◇</span>
              <p>No weapon equipped</p>
              <small>Take a diamond to arm yourself.</small>
            </div>
          )}
          <div className="loadout-rule">
            <span aria-hidden="true">↘</span>
            <p>Each kill limits this weapon to a lower-value monster.</p>
          </div>
        </aside>

        <section className="room-panel" aria-labelledby="room-title">
          <div className="room-heading">
            <div>
              <div className="eyebrow">The dungeon</div>
              <h1 id="room-title">Room {String(game.roomNumber).padStart(2, "0")}</h1>
              <p>
                {game.status === "playing"
                  ? `Choose ${choicesLeft} ${choicesLeft === 1 ? "more card" : "more cards"}`
                  : game.status === "won"
                    ? "The dungeon is clear"
                    : "Your run ends here"}
              </p>
            </div>
            <button
              className="run-button"
              disabled={!canRun}
              onClick={runAway}
              title={
                game.fledPreviousRoom
                  ? "You cannot run from two rooms in a row"
                  : game.resolvedThisRoom > 0
                    ? "You can only run before resolving a card"
                    : "Send this room to the bottom of the dungeon"
              }
            >
              <span aria-hidden="true">↗</span> Run away
            </button>
          </div>

          <div className={`card-row cards-${game.room.length}`}>
            {game.room.map((card) => (
              <PlayingCard
                key={card.id}
                card={card}
                selected={game.selectedId === card.id}
                onClick={() => chooseCard(card)}
              />
            ))}
          </div>

          {selectedMonster ? (
            <div className="combat-dock" role="region" aria-label="Combat choice">
              <div className="combat-target">
                <span>{SUITS[selectedMonster.suit].symbol}</span>
                <div>
                  <small>Monster selected</small>
                  <strong>{cardName(selectedMonster)} · {selectedMonster.value} power</strong>
                </div>
              </div>
              <div className="combat-actions">
                {game.weapon && (
                  <button
                    className="action-primary"
                    disabled={!weaponLegal}
                    onClick={() => fight("weapon")}
                  >
                    Use weapon
                    <small>
                      {weaponLegal
                        ? `${weaponDamage} damage`
                        : `Needs a monster below ${game.weapon.lastMonster}`}
                    </small>
                  </button>
                )}
                <button className="action-secondary" onClick={() => fight("bare")}>
                  Fight barehanded
                  <small>{selectedMonster.value} damage</small>
                </button>
              </div>
            </div>
          ) : (
            <div className="hint-strip">
              <span aria-hidden="true">✦</span>
              <p>
                Select a monster to choose how to fight. Weapons and potions resolve immediately.
              </p>
            </div>
          )}

          {game.status !== "playing" && (
            <div className="end-state" role="dialog" aria-modal="true">
              <div className="end-sigil" aria-hidden="true">
                {game.status === "won" ? "✦" : "×"}
              </div>
              <div>
                <div className="eyebrow">
                  {game.status === "won" ? "Dungeon cleared" : "Run defeated"}
                </div>
                <h2>{game.status === "won" ? "You survived." : "The dark wins."}</h2>
                <p>
                  Final score <strong>{game.score}</strong>
                  {game.status === "won"
                    ? ` · ${game.health} health remaining`
                    : " · based on monsters left in the Dungeon deck"}
                </p>
              </div>
              <button onClick={() => setGame(createGame())}>Enter again</button>
            </div>
          )}
        </section>
      </section>

      <section className="chronicle" aria-labelledby="chronicle-title">
        <div>
          <div className="eyebrow">Run chronicle</div>
          <h2 id="chronicle-title">The last few moves</h2>
        </div>
        <ol>
          {game.log.map((entry, index) => (
            <li key={`${entry}-${index}`} className={index === 0 ? "latest" : ""}>
              <span>{index === 0 ? "Now" : index}</span>
              <p>{entry}</p>
            </li>
          ))}
        </ol>
        <button className="new-game-button" onClick={() => setGame(createGame())}>
          New dungeon
        </button>
      </section>

      <footer>
        <span>44 cards</span>
        <i aria-hidden="true">♦</i>
        <span>20 health</span>
        <i aria-hidden="true">♦</i>
        <span>One way out</span>
      </footer>

      {showRules && (
        <div className="modal-backdrop" onMouseDown={() => setShowRules(false)}>
          <section
            className="rules-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="rules-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <button className="modal-close" onClick={() => setShowRules(false)} aria-label="Close rules">
              ×
            </button>
            <div className="eyebrow">Field guide</div>
            <h2 id="rules-title">How to survive</h2>
            <div className="rule-grid">
              <article><span>♣ ♠</span><h3>Monsters</h3><p>Fight barehanded for full damage, or reduce damage with a weapon.</p></article>
              <article><span className="red-ink">♦</span><h3>Weapons</h3><p>Equip a diamond. After each kill, it can only face a lower monster.</p></article>
              <article><span className="red-ink">♥</span><h3>Potions</h3><p>Heal up to 20. Only the first potion used in each room restores health.</p></article>
              <article><span>↗</span><h3>Running</h3><p>Run before choosing a card, but never from two rooms in a row.</p></article>
            </div>
            <p className="rules-footnote">Resolve three cards in each four-card room. The last card follows you forward. Clear every card to win.</p>
          </section>
        </div>
      )}
    </main>
  );
}
