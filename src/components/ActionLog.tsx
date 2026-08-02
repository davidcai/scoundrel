import type { LogEntry } from '../game/types';

interface Props {
  log: LogEntry[];
}

export default function ActionLog({ log }: Props) {
  return (
    <section className="log">
      <h3>Journal</h3>
      <ul>
        {log.slice(-12).map((entry) => (
          <li key={entry.id} className={`tone-${entry.tone}`}>
            {entry.text}
          </li>
        ))}
      </ul>
    </section>
  );
}
