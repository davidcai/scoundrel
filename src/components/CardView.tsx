import { motion } from 'framer-motion';
import type { Card } from '../game/types';
import { rankToLabel, suitToSymbol, suitIsRed, getCardType } from '../game/logic';

export type CardVariant = 'room' | 'weapon' | 'last-killed' | 'deck';

export interface CardViewProps {
  card: Card;
  variant?: CardVariant;
  faceDown?: boolean;
  resolved?: boolean;
  disabled?: boolean;
  highlight?: 'green' | 'red' | null;
  onClick?: () => void;
  layoutId?: string;
  index?: number;
}

const CARD_WIDTH = 88;
const CARD_HEIGHT = 128;

export function CardView({
  card,
  variant = 'room',
  faceDown = false,
  resolved = false,
  disabled = false,
  highlight = null,
  onClick,
  layoutId,
  index = 0,
}: CardViewProps) {
  const isRed = suitIsRed(card.suit);
  const suitColor = isRed ? 'text-suit-red' : 'text-suit-dark';
  const label = rankToLabel(card.rank);
  const symbol = suitToSymbol(card.suit);
  const cardType = getCardType(card);

  const highlightBorder =
    highlight === 'green'
      ? 'ring-2 ring-success shadow-[0_0_12px_rgba(34,197,94,0.5)]'
      : highlight === 'red'
        ? 'ring-2 ring-danger shadow-[0_0_12px_rgba(239,68,68,0.5)]'
        : '';

  const resolvedClass = resolved
    ? 'opacity-40 grayscale'
    : '';

  const disabledClass = disabled ? 'cursor-not-allowed' : 'cursor-pointer';

  if (faceDown) {
    return (
      <motion.div
        layoutId={layoutId}
        initial={{ opacity: 0, rotateY: 180 }}
        animate={{ opacity: 1, rotateY: 0 }}
        exit={{ opacity: 0, scale: 0.8 }}
        transition={{ duration: 0.3, delay: index * 0.08 }}
        style={{ width: CARD_WIDTH, height: CARD_HEIGHT }}
        className="rounded-lg bg-dungeon-border border-2 border-dungeon-stone shadow-xl flex items-center justify-center"
      >
        <div className="w-full h-full rounded-md bg-gradient-to-br from-dungeon-surface to-dungeon-stone border border-dungeon-border/50 flex items-center justify-center">
          <span className="text-dungeon-border text-2xl font-serif">⚜</span>
        </div>
      </motion.div>
    );
  }

  const typeIcon =
    cardType === 'monster' ? '⚔' : cardType === 'weapon' ? '🗡' : '✨';

  return (
    <motion.div
      layoutId={layoutId}
      initial={{ opacity: 0, y: -20, rotateY: 180 }}
      animate={{
        opacity: resolved ? 0.4 : 1,
        y: 0,
        rotateY: 0,
      }}
      exit={{ opacity: 0, scale: 0.8, y: 20 }}
      transition={{
        duration: 0.3,
        delay: index * 0.08,
        type: 'spring',
        stiffness: 300,
        damping: 24,
      }}
      style={{ width: CARD_WIDTH, height: CARD_HEIGHT }}
      onClick={disabled ? undefined : onClick}
      className={`relative rounded-lg bg-card-face border-2 border-dungeon-border/30 shadow-xl ${suitColor} ${highlightBorder} ${resolvedClass} ${disabledClass} overflow-hidden ${variant === 'weapon' ? 'ring-2 ring-amber-glow/60' : ''}`}
    >
      <div className="absolute top-1 left-1.5 flex flex-col items-center leading-none">
        <span className="text-sm font-bold">{label}</span>
        <span className="text-xs">{symbol}</span>
      </div>

      <div className="absolute bottom-1 right-1.5 flex flex-col items-center leading-none rotate-180">
        <span className="text-sm font-bold">{label}</span>
        <span className="text-xs">{symbol}</span>
      </div>

      <div className="absolute inset-0 flex items-center justify-center">
        {variant === 'last-killed' ? (
          <div className="flex flex-col items-center">
            <span className="text-2xl">{symbol}</span>
            <span className="text-[10px] text-suit-dark/60 mt-0.5">
              last slain
            </span>
          </div>
        ) : (
          <span className="text-3xl">{symbol}</span>
        )}
      </div>

      {variant === 'room' && !resolved && (
        <div className="absolute top-1 right-1 text-xs opacity-50">
          {typeIcon}
        </div>
      )}
    </motion.div>
  );
}
