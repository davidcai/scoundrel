import './style.css';
import {
  MAX_HEALTH,
  ROOM_SIZE,
  canRun,
  canUseWeaponOn,
  cardKind,
  cardLabel,
  drinkPotion,
  equipWeapon,
  fightMonster,
  newGame,
  rankLabel,
  runAway,
  strikeDamage,
  suitSymbol,
  weaponKillCap,
  type Card,
} from './game';

const MAX_LOG_ENTRIES = 60;

const app = document.querySelector<HTMLDivElement>('#app')!;

let seed = readSeedFromHash() ?? randomSeed();
let state = newGame(seed);
let log: string[] = [];

function randomSeed(): number {
  return Math.floor(Math.random() * 2 ** 31);
}

function readSeedFromHash(): number | null {
  const match = /seed=(\d+)/.exec(location.hash);
  return match ? Number(match[1]) : null;
}

function startGame(newSeed: number): void {
  seed = newSeed;
  history.replaceState(null, '', `#seed=${seed}`);
  state = newGame(seed);
  log = [`You descend into dungeon #${seed}.`];
  render();
}

function act(action: () => string[]): void {
  try {
    log.push(...action());
  } catch (error) {
    log.push(`⚠ ${error instanceof Error ? error.message : String(error)}`);
  }
  log = log.slice(-MAX_LOG_ENTRIES);
  render();
}

window.addEventListener('hashchange', () => {
  const hashSeed = readSeedFromHash();
  if (hashSeed !== null && hashSeed !== seed) startGame(hashSeed);
});

app.addEventListener('click', (event) => {
  const button = (event.target as HTMLElement).closest<HTMLButtonElement>('button[data-action]');
  if (!button || button.disabled) return;
  const index = Number(button.dataset.index ?? -1);
  switch (button.dataset.action) {
    case 'fight-weapon':
      act(() => fightMonster(state, index, true));
      break;
    case 'fight-bare':
      act(() => fightMonster(state, index, false));
      break;
    case 'equip':
      act(() => equipWeapon(state, index));
      break;
    case 'drink':
      act(() => drinkPotion(state, index));
      break;
    case 'run':
      act(() => runAway(state));
      break;
    case 'new-game':
      startGame(randomSeed());
      break;
    case 'retry-seed':
      startGame(seed);
      break;
  }
});

function cardHtml(card: Card, index: number): string {
  const kind = cardKind(card);
  const color = card.suit === 'hearts' || card.suit === 'diamonds' ? 'red' : 'black';
  const symbol = suitSymbol(card.suit);
  const corner = `${rankLabel(card.rank)}<br>${symbol}`;

  let meta = '';
  let actions = '';
  if (kind === 'monster') {
    meta = `Monster · deals ${card.rank}`;
    if (state.weapon && canUseWeaponOn(state, card)) {
      const damage = strikeDamage(state.weapon.card, card);
      actions += `<button data-action="fight-weapon" data-index="${index}">⚔ Weapon — take ${damage}</button>`;
    }
    actions += `<button data-action="fight-bare" data-index="${index}">✊ Barehanded — take ${card.rank}</button>`;
    if (state.weapon && !canUseWeaponOn(state, card)) {
      const cap = weaponKillCap(state.weapon);
      actions += `<div class="card-hint">weapon too worn (needs &lt; ${cap})</div>`;
    }
  } else if (kind === 'weapon') {
    meta = `Weapon · strength ${card.rank}`;
    actions = `<button data-action="equip" data-index="${index}">🛡 Equip</button>`;
  } else {
    meta = `Potion · heals ${card.rank}`;
    actions = state.potionUsedThisRoom
      ? `<button data-action="drink" data-index="${index}">Discard — no effect</button>`
      : `<button data-action="drink" data-index="${index}">🧪 Drink — +${Math.min(card.rank, MAX_HEALTH - state.health)}</button>`;
  }

  return `
    <div class="card ${kind} ${color}">
      <div class="card-corner">${corner}</div>
      <div class="card-pip">${symbol}</div>
      <div class="card-meta">${meta}</div>
      <div class="card-actions">${actions}</div>
    </div>`;
}

function emptySlotHtml(): string {
  return '<div class="card-slot"></div>';
}

function weaponHtml(): string {
  if (!state.weapon) {
    return '<div class="weapon-body empty">Bare fists — no weapon equipped</div>';
  }
  const cap = weaponKillCap(state.weapon);
  const capText = cap === null ? 'can strike any monster' : `next strike must be &lt; ${cap}`;
  const kills = state.weapon.kills
    .map((kill) => `<span class="mini-card">${cardLabel(kill)}</span>`)
    .join('');
  return `
    <div class="weapon-body">
      <span class="mini-card weapon-card">${cardLabel(state.weapon.card)}</span>
      <span class="weapon-cap">${capText}</span>
      ${kills ? `<span class="weapon-kills">slain: ${kills}</span>` : ''}
    </div>`;
}

function overlayHtml(): string {
  if (state.status === 'playing') return '';
  const won = state.status === 'won';
  return `
    <div class="overlay">
      <div class="overlay-panel">
        <h2>${won ? '⚔ Dungeon cleared!' : '☠ You have been slain'}</h2>
        <p class="final-score">Final score: <strong>${state.score}</strong></p>
        <div class="overlay-actions">
          <button data-action="retry-seed">Retry this dungeon</button>
          <button data-action="new-game" class="primary">New dungeon</button>
        </div>
      </div>
    </div>`;
}

function render(): void {
  const healthPct = Math.round((state.health / MAX_HEALTH) * 100);
  const healthTone = state.health > 12 ? 'good' : state.health > 6 ? 'warn' : 'bad';
  const runnable = canRun(state);
  const runReason = state.ranFromLastRoom
    ? 'You ran from the last room'
    : state.resolvedThisRoom > 0
      ? 'You already engaged this room'
      : '';
  const slots = state.room.map((card, index) => cardHtml(card, index));
  while (slots.length < ROOM_SIZE) slots.push(emptySlotHtml());

  app.innerHTML = `
    <header class="topbar">
      <div>
        <h1>Scoundrel</h1>
        <p class="tagline">A solo dungeon crawl in 44 cards · dungeon #${seed}</p>
      </div>
      <button data-action="new-game">New dungeon</button>
    </header>

    <section class="status">
      <div class="status-block health">
        <div class="status-label">Health ${state.health}/${MAX_HEALTH}</div>
        <div class="health-track"><div class="health-fill ${healthTone}" style="width:${healthPct}%"></div></div>
      </div>
      <div class="status-block weapon">
        <div class="status-label">Weapon</div>
        ${weaponHtml()}
      </div>
      <div class="status-block counts">
        <div class="status-label">Dungeon</div>
        <div class="counts-body">🂠 ${state.deck.length} in deck · ${state.discard.length} discarded</div>
      </div>
    </section>

    <section class="room-panel">
      <div class="room-head">
        <h2>The Room</h2>
        <button data-action="run" ${runnable ? '' : `disabled title="${runReason}"`}>🏃 Run away</button>
      </div>
      <div class="room">${slots.join('')}</div>
    </section>

    <section class="chronicle">
      <h2>Chronicle</h2>
      <ul>${[...log].reverse().map((entry) => `<li>${entry}</li>`).join('')}</ul>
    </section>

    ${overlayHtml()}
  `;
}

startGame(seed);
