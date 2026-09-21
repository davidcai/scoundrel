import { useEffect, useRef } from 'react';
import {
  canEnterNextRoom,
  canResolveMore,
  canUndo,
  cardKind,
  cardValue,
  isFinalRoom,
  previewFight,
  runAwayStatus,
  type CardId,
  type GameAction,
  type GameState,
} from '../engine';
import { cardHint, cardLabel, useT } from '../i18n';
import { useGameStore } from '../store/game-store';
import { decodeConfig } from '../store/share';
import { CardView } from './CardView';
import { GameOverScreen } from './GameOverScreen';
import { Hud } from './Hud';
import { PhaserBoard } from './PhaserBoard';
import { Tooltip } from './Tooltip';
import { useMotionDirector } from './use-motion-director';
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
  const t = useT();

  const seedParam = route.params.get('seed');
  const configParam = route.params.get('config');

  const abandon = () => {
    abandonRun();
    navigate('#/');
  };

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
  // Motion director anchor: the `.screen.play` root scopes every FX query.
  const screenRef = useRef<HTMLElement>(null);
  useMotionDirector(screenRef);

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
          <h2>{t('noRunTitle')}</h2>
          <p>{t('noRunHint')}</p>
          <button type="button" className="btn primary" onClick={() => navigate('#/')}>
            {t('backToTitle')}
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
    <main className="screen play" ref={screenRef}>
      <Hud game={game} onAbandon={abandon} />

      <div className="controls">
        <Tooltip text={t('tooltipUndo')}>
          <button
            type="button"
            className="btn"
            aria-disabled={!canUndo(game)}
            onClick={() => act({ type: 'UndoToRoomStart' })}
          >
            {t('undoToRoomStart')}
          </button>
        </Tooltip>

        <Tooltip
          text={
            runStatus.legal
              ? t('tooltipRunLegal')
              : runStatus.reason === 'twice-in-a-row'
                ? t('tooltipRunTwice')
                : runStatus.reason === 'final-room'
                  ? t('tooltipRunFinal')
                  : t('tooltipRunEngaged')
          }
        >
          <button
            type="button"
            className="btn"
            aria-disabled={!runStatus.legal}
            onClick={() => act({ type: 'RunAway' })}
          >
            {t('runAway')}
          </button>
        </Tooltip>

        {!final && (
          <Tooltip text={t('tooltipCarry')}>
            <button
              type="button"
              className="btn primary"
              aria-disabled={!canEnterNextRoom(game)}
              onClick={() => act({ type: 'EnterNextRoom' })}
            >
              {t('enterNextRoom')}
            </button>
          </Tooltip>
        )}
      </div>

      {final && (
        <p className="final-banner" role="note">
          {t('finalBannerStart')} <strong>{t('finalBannerEvery')}</strong> {t('finalBannerEnd')}
        </p>
      )}

      <div
        ref={roomRef}
        className="room"
        role="group"
        aria-label={t('currentRoom')}
        onKeyDown={onKeyDown}
      >
        {/* Phase 1 spike: hidden canvas underlay (see .phaser-board in styles.css). */}
        <PhaserBoard />
        {game.room.map((cardId) => (
          <Tooltip key={cardId} text={cardHint(cardId)}>
            <CardView
              cardId={cardId}
              selected={selected === cardId}
              carried={game.carriedCardId === cardId}
              onClick={() => selectCard(selected === cardId ? null : cardId)}
            />
          </Tooltip>
        ))}
      </div>

      <p className="room-progress" aria-hidden="true">
        {!final && game.room.length === 1
          ? t('carrySingle')
          : final
            ? t('carryNone')
            : t('carryDefault')}
      </p>

      {selected !== null && <ActionPanel game={game} cardId={selected} />}

      <WeaponStack game={game} />

      <p className="seed-note">
        <Tooltip text={t('tooltipSeed')}>
          <span>
            {t('seed')}: <span className="mono">{game.seed}</span>
          </span>
        </Tooltip>
      </p>
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
  const t = useT();
  const kind = cardKind(cardId);
  const label = cardLabel(cardId);

  // Once 3 of the 4 room cards are resolved, the remaining card is the carry
  // card: nothing can be resolved anymore — say so instead of offering actions.
  if (!canResolveMore(game)) {
    return (
      <section className="action-panel" aria-label={t('actionsFor', { label })}>
        <h3 className="zone-title">{label}</h3>
        <p className="action-note" role="note">
          {t('carryNote')}
        </p>
        <CancelCloseButton onCancel={() => selectCard(null)} label={t('cancel')} />
      </section>
    );
  }

  return (
    <section className="action-panel" aria-label={t('actionsFor', { label })}>
      <h3 className="zone-title">{label}</h3>
      <CancelCloseButton onCancel={() => selectCard(null)} label={t('cancel')} />

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
  const t = useT();
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
          {t('fightWith', { weapon: cardLabel(game.weapon), damage: withWeapon.damage })}
        </button>
      )}
      {withWeapon !== null && !withWeapon.legal && (
        <p className="action-note" role="note">
          {lastKill !== undefined
            ? t('weaponCannotWith', {
                weapon: game.weapon !== null ? cardLabel(game.weapon) : t('noWeapon'),
                monster: label,
                last: cardLabel(lastKill),
              })
            : t('weaponCannot', {
                weapon: game.weapon !== null ? cardLabel(game.weapon) : t('noWeapon'),
                monster: label,
              })}
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
          {t('fightBarehanded', { damage: barehanded.damage })}
        </button>
      )}
    </div>
  );
}

function PotionActions({
  game,
  cardId,
  act,
  selectCard,
}: DispatchProps & { game: GameState; cardId: CardId }) {
  const t = useT();
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
        {wasted ? t('drinkWasted') : t('drinkHeal', { heal })}
      </button>
      <p className="action-note">{wasted ? t('potionWastedNote') : t('potionNote')}</p>
    </div>
  );
}

function WeaponActions({
  game,
  cardId,
  act,
  selectCard,
}: DispatchProps & { game: GameState; cardId: CardId }) {
  const t = useT();
  const label = cardLabel(cardId);
  const swapWarning =
    game.weapon !== null
      ? t('equipSwap', {
          label,
          old: cardLabel(game.weapon),
          kills: game.killStack.length,
        })
      : t('equipFresh', { label });

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
        {t('equip', { label })}
      </button>
      <p className="action-note">{swapWarning}</p>
    </div>
  );
}

/** Compact X icon in the panel's top-right corner that deselects the card. */
function CancelCloseButton({ onCancel, label }: { onCancel: () => void; label: string }) {
  return (
    <button type="button" className="btn ghost action-close" aria-label={label} onClick={onCancel}>
      <svg
        viewBox="0 0 24 24"
        width="16"
        height="16"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        aria-hidden="true"
      >
        <line x1="18" y1="6" x2="6" y2="18" />
        <line x1="6" y1="6" x2="18" y2="18" />
      </svg>
    </button>
  );
}
