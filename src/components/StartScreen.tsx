import { motion } from 'framer-motion';

interface StartScreenProps {
  onStart: () => void;
}

export function StartScreen({ onStart }: StartScreenProps) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-8">
      <motion.div
        initial={{ opacity: 0, y: -30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="text-center"
      >
        <h1 className="text-6xl font-bold text-text-primary mb-2 tracking-tight">
          Scoundrel
        </h1>
        <p className="text-text-secondary text-lg">
          A roguelike dungeon-crawling card game
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3, duration: 0.6 }}
        className="flex gap-2"
      >
        {['♠', '♥', '♦', '♣'].map((suit, i) => (
          <motion.span
            key={suit}
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: 0.4, scale: 1 }}
            transition={{
              delay: 0.5 + i * 0.15,
              type: 'spring',
              stiffness: 200,
            }}
            className={`text-5xl ${
              suit === '♥' || suit === '♦'
                ? 'text-suit-red'
                : 'text-text-secondary'
            }`}
          >
            {suit}
          </motion.span>
        ))}
      </motion.div>

      <motion.button
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 1, type: 'spring', stiffness: 200 }}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={onStart}
        className="px-8 py-3 rounded-xl bg-amber-glow/20 border-2 border-amber-glow/50 text-amber-glow text-lg font-semibold hover:bg-amber-glow/30 transition-colors cursor-pointer"
      >
        Enter the Dungeon
      </motion.button>
    </div>
  );
}
