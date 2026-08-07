import { motion, AnimatePresence } from 'framer-motion';

interface ActionBarProps {
  canRunAway: boolean;
  cardsResolved: number;
  onRunAway: () => void;
  onNewGame: () => void;
  onToggleRules: () => void;
}

export function ActionBar({
  canRunAway,
  cardsResolved,
  onRunAway,
  onNewGame,
  onToggleRules,
}: ActionBarProps) {
  return (
    <div className="flex items-center gap-3">
      <button
        onClick={onRunAway}
        disabled={!canRunAway || cardsResolved > 0}
        className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
          canRunAway && cardsResolved === 0
            ? 'bg-amber-glow/20 border-amber-glow/50 text-amber-glow hover:bg-amber-glow/30 cursor-pointer'
            : 'bg-dungeon-stone border-dungeon-border text-text-secondary/40 cursor-not-allowed'
        }`}
        title={
          !canRunAway
            ? 'Cannot run from two rooms in a row'
            : cardsResolved > 0
              ? 'Cannot run after resolving a card'
              : 'Send all cards to bottom of deck'
        }
      >
        Run Away
      </button>

      <button
        onClick={onNewGame}
        className="px-4 py-2 rounded-lg text-sm font-medium border bg-dungeon-stone border-dungeon-border text-text-secondary hover:bg-dungeon-border/30 hover:text-text-primary transition-colors cursor-pointer"
      >
        New Game
      </button>

      <div className="flex-1" />

      <button
        onClick={onToggleRules}
        className="w-9 h-9 flex items-center justify-center rounded-lg text-sm font-bold border bg-dungeon-stone border-dungeon-border text-text-secondary hover:bg-dungeon-border/30 hover:text-text-primary transition-colors cursor-pointer"
        title="Show rules"
      >
        ?
      </button>
    </div>
  );
}

interface RulesPanelProps {
  open: boolean;
  onClose: () => void;
}

export function RulesPanel({ open, onClose }: RulesPanelProps) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 24 }}
            className="bg-dungeon-surface border border-dungeon-border rounded-xl p-6 max-w-2xl max-h-[80vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-text-primary">
                Scoundrel Rules
              </h2>
              <button
                onClick={onClose}
                className="w-8 h-8 flex items-center justify-center rounded-lg bg-dungeon-stone border border-dungeon-border text-text-secondary hover:text-text-primary transition-colors"
              >
                ✕
              </button>
            </div>
            <div className="space-y-3 text-sm text-text-secondary">
              <div>
                <h3 className="text-text-primary font-semibold mb-1">
                  Objective
                </h3>
                Clear all 44 cards from the dungeon deck. Your score is your
                remaining health (max 20).
              </div>
              <div>
                <h3 className="text-text-primary font-semibold mb-1">
                  Card Types
                </h3>
                <ul className="space-y-1 ml-4">
                  <li>
                    ♠ ♣ Monsters — inflict damage equal to their value when
                    fought
                  </li>
                  <li>
                    ♦ Weapons — reduce damage taken. Weapon value is subtracted
                    from monster value
                  </li>
                  <li>
                    ♥ Health Potions — restore HP equal to card value, capped at
                    20
                  </li>
                </ul>
              </div>
              <div>
                <h3 className="text-text-primary font-semibold mb-1">
                  Playing a Room
                </h3>
                <ul className="space-y-1 ml-4">
                  <li>4 cards are dealt face-up to form a Room</li>
                  <li>Resolve 3 of 4 cards in any order</li>
                  <li>The 4th card carries over to the next room</li>
                </ul>
              </div>
              <div>
                <h3 className="text-text-primary font-semibold mb-1">
                  Combat
                </h3>
                <ul className="space-y-1 ml-4">
                  <li>Barehanded: take full monster damage</li>
                  <li>
                    With weapon: damage = monster value - weapon value
                    (minimum 0)
                  </li>
                  <li>
                    Weapon degradation: after killing a monster, the weapon can
                    only fight weaker monsters
                  </li>
                  <li>
                    Picking up a new weapon discards your current one
                  </li>
                </ul>
              </div>
              <div>
                <h3 className="text-text-primary font-semibold mb-1">
                  Other Rules
                </h3>
                <ul className="space-y-1 ml-4">
                  <li>Only one health potion per room — extras are wasted</li>
                  <li>
                    Run away: once per room, send all 4 cards to the bottom of
                    the deck. Cannot run twice in a row
                  </li>
                  <li>
                    If health reaches 0, you lose. Score is the negative sum of
                    remaining monsters
                  </li>
                </ul>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export { ActionBar as default };
