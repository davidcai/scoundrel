import { motion } from 'framer-motion';
import { MAX_HEALTH } from '../game/logic';

interface HealthBarProps {
  health: number;
}

export function HealthBar({ health }: HealthBarProps) {
  const pct = Math.max(0, Math.min(100, (health / MAX_HEALTH) * 100));
  const color =
    health > 12 ? 'bg-health' : health > 6 ? 'bg-amber-400' : 'bg-danger';

  return (
    <div className="flex items-center gap-2">
      <span className="text-text-secondary text-sm font-medium">HP</span>
      <div className="relative w-48 h-6 rounded-full bg-dungeon-stone border border-dungeon-border overflow-hidden">
        <motion.div
          className={`absolute inset-y-0 left-0 ${color} rounded-full`}
          initial={false}
          animate={{ width: `${pct}%` }}
          transition={{ type: 'spring', stiffness: 200, damping: 20 }}
        />
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-xs font-bold text-white drop-shadow-md">
            {Math.max(0, health)} / {MAX_HEALTH}
          </span>
        </div>
      </div>
    </div>
  );
}
