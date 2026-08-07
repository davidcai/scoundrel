import { motion, AnimatePresence } from 'framer-motion';
import { CardView } from './CardView';
import type { WeaponState } from '../game/types';
import { rankToLabel, suitToSymbol } from '../game/logic';

interface WeaponAreaProps {
  weapon: WeaponState | null;
}

export function WeaponArea({ weapon }: WeaponAreaProps) {
  return (
    <div className="flex flex-col items-center gap-2 min-h-[140px]">
      <AnimatePresence mode="wait">
        {weapon ? (
          <motion.div
            key="weapon-equipped"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ duration: 0.3 }}
            className="flex flex-col items-center gap-3"
          >
            <div className="text-xs text-amber-glow uppercase tracking-wide font-medium">
              Equipped Weapon
            </div>
            <div className="flex items-end gap-4">
              <div className="flex flex-col items-center gap-1">
                <CardView
                  card={weapon.card}
                  variant="weapon"
                  layoutId={`weapon-${weapon.card.id}`}
                />
                <span className="text-xs text-text-secondary">
                  power {weapon.card.rank}
                </span>
              </div>
              <div className="flex flex-col items-center gap-1">
                {weapon.lastKilledValue ? (
                  <>
                    <CardView
                      card={{
                        id: `last-killed-${weapon.lastKilledValue}`,
                        suit: weapon.defeatedMonsters[
                          weapon.defeatedMonsters.length - 1
                        ]?.suit ?? 'clubs',
                        rank: weapon.lastKilledValue,
                      }}
                      variant="last-killed"
                      layoutId={`last-killed-${weapon.lastKilledValue}`}
                    />
                    <span className="text-xs text-text-secondary">
                      max target {rankToLabel(weapon.lastKilledValue)}
                    </span>
                  </>
                ) : (
                  <div
                    className="flex items-center justify-center rounded-lg border-2 border-dashed border-dungeon-border/40 bg-dungeon-stone/50"
                    style={{ width: 88, height: 128 }}
                  >
                    <span className="text-xs text-text-secondary/60 text-center px-2">
                      no kills yet
                    </span>
                  </div>
                )}
              </div>
            </div>
            {weapon.defeatedMonsters.length > 0 && (
              <div className="flex items-center gap-1.5">
                {weapon.defeatedMonsters.map((m, i) => (
                  <span
                    key={`${m.id}-${i}`}
                    className="text-xs bg-dungeon-stone border border-dungeon-border rounded px-1.5 py-0.5 text-text-secondary"
                  >
                    {rankToLabel(m.rank)}
                    {suitToSymbol(m.suit)}
                  </span>
                ))}
              </div>
            )}
          </motion.div>
        ) : (
          <motion.div
            key="no-weapon"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center gap-2"
          >
            <div
              className="flex items-center justify-center rounded-lg border-2 border-dashed border-dungeon-border/40 bg-dungeon-stone/50"
              style={{ width: 88, height: 128 }}
            >
              <span className="text-xs text-text-secondary/60 text-center px-2">
                No weapon
              </span>
            </div>
            <span className="text-xs text-text-secondary/60">
              Equip a ♦ to reduce damage
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
