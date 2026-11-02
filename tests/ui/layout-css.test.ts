import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Structural guards for the approved layout rules that jsdom cannot compute.
 * Visual behaviour is also verified with headless-Chrome screenshots; these
 * assertions stop a future stylesheet edit from silently dropping a fix.
 */
const css = readFileSync(join(process.cwd(), 'src', 'styles.css'), 'utf8');

function block(match: RegExp): string {
  const found = css.match(match);
  expect(found, `missing stylesheet block ${String(match)}`).not.toBeNull();
  return found?.[0] ?? '';
}

describe('approved layout rules', () => {
  it('keeps the wide action bar a single 72px row with visible reasons', () => {
    const bar = block(/\.action-bar \{[\s\S]*?\n\}/);
    expect(bar).toContain('min-height: 72px');
    expect(bar).toContain('align-items: center');
    expect(css).not.toMatch(/\.action-bar__reason\s*\{[^}]*display:\s*none/);
    const compactBar = block(
      /@media \(max-width: 767px\) \{[\s\S]*?\.action-bar \{[\s\S]*?\n {2}\}/,
    );
    expect(compactBar).toContain('z-index: 60');
    expect(compactBar).not.toContain('display: none');
    const compactActions = block(
      /@media \(max-width: 767px\) \{[\s\S]*?\.action-bar__actions \{[\s\S]*?\n {2}\}/,
    );
    expect(compactActions).toContain('grid-template-columns: repeat(2, minmax(0, 1fr))');
  });

  it('uses the approved card track clamps and the 2×2 / metadata fallbacks', () => {
    expect(css).toContain('--card-track-wide: clamp(160px, 14vw, 200px)');
    expect(css).toContain('--card-track-medium: clamp(140px, 30vw, 180px)');
    expect(css).toContain('--card-track-compact: clamp(132px, 40vw, 168px)');
    expect(css).toContain('@container (max-width: 699px)');
    expect(block(/@media \(max-width: 359px\) \{[\s\S]*?\n\}/)).toContain('.card__meta');
    expect(css).toMatch(/\.card__meta \{\s*display: none/);
  });

  it('uses a two-column medium layout with the dungeon count in the header', () => {
    const mediumBlocks = Array.from(css.matchAll(/@media \(max-width: 1199px\) \{[\s\S]*?\n\}/g))
      .map((match) => match[0])
      .join('\n');
    expect(mediumBlocks).toContain('grid-template-columns: minmax(180px, 240px) minmax(0, 1fr)');
    expect(mediumBlocks).toContain('.play-main__dungeon');
    expect(mediumBlocks).toContain('display: none');
    expect(block(/\.dungeon-chip \{[\s\S]*?\n\}/)).toContain('min-width: 44px');
  });

  it('places the compact preview sheet above the fixed action bar', () => {
    const sheet = block(/\.dialog__panel--sheet \{[\s\S]*?\n\}/);
    expect(sheet).toContain('bottom: var(--action-bar-height');
    const close = block(/\.dialog__close \{[\s\S]*?\n\}/);
    expect(close).toContain('width: 44px');
    expect(close).toContain('height: 44px');
  });

  it('keeps the approved title treatment and visible focus', () => {
    expect(block(/\.title-screen__art-card \{[\s\S]*?\n {2}\}/)).toContain('opacity: 0.16');
    expect(block(/\.language-toggle \{[\s\S]*?\n\}/)).toContain(
      'border: 1px solid var(--border-2)',
    );
    const wordmark = block(/\.title-screen__wordmark:focus-visible \{[\s\S]*?\n\}/);
    expect(wordmark).toContain('outline: 2px solid var(--focus)');
    expect(wordmark).not.toContain('outline: none');
  });
});
