import { useEffect, useRef, useState } from 'react';
import {
  canEnterNextRoom,
  canResolveMore,
  canUndo,
  cardKind,
  cardLabel,
  cardValue,
  isFinalRoom,
  previewFight,
  runAwayStatus,
  type CardId,
  type GameAction,
  type GameState,
} from '../engine';
import { useGameStore } from '../store/gameStore';
import { decodeConfig } from '../store/share';
import { CardView } from './CardView';
import { GameOverScreen } from './GameOverScreen';
import { Hud } from './Hud';
import { Tooltip } from './Tooltip';
import { WeaponStack } from './WeaponStack';
import { navigate, useHashRoute } from './router';

export function PlayScreen() {
  const route = useHashRoute();
  const game = useGameStore((s) => s.game);
  const selectedCardId = useGameStore((s) => s.selectedCardId);
  const act = useGameStore((s) => s.act);
  const selectCard = useGameStore((s) => s.selectCard);
  const startRun = useGameStore((s) => s.startRun);
  const abandonRun = useGameStore((s) => s.abandonRun);

  const seedParam = route.params.get('seed');
  const configParam = route.params.get('config');
  const [abandonArmed, setAbandonArmed] = useState(false);

  // Shareable replay URL: `#/play?seed=...&config=...` deterministically restarts that run.
  useEffect(() => {
    if (seedParam === null || seedParam.trim() === '') return;
    const seed = seedParam.trim().toLowerCase();
    const config = decodeConfig(configParam);
    const sameRun =
      game !== null &&
      game.seed === seed &&
      game.config.runAwayMode === config.runAwayMode &&
      game.config.potionsPerRoom === config.potionsPerRoom &&
      game.config.weaponDegradation === config.weaponDegradation;
    if (!sameRun) startRun(seed, config);
  }, [seedParam, configParam, game, startRun]);

  const roomRef = useRef<HTMLDivElement>(null);

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (
      event.key !== 'ArrowLeft' &&
      event.key !== 'ArrowRight' &&
      event.key !== 'Home' &&
      event.key !== 'End'
    ) {
      return;
    }
    const buttons = Array.from(
      roomRef.current?.querySelectorAll<HTMLButtonElement>('button.card:not([disabled])') ?? [],
    );
    if (buttons.length === 0) return;
    event.preventDefault();
    const index = buttons.findIndex((b) => b === document.activeElement);
    const next =
      event.key === 'Home'
        ? 0
        : event.key === 'End'
          ? buttons.length - 1
          : index === -1
            ? 0
            : (index + (event.key === 'ArrowRight' ? 1 : -1) + buttons.length) % buttons.length;
    buttons[next]?.focus();
  };

  if (game === null) {
    return (
      <main className="screen">
        <div className="panel empty-state">
          <h2>No run in progress</h2>
          <p>Start a new run from the title screen, or open a shared replay link.</p>
          <button type="button" className="btn primary" onClick={() => navigate('#/')}>
            Back to title
          </button>
        </div>
      </main>
    );
  }

  if (game.phase !== 'playing') {
    return <GameOverScreen game={game} />;
  }

  const final = isFinalRoom(game);
  const selected =
    selectedCardId !== null && game.room.includes(selectedCardId) ? selectedCardId : null;
  const runStatus = runAwayStatus(game);

  return (
    <main className="screen play">
      <Hud game={game} />

      {final && (
        <p className="final-banner" role="note">
          The final room — resolve <strong>every</strong> card to win.
        </p>
      )}

      <div
        ref={roomRef}
        className="room"
        role="group"
        aria-label="Current room"
        onKeyDown={onKeyDown}
      >
        {game.room.map((cardId) => (
          <CardView
            key={cardId}
            cardId={cardId}
            selected={selected === cardId}
            carried={game.carriedCardId === cardId}
            onClick={() => selectCard(selected === cardId ? null : cardId)}
          />
        ))}
      </div>

      <p className="room-progress" aria-hidden="true">
        {!final && game.room.length === 1
          ? 'This card will carry over to the next room.'
          : final
            ? 'No card will carry over — clear them all.'
            : 'Choose a card, then resolve it. One card will carry over.'}
      </p>

      {selected !== null && <ActionPanel game={game} cardId={selected} />}

      <WeaponStack game={game} />

      <footer className="controls">
        <Tooltip text="Rewind the current room to the moment it was dealt — health, weapon, kill stack and potions reset. The snapshot is cleared once you enter the next room.">
          <button
            type="button"
            className="btn"
            aria-disabled={!canUndo(game)}
            onClick={() => act({ type: 'UndoToRoomStart' })}
          >
            Undo to room start
          </button>
        </Tooltip>

        <Tooltip
          text={
            runStatus.legal
              ? 'Send all four cards to the bottom of the dungeon and deal a fresh room.'
              : runStatus.reason === 'twice-in-a-row'
                ? 'You cannot run from two rooms in a row.'
                : runStatus.reason === 'final-room'
                  ? 'This is the final room — fleeing would just re-deal the same cards.'
                  : 'You already engaged this room.'
          }
        >
          <button
            type="button"
            className="btn"
            aria-disabled={!runStatus.legal}
            onClick={() => act({ type: 'RunAway' })}
          >
            Run away
          </button>
        </Tooltip>

        {!final && (
          <Tooltip text="Resolve 3 of the 4 cards, then carry the remaining one into the next room.">
            <button
              type="button"
              className="btn primary"
              aria-disabled={!canEnterNextRoom(game)}
              onClick={() => act({ type: 'EnterNextRoom' })}
            >
              Enter next room →
            </button>
          </Tooltip>
        )}

        <button
          type="button"
          className="btn danger"
          onClick={() => {
            if (abandonArmed) {
              abandonRun();
              navigate('#/');
            } else {
              setAbandonArmed(true);
            }
          }}
        >
          {abandonArmed ? 'Really abandon?' : 'Abandon run'}
        </button>
      </footer>
    </main>
  );
}

