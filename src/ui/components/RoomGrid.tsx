import { useEffect, useRef, useState, type KeyboardEvent, type RefObject } from 'react';
import { usePreferences } from '../../store/preferences';
import type { CardView } from '../../store/selectors';
import { CardTile } from './CardTile';

export interface RoomGridProps {
  views: readonly CardView[];
  onSelect: (card: CardView['card']) => void;
  firstCardRef?: RefObject<HTMLButtonElement | null>;
}

/**
 * The four room cards as one tab stop (roving tabindex): arrow keys move within
 * the grid, Home/End jump to the ends, and Enter/Space select (design plan §7).
 */
export function RoomGrid({ views, onSelect, firstCardRef }: RoomGridProps) {
  const { t } = usePreferences();
  const buttons = useRef<Array<HTMLButtonElement | null>>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const signature = views.map((view) => view.card).join('|');

  useEffect(() => {
    setActiveIndex(0);
  }, [signature]);

  const focusAt = (index: number) => {
    if (views.length === 0) return;
    const next = Math.min(Math.max(index, 0), views.length - 1);
    setActiveIndex(next);
    buttons.current[next]?.focus();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const last = views.length - 1;
    switch (event.key) {
      case 'ArrowLeft':
      case 'ArrowUp':
        event.preventDefault();
        focusAt(index === 0 ? last : index - 1);
        break;
      case 'ArrowRight':
      case 'ArrowDown':
        event.preventDefault();
        focusAt(index === last ? 0 : index + 1);
        break;
      case 'Home':
        event.preventDefault();
        focusAt(0);
        break;
      case 'End':
        event.preventDefault();
        focusAt(last);
        break;
      default:
        break;
    }
  };

  return (
    <div className="room-grid" role="group" aria-label={t('a11y.roomCards')}>
      {views.map((view, index) => (
        <CardTile
          key={view.card}
          ref={(element) => {
            buttons.current[index] = element;
            if (index === 0 && firstCardRef !== undefined) firstCardRef.current = element;
          }}
          view={view}
          tabIndex={index === activeIndex ? 0 : -1}
          onSelect={onSelect}
          onFocus={() => setActiveIndex(index)}
          onKeyDown={(event) => handleKeyDown(event, index)}
        />
      ))}
    </div>
  );
}
