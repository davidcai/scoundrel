import {
  type Card,
  SUIT_SYMBOL,
  cardName,
  isMonster,
  isRed,
  isWeapon,
  rankLabel,
} from '../game/cards.js';
import {
  type Action,
  type GameState,
  MAX_HEALTH,
  canAvoidRoom,
  remainingMonsterValue,
  score,
  weaponCanFight,
  weaponLimit,
} from '../game/engine.js';
import { el } from './dom.js';

export interface Handlers {
  dispatch: (action: Action) => void;
  newGame: (seed?: number) => void;
}

/** Cards already on screen, so only freshly dealt ones animate in. */
let seenCardIds = new Set<string>();

export function resetAnimations(): void {
  seenCardIds = new Set();
}

export function render(root: HTMLElement, state: GameState, handlers: Handlers): void {
  const nextSeen = new Set(state.room.map((c) => c.id));

  const parts: Node[] = [
    header(state, handlers),
    statusBar(state),
    el('main', { class: 'board' }, [
      roomSection(state, handlers),
      el('div', { class: 'panels' }, [weaponPanel(state), logPanel(state)]),
    ]),
  ];
  if (state.status !== 'playing') parts.push(gameOver(state, handlers));

  root.replaceChildren(...parts);

  const logScroll = root.querySelector<HTMLElement>('.log__entries');
  if (logScroll) logScroll.scrollTop = logScroll.scrollHeight;

  seenCardIds = nextSeen;
}

// ---------------------------------------------------------------------------
// Header & status
// ---------------------------------------------------------------------------

function header(state: GameState, handlers: Handlers): HTMLElement {
  return el('header', { class: 'topbar' }, [
    el('div', { class: 'topbar__brand' }, [
      el('h1', { class: 'topbar__title', text: 'Scoundrel' }),
      el('p', { class: 'topbar__tagline', text: 'A one-player dungeon of 44 cards' }),
    ]),
    el('div', { class: 'topbar__controls' }, [
      el('span', {
        class: 'seed',
        text: `seed ${state.seed}`,
        title: 'Same seed, same dungeon. Click to copy.',
        onClick: () => void navigator.clipboard?.writeText(String(state.seed)),
      }),
      el('button', {
        class: 'btn btn--ghost',
        text: 'New game',
        onClick: () => handlers.newGame(),
      }),
    ]),
  ]);
}

function statusBar(state: GameState): HTMLElement {
  const pct = Math.max(0, Math.min(100, (state.health / MAX_HEALTH) * 100));
  const tone = state.health > 12 ? 'good' : state.health > 6 ? 'warn' : 'bad';

  return el('section', { class: 'status' }, [
    el('div', { class: 'status__health' }, [
      el('div', { class: 'status__label' }, [
        el('span', { text: 'Health' }),
        el('span', { class: 'status__hp', text: `${state.health} / ${MAX_HEALTH}` }),
      ]),
      el('div', { class: 'bar' }, [
        el('div', { class: `bar__fill bar__fill--${tone}`, style: { width: `${pct}%` } }),
      ]),
    ]),
    el('div', { class: 'status__stats' }, [
      stat('Room', String(state.roomNumber)),
      stat('Dungeon', `${state.dungeon.length} left`),
      stat(
        'Monsters',
        `${remainingMonsterValue(state)} pts`,
        'Total value of every monster still unplayed — die now and this is your negative score',
      ),
    ]),
  ]);
}

function stat(label: string, value: string, title?: string): HTMLElement {
  return el('div', { class: 'stat', title }, [
    el('span', { class: 'stat__value', text: value }),
    el('span', { class: 'stat__label', text: label }),
  ]);
}

// ---------------------------------------------------------------------------
// Room
// ---------------------------------------------------------------------------

function roomSection(state: GameState, handlers: Handlers): HTMLElement {
  const canFlee = canAvoidRoom(state);
  const fleeReason = state.avoidedLastRoom
    ? 'You cannot run from two rooms in a row'
    : state.room.length < 4
      ? 'You are committed once you resolve a card'
      : state.dungeon.length === 0
        ? 'No cards left to deal a new room'
        : 'Send all 4 cards to the bottom and deal a new room';

  const left = Math.max(0, state.room.length - 1);

  return el('section', { class: 'room' }, [
    el('div', { class: 'room__head' }, [
      el('h2', { class: 'room__title', text: `Room ${state.roomNumber}` }),
      el('p', {
        class: 'room__hint',
        text:
          state.room.length > 1
            ? `Resolve ${left} more — the last card carries over`
            : 'Resolve the final card',
      }),
      el('button', {
        class: 'btn btn--flee',
        text: 'Run away',
        title: fleeReason,
        disabled: !canFlee,
        onClick: () => handlers.dispatch({ type: 'avoid' }),
      }),
    ]),
    el(
      'div',
      { class: 'room__cards' },
      state.room.map((card) => cardView(card, state, handlers)),
    ),
  ]);
}

