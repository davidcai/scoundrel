import { useEffect, useState } from 'react';
import type { CardId, GameState } from '../../engine';
import {
  canFightWithWeapon,
  cardLabel,
  cardType,
  cardValue,
  finalScore,
  randomSeed,
} from '../../engine';
import { configFromQuery, configToQuery } from '../../store/configCodec';
import { useGameStore } from '../../store/gameStore';
import { CardView } from '../components/CardView';
import { Hud } from '../components/Hud';
import { WeaponStack } from '../components/WeaponStack';
import { navigate } from '../router';

interface PlayScreenProps {
  params: URLSearchParams;
}

export function PlayScreen({ params }: PlayScreenProps) {
  const state = useGameStore((s) => s.state);
  const selectedCardId = useGameStore((s) => s.selectedCardId);
  const carriedCardIds = useGameStore((s) => s.carriedCardIds);
  const announcement = useGameStore((s) => s.announcement);
  const startRun = useGameStore((s) => s.startRun);
  const select = useGameStore((s) => s.select);
  const fight = useGameStore((s) => s.fight);
  const drink = useGameStore((s) => s.drink);
  const equip = useGameStore((s) => s.equip);
  const runAway = useGameStore((s) => s.runAway);
  const undo = useGameStore((s) => s.undo);
  const enterNextRoom = useGameStore((s) => s.enterNextRoom);

  const seed = params.get('seed');

  useEffect(() => {
    if (seed) {
      if (!state || state.seed !== seed) {
        startRun(seed, configFromQuery(params));
      }
    } else if (!state) {
      navigate('title');
    }
  }, [seed, state, params, startRun]);

  if (!state) return null;

  if (state.phase !== 'playing') {
    return <Scorecard state={state} />;
  }

  return (
    <div className='screen play-screen'>
      <Hud state={state} onRunAway={runAway} onUndo={undo} onEnterNextRoom={enterNextRoom} />
      <WeaponStack state={state} />
      <div className='room' role='group' aria-label='Room cards'>
        {state.room.map((id) => (
          <CardView
            key={id}
            cardId={id}
            selected={selectedCardId === id}
            carried={carriedCardIds.includes(id)}
            onClick={() => select(selectedCardId === id ? null : id)}
          />
        ))}
      </div>
      {selectedCardId && state.room.includes(selectedCardId) && (
        <ActionPanel
          state={state}
          cardId={selectedCardId}
          onFight={fight}
          onDrink={drink}
          onEquip={equip}
          onCancel={() => select(null)}
        />
      )}
      <div className='announcer' role='status' aria-live='polite'>
        {announcement}
      </div>
    </div>
  );
}

function ActionPanel({
  state,
  cardId,
  onFight,
  onDrink,
  onEquip,
  onCancel,
}: {
  state: GameState;
  cardId: CardId;
  onFight: (cardId: CardId, barehanded: boolean) => void;
  onDrink: (cardId: CardId) => void;
  onEquip: (cardId: CardId) => void;
  onCancel: () => void;
}) {
  const type = cardType(cardId);
  const value = cardValue(cardId);
  return (
    <div className='action-panel' role='dialog' aria-label={'Actions for ' + cardLabel(cardId)}>
      <span className='action-title'>{cardLabel(cardId)}</span>
      {type === 'monster' && (
        <>
          <button type='button' onClick={() => onFight(cardId, true)}>
            Fight barehanded ({value} dmg)
          </button>
          {state.weapon && canFightWithWeapon(state, cardId) && (
            <button type='button' onClick={() => onFight(cardId, false)}>
              Fight with weapon ({Math.max(0, value - cardValue(state.weapon))} dmg)
            </button>
          )}
          {state.weapon && !canFightWithWeapon(state, cardId) && (
            <p className='note'>Weapon is degraded and cannot fight this monster.</p>
          )}
        </>
      )}
      {type === 'weapon' && (
        <>
          <button type='button' onClick={() => onEquip(cardId)}>
            Equip weapon ({value})
          </button>
          {state.weapon && (
            <p className='note'>Switching discards your current weapon and its kill stack.</p>
          )}
        </>
      )}
      {type === 'potion' && (() => {
        const canHeal = state.potionsUsedThisRoom < state.config.potionsPerRoom;
        const heal = canHeal ? Math.min(value, state.maxHp - state.hp) : 0;
        return (
          <button type='button' onClick={() => onDrink(cardId)}>
            {canHeal ? 'Drink (heal ' + heal + ')' : 'Drink (wasted)'}
          </button>
        );
      })()}
      <button type='button' className='cancel' onClick={onCancel}>
        Cancel
      </button>
    </div>
  );
}

function Scorecard({ state }: { state: GameState }) {
  const startRun = useGameStore((s) => s.startRun);
  const [copied, setCopied] = useState(false);
  const won = state.phase === 'won';
  const score = finalScore(state);
  const replayQuery = 'seed=' + state.seed + '&' + configToQuery(state.config);
  const replayUrl =
    window.location.origin + window.location.pathname + window.location.search + '#/play?' + replayQuery;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(replayUrl);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  const playAgain = () => {
    startRun(randomSeed());
    navigate('play');
  };

  return (
    <div className='screen scorecard'>
      <h1 className={won ? 'win-title' : 'lose-title'}>{won ? 'YOU WIN' : 'YOU LOSE'}</h1>
      <dl className='scorecard-grid'>
        <dt>Final HP</dt>
        <dd>{state.hp}</dd>
        <dt>Score</dt>
        <dd>{score}</dd>
        <dt>Seed</dt>
        <dd>{state.seed}</dd>
        <dt>Monsters killed</dt>
        <dd>{state.runHighlights.monstersKilled}</dd>
        <dt>Potions wasted</dt>
        <dd>{state.runHighlights.potionsWasted}</dd>
        <dt>Rooms explored</dt>
        <dd>{state.runHighlights.roomsExplored}</dd>
        <dt>House rules</dt>
        <dd className='config-summary'>{summarizeConfig(state.config)}</dd>
      </dl>
      <div className='scorecard-actions'>
        <button type='button' onClick={copy}>
          {copied ? 'Copied!' : 'Copy replay link'}
        </button>
        <input readOnly value={replayUrl} onFocus={(e) => e.target.select()} aria-label='Replay link' />
        <button type='button' className='primary' onClick={playAgain}>
          Play Again
        </button>
        <button type='button' onClick={() => navigate('title')}>
          Title
        </button>
      </div>
    </div>
  );
}

function summarizeConfig(config: GameState['config']): string {
  const parts = [];
  parts.push(config.runAwayMode === 'unlimited' ? 'run: unlimited' : 'run: once');
  parts.push(config.potionsPerRoom === Infinity ? 'potions: unlimited' : 'potions: 1');
  parts.push(config.weaponDegradation ? 'degradation: on' : 'degradation: off');
  return parts.join(', ');
}
