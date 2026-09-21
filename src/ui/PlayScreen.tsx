import { useEffect, useLayoutEffect, useRef, useState } from 'react';
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
import { cardLabel, useT } from '../i18n';
import { useGameStore } from '../store/game-store';
import { decodeConfig } from '../store/share';
import { GameOverScreen } from './GameOverScreen';
import { Hud } from './Hud';
import { Tooltip } from './Tooltip';
import { CardHoverLayer } from './phaser/CardHoverLayer';
import { CardSelectionControl } from './phaser/CardSelectionControl';
import { RoomMirror } from './phaser/RoomMirror';
import { WeaponReadout } from './phaser/WeaponReadout';
import { applyReducedMotion, subscribeRunEnded, type PlayTableHandle } from './phaser/use-card-hover';
import { navigate, useHashRoute } from './router';

/**
 * Win/lose handoff gate (docs/phaser-plan.md §3): the canvas plays a win/lose
 * flourish before the scorecard takes over, so the GameOverScreen swap waits
 * for the handle's `onRunEnded` (fires after the flourish completes) — or
 * opens after this fail-open timeout. The flourish is presentation-only:
 * a11y and e2e must never wait on it, and a missing handle (mount failure, a
 * run that ended before the canvas mounted) must not strand the player on a
 * frozen table.
 */
const RUN_HANDOFF_TIMEOUT_MS = 1000;

