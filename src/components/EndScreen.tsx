import { motion } from 'framer-motion';

interface EndScreenProps {
  won: boolean;
  score: number;
  onPlayAgain: () => void;
}

export function EndScreen({ won, score, onPlayAgain }: EndScreenProps) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-6">
      <motion.div
        initial={{ opacity: 0, y: -30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="text-center"
      >
        <h1
          className={`text-5xl font-bold mb-2 ${
            won ? 'text-success' : 'text-danger'
          }`}
        >
          {won ? 'Dungeon Cleared!' : 'You Perished'}
        </h1>
        <p className="text-text-secondary text-lg">
          {won
            ? 'You survived the dungeon against all odds.'
            : 'The dungeon claims another soul...'}
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.3, type: 'spring', stiffness: 200 }}
        className="bg-dungeon-surface border border-dungeon-border rounded-xl px-8 py-6 text-center"
      >
        <div className="text-text-secondary text-sm uppercase tracking-wide mb-1">
          Final Score
        </div>
        <div
          className={`text-5xl font-bold ${
            score > 0 ? 'text-health' : 'text-danger'
          }`}
        >
          {score}
        </div>
      </motion.div>

      <motion.button
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6 }}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={onPlayAgain}
        className="px-8 py-3 rounded-xl bg-amber-glow/20 border-2 border-amber-glow/50 text-amber-glow text-lg font-semibold hover:bg-amber-glow/30 transition-colors cursor-pointer"
      >
        Play Again
      </motion.button>
    </div>
  );
}
