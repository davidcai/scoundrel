import { describe, expect, it, vi } from 'vitest';
import type { CardId } from '../../src/engine';
import type { CardView } from '../../src/store/selectors';
import { CardTile } from '../../src/ui/components/CardTile';
import { createTestStore, renderWithProviders } from '../helpers/render';

function makeView(overrides: Partial<CardView> & Pick<CardView, 'card' | 'kind'>): CardView {
  const base: CardView = {
    card: overrides.card,
    index: 1,
    total: 4,
    kind: overrides.kind,
    value: 5,
    carried: false,
    selected: false,
    reason: null,
  };
  return { ...base, ...overrides };
}

function tileProps(view: CardView) {
  return {
    view,
    tabIndex: 0,
    onSelect: vi.fn(),
    onFocus: vi.fn(),
    onKeyDown: vi.fn(),
  };
}

function captions(container: HTMLElement): Array<string | null> {
  return Array.from(container.querySelectorAll('.card__caption')).map((node) => node.textContent);
}

describe('room card captions', () => {
  it('shows the card type instead of the position', () => {
    const monster = makeView({ card: 'club-5' as CardId, kind: 'monster' });
    const weapon = makeView({ card: 'diamond-5' as CardId, kind: 'weapon', selected: true });
    const potion = makeView({ card: 'heart-4' as CardId, kind: 'potion', carried: true });
    const { container } = renderWithProviders(
      <>
        <CardTile {...tileProps(monster)} />
        <CardTile {...tileProps(weapon)} />
        <CardTile {...tileProps(potion)} />
      </>,
    );

    expect(captions(container)).toEqual(['Monster', 'Weapon', 'Potion']);
    expect(container.textContent).not.toMatch(/Card \d+ of \d+|Selected/);

    const buttons = Array.from(container.querySelectorAll<HTMLButtonElement>('[data-card]'));
    expect(buttons[0]!.getAttribute('aria-label')).toBe('Monster, Five of clubs');
    // State stays announced for assistive technology without appearing in the caption.
    expect(buttons[1]!.getAttribute('aria-label')).toBe('Weapon, Five of diamonds · Selected');
    expect(buttons[2]!.getAttribute('aria-label')).toBe('Potion, Four of hearts · Carried');
  });

  it('uses localized type labels and the locale separator in Simplified Chinese', () => {
    const store = createTestStore();
    store.updateSettings({ locale: 'zh-Hans' });
    const monster = makeView({ card: 'club-5' as CardId, kind: 'monster', selected: true });
    const potion = makeView({ card: 'heart-4' as CardId, kind: 'potion', carried: true });
    const { container } = renderWithProviders(
      <>
        <CardTile {...tileProps(monster)} />
        <CardTile {...tileProps(potion)} />
      </>,
      { store },
    );

    expect(captions(container)).toEqual(['怪物', '药水']);
    for (const caption of captions(container)) {
      expect(caption).not.toMatch(/第 \d+ 张|已选择|携带/);
    }

    const buttons = Array.from(container.querySelectorAll<HTMLButtonElement>('[data-card]'));
    const zhLabels = buttons.map((button) => button.getAttribute('aria-label') ?? '');
    expect(zhLabels[0]!.startsWith('怪物，')).toBe(true);
    expect(zhLabels[0]).toContain('已选择');
    expect(zhLabels[1]!.startsWith('药水，')).toBe(true);
    expect(zhLabels[1]).toContain('携带');
  });

  it('keeps the visible caption as the prefix and shows carried as a badge', () => {
    const view = makeView({ card: 'spade-9' as CardId, kind: 'monster', carried: true });
    const { container } = renderWithProviders(<CardTile {...tileProps(view)} />);

    const button = container.querySelector<HTMLButtonElement>('[data-card]')!;
    const caption = container.querySelector('.card__caption')?.textContent ?? '';
    const label = button.getAttribute('aria-label') ?? '';
    expect(caption).toBe('Monster');
    expect(label.startsWith(caption)).toBe(true);
    // The visible badge text is part of the accessible name (WCAG 2.5.3).
    expect(label).toBe('Monster, Nine of spades · Carried');

    const badge = container.querySelector('.card__badge');
    // The label is painted from the data attribute so the badge is not a DOM
    // text node inside the card button (WCAG 2.5.3 label in name).
    expect(badge?.getAttribute('data-badge')).toBe('Carried');
    expect(badge?.getAttribute('aria-hidden')).toBe('true');
    expect(badge?.textContent).toBe('');
    // <360px hides the frame, so the metadata row repeats the carried state.
    expect(container.querySelector('.card__meta-detail')?.textContent).toContain('Carried');
  });

  it('omits the carried badge for cards left behind', () => {
    const view = makeView({ card: 'spade-9' as CardId, kind: 'monster' });
    const { container } = renderWithProviders(<CardTile {...tileProps(view)} />);

    expect(container.querySelector('.card__badge')).toBeNull();
    expect(container.querySelector('.card__meta-detail')?.textContent).not.toContain('Carried');
  });
});