export function PlayScreen() {
  const route = useHashRoute();
  const game = useGameStore((s) => s.game);
  const selectedCardId = useGameStore((s) => s.selectedCardId);
  const act = useGameStore((s) => s.act);
  const startRun = useGameStore((s) => s.startRun);
  const abandonRun = useGameStore((s) => s.abandonRun);
  const [flourishDone, setFlourishDone] = useState(false);
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

  // Reduced-motion escape hatch (docs/phaser-plan.md §4 Phase 2 — decided:
  // honor BOTH carriers): (a) Playwright's `reducedMotion: 'reduce'`
  // emulation and OS preference via matchMedia — flows through the live
  // media-query subscription in PlayTableRegion; (b) the `motion=off` hash
  // param (e.g. `#/play?seed=...&motion=off`), a non-shareable determinism
  // escape hatch parsed here — deliberately NOT in `src/store/share.ts`,
  // which encodes only seed + rule config.
  const motionOff = route.params.get('motion') === 'off';

  // Win/lose handoff gate: the GameOverScreen swap waits for the canvas
  // flourish. Effect per game identity: a new run re-arms the gate; the
  // fail-open timer above bounds it.
  useEffect(() => {
    if (game === null || game.phase === 'playing') {
      setFlourishDone(false);
      return;
    }
    const timer = window.setTimeout(() => setFlourishDone(true), RUN_HANDOFF_TIMEOUT_MS);
    return () => window.clearTimeout(timer);
  }, [game]);

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

  // The GameOverScreen swap happens only once the canvas flourish completed
  // (or the fail-open timer opened the gate).
  if (game.phase !== 'playing' && flourishDone) {
    return <GameOverScreen game={game} />;
  }

  const final = isFinalRoom(game);
  const selected =
    selectedCardId !== null && game.room.includes(selectedCardId) ? selectedCardId : null;
  const runStatus = runAwayStatus(game);

  return (
    <main className="screen play">
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

      <CardSelectionControl game={game} />

      {final && (
        <p className="final-banner" role="note">
          {t('finalBannerStart')} <strong>{t('finalBannerEvery')}</strong> {t('finalBannerEnd')}
        </p>
      )}

      <PlayTableRegion game={game} motionOff={motionOff} onRunEnded={() => setFlourishDone(true)} />

      <p className="room-progress" aria-hidden="true">
        {!final && game.room.length === 1
          ? t('carrySingle')
          : final
            ? t('carryNone')
            : t('carryDefault')}
      </p>

      {selected !== null && <ActionPanel game={game} cardId={selected} />}

      <WeaponReadout game={game} />

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

/**
 * The play screen's canvas region (docs/phaser-plan.md §4 Phase 1): an
 * explicit-dimension box (`aspect-ratio: 960/600`, width-constrained within
 * `.screen`) so FIT has real dimensions — a zero-height container breaks its
 * centering — with the aria-hidden DOM room mirror layered inside for e2e
 * input, and the cursor tooltip layer edge-anchored above.
 *
 * Motion wiring (§4 Phase 2): reduced motion reaches the game through BOTH
 * carriers (see the escape-hatch comment in PlayScreen) — `motion=off` /
 * matchMedia set the create-time opts, and the live media-query change
 * subscription pushes `setReducedMotion` afterwards; `onRunEnded` forwards
 * the post-flourish signal up to the win/lose handoff gate.
 *
 * The game module is reached ONLY through a dynamic import: Phaser and the
 * rest of `src/game` must stay out of the main bundle and off every
 * RTL-tested import chain (jsdom has no canvas/WebGL). Mount failure is
 * non-fatal: the region stays inert and the rest of the screen keeps working.
 */
function PlayTableRegion({
  game,
  motionOff,
  onRunEnded,
}: {
  game: GameState;
  motionOff: boolean;
  onRunEnded: (info: { outcome: 'won' | 'lost' }) => void;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [handle, setHandle] = useState<PlayTableHandle | null>(null);

  // Latest-callback refs so the (per-handle) subscriptions never re-arm on
  // the parent's re-renders, and unmount races clear them.
  const onRunEndedRef = useRef(onRunEnded);
  onRunEndedRef.current = onRunEnded;
  const motionOffRef = useRef(motionOff);
  motionOffRef.current = motionOff;

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (container === null) return;
    let cancelled = false;
    let localHandle: PlayTableHandle | null = null;

    // Create-time reduced motion: the OS/Playwright media query combined with
    // the `motion=off` escape hatch (read via ref so the create-once effect
    // keeps its `[]` deps — a later flip goes through setReducedMotion).
    const reducedMotion =
      (typeof window.matchMedia === 'function' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches) ||
      motionOffRef.current;

    void (async () => {
      try {
        const { createPlayTable } = await import('../game');
        if (cancelled) return;
        // create-once guard: `createPlayTable` is idempotent per container, so
        // the StrictMode double-effect / HMR overlap cannot double-boot. The
        // async-import race is handled here: a handle created after cleanup
        // runs is destroyed immediately (Phaser 4's destroy is asynchronous
        // internally — the handle interface hides that detail).
        localHandle = createPlayTable(container, { reducedMotion });
        if (cancelled) {
          localHandle.destroy();
          localHandle = null;
          return;
        }
        setHandle(localHandle);
      } catch (error) {
        console.error('play table failed to mount — leaving the canvas region inert', error);
      }
    })();

    return () => {
      cancelled = true;
      localHandle?.destroy();
      localHandle = null;
      setHandle(null);
    };
  }, []);

  // Post-flourish run-ended signal for the handoff gate. Subscribed once per
  // handle; the ref forwards the latest callback; unsubscribed before the
  // handle is destroyed in the cleanup above.
  useEffect(() => {
    return subscribeRunEnded(handle, (info) => onRunEndedRef.current(info));
  }, [handle]);

  // Live reduced motion (docs/phaser-plan.md §4 Phase 2): the handle is
  // updated whenever the media query flips (OS toggle, Playwright emulation)
  // or the `motion=off` escape hatch appears/disappears. Create-time opts
  // carry the initial value; `motion=off` is not a media event, so it is
  // pushed explicitly on arrival.
  useEffect(() => {
    const mq =
      typeof window.matchMedia === 'function'
        ? window.matchMedia('(prefers-reduced-motion: reduce)')
        : null;
    if (mq === null) return;
    const sync = () => applyReducedMotion(handle, mq.matches || motionOffRef.current);
    if (motionOff) sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, [handle, motionOff]);

  return (
    <div className="play-table-region">
      {/* Phaser mounts here — the sized scale parent (aspect-ratio 16:10).
          `data-table-ready="true"` appears once scene + textures are loaded:
          the e2e awaitable readiness marker. */}
      <div className="play-table-canvas" ref={containerRef} />
      <RoomMirror game={game} />
      <CardHoverLayer handle={handle} />
    </div>
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
