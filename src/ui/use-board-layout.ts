import { useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { computeBoardLayout, type Rect } from '../game/board-layout';
import { readRoomMetrics } from '../game/board-metrics';

/**
 * DOM hit-layer geometry (Phase 2): ResizeObserver on the `.room` element →
 * measured box + `readRoomMetrics` (the SAME metrics path the Phaser scene
 * uses) → `computeBoardLayout` → per-card rects + the height the room needs
 * so every row (mobile 2×2 wrap) is fully visible.
 *
 * Consumers position the hit-layer buttons at these rects; the scene positions
 * sprites from the identical function+metrics, so the two agree to the pixel.
 * The rects are only consumed in canvas-live mode (fallback renders today's
 * flex layout untouched), which also keeps the RTL/jsdom suite unaffected —
 * there `ResizeObserver` does not exist and the view stays empty.
 */

/** Mirrors styles.css `.room { min-height: calc(var(--card-h) + 36px) }`. */
const ROOM_MIN_HEIGHT_EXTRA = 36;

export interface BoardLayoutView {
  /** One rect per room card, in `.room` border-box coordinates. */
  rects: Rect[];
  /** Inline height for `.room` in canvas-live mode: layout height vs the CSS min-height floor. */
  roomHeight: number;
  cardWidth: number;
  cardHeight: number;
  columns: number;
  rows: number;
  gap: number;
  /** False until the first ResizeObserver measurement (jsdom / pre-observe). */
  measured: boolean;
}

const EMPTY_VIEW: BoardLayoutView = {
  rects: [],
  roomHeight: 0,
  cardWidth: 0,
  cardHeight: 0,
  columns: 0,
  rows: 0,
  gap: 0,
  measured: false,
};

export function useBoardLayout(
  roomRef: RefObject<HTMLElement | null>,
  cardCount: number,
): BoardLayoutView {
  const [box, setBox] = useState<{ width: number; height: number } | null>(null);
  const observerRef = useRef<ResizeObserver | null>(null);

  useEffect(() => {
    const room = roomRef.current;
    if (room === null || typeof ResizeObserver === 'undefined') return;
    if (observerRef.current === null) {
      observerRef.current = new ResizeObserver(() => {
        const rect = room.getBoundingClientRect();
        setBox((prev) =>
          prev !== null && prev.width === rect.width && prev.height === rect.height
            ? prev
            : { width: rect.width, height: rect.height },
        );
      });
    }
    const observer = observerRef.current;
    observer.observe(room); // fires an initial measurement on observe
    return () => {
      observer.unobserve(room);
    };
  }, [roomRef, cardCount]);
  // cardCount in deps: the room element mounts when the run starts (count 0→4);
  // re-running the (idempotent) observation then is what catches the mount.

  useEffect(
    () => () => {
      observerRef.current?.disconnect();
      observerRef.current = null;
    },
    [],
  );

  return useMemo(() => {
    if (box === null) return EMPTY_VIEW;
    const layout = computeBoardLayout(
      box.width,
      box.height,
      cardCount,
      readRoomMetrics(roomRef.current),
    );
    return {
      rects: layout.roomRects,
      roomHeight: Math.max(layout.totalHeight, layout.cardHeight + ROOM_MIN_HEIGHT_EXTRA),
      cardWidth: layout.cardWidth,
      cardHeight: layout.cardHeight,
      columns: layout.columns,
      rows: layout.rows,
      gap: layout.gap,
      measured: true,
    };
  }, [box, cardCount, roomRef]);
}
