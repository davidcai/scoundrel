import { motion, AnimatePresence } from 'framer-motion';
import { CardView } from './CardView';
import type { RoomCard, WeaponState, Card } from '../game/types';
import { getCardType, canWeaponFightMonster } from '../game/logic';
import { useState } from 'react';

interface RoomAreaProps {
  room: RoomCard[];
  weapon: WeaponState | null;
  potionUsedThisRoom: boolean;
  carriedOverCardId: string | null;
  onFightMonster: (index: number, useWeapon: boolean) => void;
  onUsePotion: (index: number) => void;
  onEquipWeapon: (index: number) => void;
}

export function RoomArea({
  room,
  weapon,
  potionUsedThisRoom,
  carriedOverCardId,
  onFightMonster,
  onUsePotion,
  onEquipWeapon,
}: RoomAreaProps) {
  const [selectedMonster, setSelectedMonster] = useState<number | null>(null);
  const [confirmWeaponReplace, setConfirmWeaponReplace] = useState<number | null>(
    null,
  );

  function handleCardClick(rc: RoomCard, index: number) {
    if (rc.status !== 'unresolved') return;
    const type = getCardType(rc.card);

    if (type === 'monster') {
      setSelectedMonster(selectedMonster === index ? null : index);
      setConfirmWeaponReplace(null);
    } else if (type === 'potion') {
      if (!potionUsedThisRoom) {
        onUsePotion(index);
      }
    } else if (type === 'weapon') {
      if (weapon) {
        setConfirmWeaponReplace(
          confirmWeaponReplace === index ? null : index,
        );
      } else {
        onEquipWeapon(index);
      }
    }
  }

  function getHighlight(rc: RoomCard): 'green' | 'red' | null {
    if (rc.status !== 'unresolved') return null;
    const type = getCardType(rc.card);
    if (type !== 'monster') return null;
    if (!weapon) return null;
    return canWeaponFightMonster(weapon.lastKilledValue, rc.card.rank)
      ? 'green'
      : 'red';
  }

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="flex gap-3 justify-center items-start relative">
        <AnimatePresence mode="popLayout">
          {room.map((rc, index) => {
            const isCarryOver =
              carriedOverCardId === rc.card.id && rc.status === 'unresolved';
            const type = getCardType(rc.card);
            const isPotionDisabled =
              type === 'potion' && potionUsedThisRoom && rc.status === 'unresolved';

            return (
              <div key={rc.card.id} className="relative flex flex-col items-center">
                {isCarryOver && (
                  <span className="absolute -top-6 text-xs text-amber-glow font-medium whitespace-nowrap">
                    carried over
                  </span>
                )}
                <CardView
                  card={rc.card}
                  variant="room"
                  resolved={rc.status === 'resolved'}
                  disabled={
                    rc.status === 'resolved' || isPotionDisabled
                  }
                  highlight={getHighlight(rc)}
                  onClick={() => handleCardClick(rc, index)}
                  layoutId={`room-${rc.card.id}`}
                  index={index}
                />

                <AnimatePresence>
                  {selectedMonster === index && rc.status === 'unresolved' && (
                    <motion.div
                      initial={{ opacity: 0, y: -10, height: 0 }}
                      animate={{ opacity: 1, y: 0, height: 'auto' }}
                      exit={{ opacity: 0, y: -10, height: 0 }}
                      transition={{ duration: 0.2 }}
                      className="absolute top-full mt-2 z-20"
                    >
                      <ChoicePanel
                        card={rc.card}
                        weapon={weapon}
                        onFightBarehanded={() => {
                          onFightMonster(index, false);
                          setSelectedMonster(null);
                        }}
                        onFightWithWeapon={() => {
                          onFightMonster(index, true);
                          setSelectedMonster(null);
                        }}
                      />
                    </motion.div>
                  )}
                </AnimatePresence>

                <AnimatePresence>
                  {confirmWeaponReplace === index &&
                    rc.status === 'unresolved' && (
                      <motion.div
                        initial={{ opacity: 0, y: -10, height: 0 }}
                        animate={{ opacity: 1, y: 0, height: 'auto' }}
                        exit={{ opacity: 0, y: -10, height: 0 }}
                        transition={{ duration: 0.2 }}
                        className="absolute top-full mt-2 z-20"
                      >
                        <WeaponReplacePanel
                          currentWeapon={weapon}
                          newCard={rc.card}
                          onConfirm={() => {
                            onEquipWeapon(index);
                            setConfirmWeaponReplace(null);
                          }}
                          onCancel={() => setConfirmWeaponReplace(null)}
                        />
                      </motion.div>
                    )}
                </AnimatePresence>
              </div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}

interface ChoicePanelProps {
  card: Card;
  weapon: WeaponState | null;
  onFightBarehanded: () => void;
  onFightWithWeapon: () => void;
}

function ChoicePanel({
  card,
  weapon,
  onFightBarehanded,
  onFightWithWeapon,
}: ChoicePanelProps) {
  const barehandedDamage = card.rank;
  const weaponCanFight =
    weapon && canWeaponFightMonster(weapon.lastKilledValue, card.rank);
  const weaponDamage = weapon
    ? Math.max(0, card.rank - weapon.card.rank)
    : barehandedDamage;

  return (
    <div className="bg-dungeon-surface border border-dungeon-border rounded-lg p-3 shadow-2xl min-w-[180px]">
      <div className="text-xs text-text-secondary mb-2 text-center">
        Choose your attack
      </div>
      <div className="flex flex-col gap-2">
        {weaponCanFight && (
          <button
            onClick={onFightWithWeapon}
            className="flex items-center justify-between gap-2 px-3 py-2 rounded-md bg-success/20 border border-success/50 hover:bg-success/30 transition-colors text-left"
          >
            <span className="text-sm text-text-primary">🗡 Weapon</span>
            <span
              className={`text-xs font-bold ${weaponDamage === 0 ? 'text-success' : 'text-amber-glow'}`}
            >
              {weaponDamage === 0 ? 'No damage' : `-${weaponDamage} HP`}
            </span>
          </button>
        )}
        <button
          onClick={onFightBarehanded}
          className={`flex items-center justify-between gap-2 px-3 py-2 rounded-md border transition-colors text-left ${
            weaponCanFight
              ? 'bg-danger/10 border-danger/30 hover:bg-danger/20'
              : 'bg-danger/20 border-danger/50 hover:bg-danger/30'
          }`}
        >
          <span className="text-sm text-text-primary">✊ Barehanded</span>
          <span className="text-xs font-bold text-danger">
            -{barehandedDamage} HP
          </span>
        </button>
      </div>
    </div>
  );
}

interface WeaponReplacePanelProps {
  currentWeapon: WeaponState | null;
  newCard: Card;
  onConfirm: () => void;
  onCancel: () => void;
}

function WeaponReplacePanel({
  currentWeapon,
  newCard,
  onConfirm,
  onCancel,
}: WeaponReplacePanelProps) {
  return (
    <div className="bg-dungeon-surface border border-dungeon-border rounded-lg p-3 shadow-2xl min-w-[200px]">
      <div className="text-xs text-text-secondary mb-2 text-center">
        Replace your weapon?
      </div>
      {currentWeapon && currentWeapon.defeatedMonsters.length > 0 && (
        <div className="text-xs text-danger mb-2 text-center">
          Loses {currentWeapon.defeatedMonsters.length} defeated monster(s)
        </div>
      )}
      <div className="flex gap-2">
        <button
          onClick={onConfirm}
          className="flex-1 px-3 py-2 rounded-md bg-amber-glow/20 border border-amber-glow/50 hover:bg-amber-glow/30 text-sm text-text-primary transition-colors"
        >
          Equip {newCard.rank}
        </button>
        <button
          onClick={onCancel}
          className="px-3 py-2 rounded-md bg-dungeon-stone border border-dungeon-border hover:bg-dungeon-border/30 text-sm text-text-secondary transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