function cardView(card: Card, state: GameState, handlers: Handlers): HTMLElement {
  const fresh = !seenCardIds.has(card.id);
  const role = isMonster(card) ? 'monster' : isWeapon(card) ? 'weapon' : 'potion';
  const classes = [
    'card',
    `card--${role}`,
    isRed(card) ? 'card--red' : 'card--black',
    fresh ? 'card--dealt' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return el('article', { class: classes, ariaLabel: cardName(card) }, [
    el('div', { class: 'card__face' }, [
      el('span', { class: 'card__corner', text: `${rankLabel(card.rank)}${SUIT_SYMBOL[card.suit]}` }),
      el('span', { class: 'card__pip', text: SUIT_SYMBOL[card.suit] }),
      el('span', {
        class: 'card__corner card__corner--flip',
        text: `${rankLabel(card.rank)}${SUIT_SYMBOL[card.suit]}`,
      }),
    ]),
    el('div', { class: 'card__actions' }, cardActions(card, state, handlers)),
  ]);
}

function cardActions(card: Card, state: GameState, handlers: Handlers): HTMLElement[] {
  if (isMonster(card)) return monsterActions(card, state, handlers);

  if (isWeapon(card)) {
    const replacing = state.weapon ? ` · drops ${cardName(state.weapon.card)}` : '';
    return [
      el('span', { class: 'card__role', text: `Weapon ${card.rank}` }),
      el('button', {
        class: 'btn btn--action',
        text: `Equip${replacing}`,
        onClick: () => handlers.dispatch({ type: 'equip', cardId: card.id }),
      }),
    ];
  }

  // Potion
  const spent = state.potionUsedThisRoom;
  const gain = Math.min(MAX_HEALTH, state.health + card.rank) - state.health;
  const wasted = spent || gain === 0;
  const label = spent ? 'Discard · no effect' : gain === 0 ? 'Drink · already full' : `Drink +${gain}`;

  return [
    el('span', { class: 'card__role', text: `Potion ${card.rank}` }),
    el('button', {
      class: `btn btn--action ${wasted ? 'btn--muted' : 'btn--heal'}`,
      text: label,
      title: spent
        ? 'You may only use one health potion per room'
        : gain === 0
          ? 'Health is already at 20 — this potion is wasted'
          : undefined,
      onClick: () => handlers.dispatch({ type: 'drink', cardId: card.id }),
    }),
  ];
}

function monsterActions(card: Card, state: GameState, handlers: Handlers): HTMLElement[] {
  const actions: HTMLElement[] = [
    el('span', { class: 'card__role', text: `Monster ${card.rank}` }),
  ];

  const weapon = state.weapon;
  if (weapon) {
    const usable = weaponCanFight(weapon, card);
    const damage = Math.max(0, card.rank - weapon.card.rank);
    const limit = weaponLimit(weapon);
    actions.push(
      el('button', {
        class: `btn btn--action ${usable ? 'btn--weapon' : 'btn--muted'}`,
        text: usable ? `${cardName(weapon.card)} · −${damage}` : `${cardName(weapon.card)} · blunted`,
        disabled: !usable,
        title: usable
          ? `Attack with ${cardName(weapon.card)}`
          : `This weapon can only fight monsters below ${limit}`,
        onClick: () => handlers.dispatch({ type: 'fight', cardId: card.id, withWeapon: true }),
      }),
    );
  }

  actions.push(
    el('button', {
      class: 'btn btn--action btn--bare',
      text: `Barehanded · −${card.rank}`,
      onClick: () => handlers.dispatch({ type: 'fight', cardId: card.id, withWeapon: false }),
    }),
  );

  return actions;
}

// ---------------------------------------------------------------------------
// Side panels
// ---------------------------------------------------------------------------

function weaponPanel(state: GameState): HTMLElement {
  const weapon = state.weapon;
  const limit = weaponLimit(weapon);

  const body = weapon
    ? el('div', { class: 'weapon' }, [
        el('div', { class: 'weapon__stack' }, [
          miniCard(weapon.card),
          ...weapon.slain.map((slain) => miniCard(slain, 'mini--slain')),
        ]),
        el('p', {
          class: 'weapon__note',
          text:
            limit === null
              ? `Strength ${weapon.card.rank} — unblooded, it can face anything.`
              : `Strength ${weapon.card.rank} — can now only fight monsters below ${limit}.`,
        }),
      ])
    : el('p', { class: 'panel__empty', text: 'Barehanded. Every monster hits for full value.' });

  return el('section', { class: 'panel' }, [
    el('h3', { class: 'panel__title', text: 'Weapon' }),
    body,
  ]);
}

function miniCard(card: Card, extra = ''): HTMLElement {
  const classes = ['mini', isRed(card) ? 'mini--red' : 'mini--black', extra]
    .filter(Boolean)
    .join(' ');
  return el('span', { class: classes, text: cardName(card) });
}

function logPanel(state: GameState): HTMLElement {
  return el('section', { class: 'panel panel--log' }, [
    el('h3', { class: 'panel__title', text: 'Dungeon log' }),
    el(
      'div',
      { class: 'log__entries' },
      state.log.map((entry) =>
        el('p', { class: `log__entry log__entry--${entry.kind}`, text: entry.text }),
      ),
    ),
  ]);
}

// ---------------------------------------------------------------------------
// Game over
// ---------------------------------------------------------------------------

function gameOver(state: GameState, handlers: Handlers): HTMLElement {
  const won = state.status === 'won';
  const finalScore = score(state);

  return el('div', { class: 'overlay' }, [
    el('div', { class: `modal modal--${won ? 'win' : 'lose'}` }, [
      el('p', { class: 'modal__eyebrow', text: won ? 'Dungeon cleared' : 'You died' }),
      el('h2', { class: 'modal__score', text: finalScore > 0 ? `+${finalScore}` : `${finalScore}` }),
      el('p', {
        class: 'modal__detail',
        text: won
          ? `You walked out of room ${state.roomNumber} with ${state.health} health.`
          : `${state.dungeon.length + state.room.length} cards left unplayed, worth ${remainingMonsterValue(state)} in monsters.`,
      }),
      el('button', {
        class: 'btn btn--primary',
        text: 'Descend again',
        onClick: () => handlers.newGame(),
      }),
    ]),
  ]);
}
