import { useEffect, useRef } from 'react';
import type { LogEntry, LogKind } from '../engine/types';

interface EventLogProps {
  log: LogEntry[];
}

function kindClass(kind: LogKind): string {
  switch (kind) {
    case 'damage':
      return 'log-damage';
    case 'heal':
      return 'log-heal';
    case 'combat':
      return 'log-combat';
    case 'system':
      return 'log-system';
    case 'info':
      return 'log-info';
  }
}

export default function EventLog({ log }: EventLogProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [log]);

  return (
    <div className="event-log">
      <h3 className="event-log-title">Tale of the Dungeon</h3>
      <div className="event-log-entries">
        {log.map((entry) => (
          <div
            key={entry.id}
            className={`event-log-entry ${kindClass(entry.kind)}`}
          >
            {entry.text}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