interface DispatchProps {
  act: (action: GameAction) => void;
  selectCard: (cardId: CardId | null) => void;
}

/** Damage/cost preview + confirm step for the selected card. */
function ActionPanel({ game, cardId }: { game: GameState; cardId: CardId }) {
  const selectCard = useGameStore((s) => s.selectCard);
  const act = useGameStore((s) => s.act);
  const kind = cardKind(cardId);
  const label = cardLabel(cardId);

  // Once 3 of the 4 room cards are resolved, the remaining card is the carry
  // card: nothing can be resolved anymore — say so instead of offering actions.
  if (!canResolveMore(game)) {
    return (
      <section className="action-panel" aria-label={`Actions for ${label}`}>
        <h3 className="zone-title">{label}</h3>
        <p className="action-note" role="note">
          The other 3 cards of this room are resolved — this card carries over to the next room.
        </p>
        <div className="action-buttons">
          <button type="button" className="btn ghost" onClick={() => selectCard(null)}>
            Cancel
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="action-panel" aria-label={`Actions for ${label}`}>
      <h3 className="zone-title">{label}</h3>

      {kind === 'monster' && (
        <MonsterActions game={game} cardId={cardId} act={act} selectCard={selectCard} />
      )}

      {kind === 'potion' && (
        <PotionActions game={game} cardId={cardId} act={act} selectCard={selectCard} />
      )}

      {kind === 'weapon' && (
        <WeaponActions game={game} cardId={cardId} act={act} selectCard={selectCard} />
      )}
    </section>
  );
}

function MonsterActions({
  game,
  cardId,
  act,
  selectCard,
}: DispatchProps & { game: GameState; cardId: CardId }) {
  const withWeapon = game.weapon !== null ? previewFight(game, cardId, false) : null;
  const barehanded = previewFight(game, cardId, true);
  const label = cardLabel(cardId);
  const lastKill = game.killStack[game.killStack.length - 1];

  return (
    <div className="action-buttons">
      {withWeapon?.legal && game.weapon !== null && (
        <button
          type="button"
          className="btn primary"
          onClick={() => {
            act({ type: 'FightMonster', cardId });
            selectCard(null);
          }}
        >
          Fight with {cardLabel(game.weapon)} — take {withWeapon.damage} damage
        </button>
      )}
      {withWeapon !== null && !withWeapon.legal && (
        <p className="action-note" role="note">
          Your {game.weapon !== null ? cardLabel(game.weapon) : 'weapon'} cannot fight the {label} —
          it only defeats monsters weaker than its last kill
          {lastKill !== undefined ? ` (the ${cardLabel(lastKill)})` : ''}.
        </p>
      )}
      {barehanded.legal && (
        <button
          type="button"
          className="btn"
          onClick={() => {
            act({ type: 'FightMonster', cardId, barehanded: true });
            selectCard(null);
          }}
        >
          Fight barehanded — take {barehanded.damage} damage
        </button>
      )}
      <button type="button" className="btn ghost" onClick={() => selectCard(null)}>
        Cancel
      </button>
    </div>
  );
}

function PotionActions({
  game,
  cardId,
  act,
  selectCard,
}: DispatchProps & { game: GameState; cardId: CardId }) {
  const value = cardValue(cardId);
  const wasted = game.config.potionsPerRoom === 'one' && game.potionsUsedThisRoom >= 1;
  const heal = wasted ? 0 : Math.min(value, game.maxHp - game.hp);

  return (
    <div className="action-buttons">
      <button
        type="button"
        className="btn primary"
        onClick={() => {
          act({ type: 'DrinkPotion', cardId });
          selectCard(null);
        }}
      >
        {wasted
          ? `Drink potion — wasted (one potion per room, restores nothing)`
          : `Drink potion — restore ${heal} health`}
      </button>
      <p className="action-note">
        {wasted
          ? 'You already drank a potion this room; a second one is discarded with no effect.'
          : 'Only the first potion each room heals you.'}
      </p>
      <button type="button" className="btn ghost" onClick={() => selectCard(null)}>
        Cancel
      </button>
    </div>
  );
}

function WeaponActions({
  game,
  cardId,
  act,
  selectCard,
}: DispatchProps & { game: GameState; cardId: CardId }) {
  const label = cardLabel(cardId);
  const swapWarning =
    game.weapon !== null
      ? `Equipping ${label} discards your ${cardLabel(game.weapon)} and its ${game.killStack.length} slain monsters.`
      : `Equip ${label} as your weapon.`;

  return (
    <div className="action-buttons">
      <button
        type="button"
        className="btn primary"
        onClick={() => {
          act({ type: 'EquipWeapon', cardId });
          selectCard(null);
        }}
      >
        Equip {label}
      </button>
      <p className="action-note">{swapWarning}</p>
      <button type="button" className="btn ghost" onClick={() => selectCard(null)}>
        Cancel
      </button>
    </div>
  );
}
