/**
 * Typed seam for the React lane's dynamic import (`await import('phaser')`):
 * keeps the ~345 KB-gzip Phaser chunk out of title/stats routes. `src/game`
 * modules must themselves only ever be imported dynamically from `src/ui`.
 */
export type PhaserModule = typeof import('phaser');

export function loadPhaser(): Promise<PhaserModule> {
  return import('phaser');
}
