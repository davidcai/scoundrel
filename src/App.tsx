import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from './game/store';
import { audioManager, type SoundType } from './game/audio';
import { StartScreen } from './components/StartScreen';
import { EndScreen } from './components/EndScreen';
import { HealthBar } from './components/HealthBar';
import { DeckDisplay } from './components/DeckDisplay';
import { RoomArea } from './components/RoomArea';
import { WeaponArea } from './components/WeaponArea';
import { ActionBar, RulesPanel } from './components/ActionBar';

function App() {
  const phase = useGameStore((s) => s.phase);
  const health = useGameStore((s) => s.health);
  const deck = useGameStore((s) => s.deck);
  const room = useGameStore((s) => s.room);
  const weapon = useGameStore((s) => s.weapon);
  const canRunAway = useGameStore((s) => s.canRunAway);
  const potionUsedThisRoom = useGameStore((s) => s.potionUsedThisRoom);
  const carriedOverCardId = useGameStore((s) => s.carriedOverCardId);
  const cardsResolvedThisRoom = useGameStore((s) => s.cardsResolvedThisRoom);
  const score = useGameStore((s) => s.score);

  const startGame = useGameStore((s) => s.startGame);
  const fightMonster = useGameStore((s) => s.fightMonster);
  const usePotion = useGameStore((s) => s.usePotion);
  const equipWeapon = useGameStore((s) => s.equipWeapon);
  const runAway = useGameStore((s) => s.runAway);
  const reset = useGameStore((s) => s.reset);

  const [rulesOpen, setRulesOpen] = useState(false);
  const prevLogLen = useRef(0);
  const log = useGameStore((s) => s.log);

  const lastLog = log[log.length - 1];
  const lastLogRef = useRef<string | null>(null);

  useEffect(() => {
    if (!lastLog || lastLog === lastLogRef.current) return;
    lastLogRef.current = lastLog;

    let sound: SoundType = 'flip';
    if (lastLog.includes('barehanded')) sound = 'damage';
    else if (lastLog.includes('weapon')) sound = 'weapon';
    else if (lastLog.includes('healed')) sound = 'potion';
    else if (lastLog.includes('fled')) sound = 'run';
    else if (lastLog.includes('Equipped') || lastLog.includes('Switched'))
      sound = 'weapon';
    else if (lastLog.includes('enter')) sound = 'deal';

    audioManager.play(sound);
  }, [lastLog]);

  useEffect(() => {
    if (phase === 'won') audioManager.play('win');
    else if (phase === 'lost') audioManager.play('lose');
  }, [phase]);

  useEffect(() => {
    if (phase === 'playing' && room.length > 0 && prevLogLen.current !== log.length) {
      audioManager.play('deal');
      prevLogLen.current = log.length;
    }
  }, [room, phase, log.length]);

  function handleStart() {
    startGame();
  }

  function handleNewGame() {
    reset();
  }

  function handlePlayAgain() {
    reset();
    setTimeout(() => startGame(), 100);
  }

  return (
    <div className="min-h-screen bg-dungeon-stone flex flex-col">
      <AnimatePresence mode="wait">
        {phase === 'start' && (
          <motion.div
            key="start"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex-1 flex flex-col"
          >
            <StartScreen onStart={handleStart} />
          </motion.div>
        )}

        {phase === 'playing' && (
          <motion.div
            key="playing"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex-1 flex flex-col"
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-dungeon-border/50">
              <HealthBar health={health} />
              <DeckDisplay count={deck.length} />
            </div>

            <div className="flex-1 flex flex-col items-center justify-center gap-8 px-6 py-6">
              <RoomArea
                room={room}
                weapon={weapon}
                potionUsedThisRoom={potionUsedThisRoom}
                carriedOverCardId={carriedOverCardId}
                onFightMonster={fightMonster}
                onUsePotion={usePotion}
                onEquipWeapon={equipWeapon}
              />

              <WeaponArea weapon={weapon} />
            </div>

            <div className="px-6 py-4 border-t border-dungeon-border/50">
              <ActionBar
                canRunAway={canRunAway}
                cardsResolved={cardsResolvedThisRoom}
                onRunAway={runAway}
                onNewGame={handleNewGame}
                onToggleRules={() => setRulesOpen(true)}
              />
            </div>
          </motion.div>
        )}

        {(phase === 'won' || phase === 'lost') && (
          <motion.div
            key="end"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex-1 flex flex-col"
          >
            <EndScreen
              won={phase === 'won'}
              score={score}
              onPlayAgain={handlePlayAgain}
            />
          </motion.div>
        )}
      </AnimatePresence>

      <RulesPanel open={rulesOpen} onClose={() => setRulesOpen(false)} />
    </div>
  );
}

export default App;
