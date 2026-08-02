import { useEffect, useRef } from 'react';
import type { GameState } from '../game/types';

export default function Log({ state }: { state: GameState }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.scrollTop = ref.current.scrollHeight;
  }, [state.log.length]);
  return (
    <div className="log" ref={ref}>
      {state.log.slice(-12).map((entry, i) => (
        <div key={i} className="log-line">
          {entry}
        </div>
      ))}
    </div>
  );
}