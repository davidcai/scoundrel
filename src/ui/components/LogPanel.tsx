import { useEffect, useRef } from 'react';

export function LogPanel({ log }: { log: string[] }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [log.length]);
  return (
    <div className="log-panel" ref={ref} aria-live="polite">
      {log.map((entry, i) => (
        <p key={i} className="log-entry">
          {entry}
        </p>
      ))}
    </div>
  );
}
