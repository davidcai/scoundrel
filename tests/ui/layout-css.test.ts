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
    const bar = block(/^\.action-bar \{[\s\S]*?\n\}/m);
    expect(bar).toContain('min-height: 72px');
    expect(bar).toContain('align-items: center');
    expect(bar).not.toContain('position: sticky');
    expect(bar).not.toContain('position: fixed');
  });

  it('keeps the metadata in the markup for the room cards', () => {
    expect(css).toMatch(/\.card__meta \{\s*display: none/);
  });

  it('drops the empty room-actions divider', () => {
    expect(css).toMatch(/\.preview__room-actions:empty\s*\{[^}]*border-top:\s*0/);
    expect(css).toMatch(/\.preview__room-actions:empty\s*\{[^}]*padding-top:\s*0/);
  });

  it('lets the play main body use the full content width', () => {
    const main = block(/^\.play-main \{[\s\S]*?\n\}/m);
    expect(main).toContain('max-width: 1440px');
  });

  it('lets the play room shrink and grow without horizontal scrolling', () => {
    const grid = block(/^\.room-grid \{[\s\S]*?\n\}/m);
    expect(grid).toContain('grid-template-columns: repeat(4, minmax(0, 1fr))');
    expect(grid).not.toContain('max-width');
    expect(css).not.toContain('min-width: 1000px');
    expect(css).not.toContain('@container');
    expect(css).not.toMatch(/@media \(max-width: 767px\)[\s\S]*?\.play-main/);
  });

  it('uses a two-column medium layout with the dungeon count in the header', () => {
    expect(css).not.toContain('.play-main__dungeon');
    expect(css).not.toContain('.dungeon-chip');
    expect(block(/\.dungeon-status \{[\s\S]*?\n\}/)).toContain('display: inline-flex');
    expect(block(/^\.play-screen__seed \{[\s\S]*?\n\}/m)).toContain('position: fixed');
  });

  it('keeps a 44px icon close for dialogs', () => {
    const close = block(/\.dialog__close \{[\s\S]*?\n\}/);
    expect(close).toContain('width: 44px');
    expect(close).toContain('height: 44px');
  });

  it('uses the approved §5 data tables and §6 section headings', () => {
    const scroll = block(/\.table-scroll \{[\s\S]*?\n\}/);
    expect(scroll).toContain('border: 1px solid var(--border-2)');
    expect(scroll).toContain('border-radius: var(--radius-3)');

    const head = block(/\.data-table thead th \{[\s\S]*?\n\}/);
    expect(head).toContain('border-bottom: 2px solid var(--border-2)');
    expect(head).toContain('background: var(--surface-2)');

    expect(block(/\.data-table tbody tr:hover \{[\s\S]*?\n\}/)).toContain('var(--surface-2)');
    const numeric = block(/\.data-table__numeric \{[\s\S]*?\n\}/);
    expect(numeric).toContain('text-align: right');
    expect(numeric).toContain('tabular-nums');
    expect(block(/\.history-table__date \{[\s\S]*?\n\}/)).toContain('nowrap');

    expect(block(/\.screen-panel__section-title \{[\s\S]*?\n\}/)).toContain(
      'font-size: var(--text-h2)',
    );
    expect(block(/\.result-panel__section-title \{[\s\S]*?\n\}/)).toContain(
      'font-size: var(--text-h2)',
    );
  });

  it('styles selected toggles, token checkboxes, danger and the stat grid', () => {
    const pressed = block(/\.language-toggle \.button\[aria-pressed='true'\] \{[\s\S]*?\n\}/);
    expect(pressed).toContain('background: var(--surface-3)');
    expect(pressed).toContain('box-shadow: inset 0 0 0 1px var(--border-2)');

    const checkbox = block(/\.rule-option input,[\s\S]*?\{\n[\s\S]*?\n\}/);
    expect(checkbox).toContain('width: 24px');
    expect(checkbox).toContain('height: 24px');
    expect(checkbox).toContain('appearance: none');

    const danger = block(/\.button--danger \{[\s\S]*?\n\}/);
    expect(danger).toContain('border-color: var(--damage)');

    expect(block(/\.stat-grid \{[\s\S]*?\n\}/)).toContain(
      'grid-template-columns: repeat(4, minmax(0, 1fr))',
    );
    expect(css).toMatch(
      /@media \(max-width: 1199px\) \{\s*\.stat-grid \{\s*grid-template-columns: repeat\(2, minmax\(0, 1fr\)\);/,
    );
    expect(css).toMatch(
      /@media \(max-width: 767px\) \{\s*\.stat-grid \{\s*grid-template-columns: minmax\(0, 1fr\);/,
    );
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
