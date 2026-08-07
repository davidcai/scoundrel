interface DeckDisplayProps {
  count: number;
}

export function DeckDisplay({ count }: DeckDisplayProps) {
  return (
    <div className="flex items-center gap-2">
      <div className="relative" style={{ width: 36, height: 52 }}>
        {count > 0 && (
          <>
            <div
              className="absolute rounded-md bg-gradient-to-br from-dungeon-surface to-dungeon-stone border border-dungeon-border/50"
              style={{ width: 36, height: 52, top: 2, left: 2 }}
            />
            <div
              className="absolute rounded-md bg-gradient-to-br from-dungeon-surface to-dungeon-stone border border-dungeon-border/50"
              style={{ width: 36, height: 52, top: 1, left: 1 }}
            />
            <div
              className="absolute rounded-md bg-gradient-to-br from-dungeon-surface to-dungeon-stone border border-dungeon-border/50 flex items-center justify-center"
              style={{ width: 36, height: 52, top: 0, left: 0 }}
            >
              <span className="text-dungeon-border text-sm font-serif">⚜</span>
            </div>
          </>
        )}
      </div>
      <div className="flex flex-col">
        <span className="text-text-secondary text-xs uppercase tracking-wide">
          Deck
        </span>
        <span className="text-text-primary text-lg font-bold">{count}</span>
      </div>
    </div>
  );
}
