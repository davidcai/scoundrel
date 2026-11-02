// @vitest-environment node
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const RANKS = ['a', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'j', 'q', 'k'];
const WEAPON_AND_POTION_RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', '10'];

const EXPECTED_CARDS = [
  ...['club', 'spade'].flatMap((suit) => RANKS.map((rank) => `${suit}-${rank}.png`)),
  ...WEAPON_AND_POTION_RANKS.flatMap((rank) => [`diamond-${rank}.png`, `heart-${rank}.png`]),
].sort();

const assetsDir = fileURLToPath(new URL('../assets', import.meta.url));
const projectDir = fileURLToPath(new URL('..', import.meta.url));
const srcDir = join(projectDir, 'src');

function readSourceFiles(): string[] {
  const srcFiles = readdirSync(srcDir, { recursive: true, encoding: 'utf8' })
    .filter((file) => /\.(ts|tsx|css)$/.test(file))
    .map((file) => readFileSync(join(srcDir, file), 'utf8'));

  const indexHtml = readFileSync(join(projectDir, 'index.html'), 'utf8');
  const viteConfig = readFileSync(join(projectDir, 'vite.config.ts'), 'utf8');

  return [...srcFiles, indexHtml, viteConfig];
}

describe('current card artwork inventory', () => {
  it('contains exactly the 44 expected current PNGs and no archived artwork', () => {
    const actual = readdirSync(assetsDir).sort();

    expect(actual).toHaveLength(44);
    expect(actual).toEqual(EXPECTED_CARDS);
    expect(actual.filter((file) => /\.(jpe?g|webp|avif)$/i.test(file))).toEqual([]);
  });

  it('does not reference archived artwork from application source', () => {
    for (const source of readSourceFiles()) {
      expect(source).not.toMatch(/assets-old/i);
      expect(source).not.toMatch(/\.jpe?g/i);
    }
  });
});
