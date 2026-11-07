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
  it('shows the card type and state instead of the position', () => {
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

    expect(captions(container)).toEqual(['Monster', 'Weapon · Selected', 'Potion · Carried']);
    expect(container.textContent).not.toMatch(/Card \d+ of \d+/);

    const buttons = Array.from(container.querySelectorAll<HTMLButtonElement>('[data-card]'));
    expect(buttons[0]!.getAttribute('aria-label')).toBe('Monster, Five of clubs');
    expect(buttons[1]!.getAttribute('aria-label')).toBe('Weapon · Selected, Five of diamonds');
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

    expect(captions(container)).toEqual(['怪物，已选择', '药水，携带']);
    expect(container.textContent).not.toMatch(/第 \d+ 张/);
  });

  it('keeps the visible caption as an exact prefix of the accessible name', () => {
    const view = makeView({ card: 'spade-9' as CardId, kind: 'monster', carried: true });
    const { container } = renderWithProviders(<CardTile {...tileProps(view)} />);

    const button = container.querySelector<HTMLButtonElement>('[data-card]')!;
    const caption = container.querySelector('.card__caption')?.textContent ?? '';
    const label = button.getAttribute('aria-label') ?? '';
    expect(caption).toBe('Monster · Carried');
    expect(label.startsWith(caption)).toBe(true);
    expect(label).toBe('Monster · Carried, Nine of spades');
  });
});
