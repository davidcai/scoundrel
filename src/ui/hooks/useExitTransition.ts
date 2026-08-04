import { useEffect, useRef, useState } from "react";

export type Transitioned<T> = { item: T; key: string; exiting: boolean };

/**
 * Retains departed items briefly so an exit animation can run, since React
 * unmounts removed children immediately.
 *
 * The effect keys on a joined signature rather than the array identity, because
 * callers pass a freshly derived array on every render. `keyOf` is assumed pure
 * and stable, which is why it is not a dependency.
 */
export function useExitTransition<T>(
  items: readonly T[],
  keyOf: (item: T) => string,
  durationMs: number,
): Transitioned<T>[] {
  const [departed, setDeparted] = useState<Transitioned<T>[]>([]);
  const previous = useRef<readonly T[]>(items);
  const signature = items.map(keyOf).join("|");

  useEffect(() => {
    const currentKeys = new Set(items.map(keyOf));
    const gone = previous.current.filter((item) => !currentKeys.has(keyOf(item)));
    previous.current = items;

    // An item that came back must not linger in the exiting list.
    setDeparted((existing) => existing.filter((entry) => !currentKeys.has(entry.key)));

    if (gone.length === 0) return;

    const entries: Transitioned<T>[] = gone.map((item) => ({ item, key: keyOf(item), exiting: true }));
    setDeparted((existing) => [
      ...existing.filter((entry) => !entries.some((added) => added.key === entry.key)),
      ...entries,
    ]);

    const timer = setTimeout(() => {
      const goneKeys = new Set(entries.map((entry) => entry.key));
      setDeparted((existing) => existing.filter((entry) => !goneKeys.has(entry.key)));
    }, durationMs);

    return () => clearTimeout(timer);
  }, [signature, durationMs]);

  return [
    ...items.map((item) => ({ item, key: keyOf(item), exiting: false })),
    ...departed,
  ];
}
