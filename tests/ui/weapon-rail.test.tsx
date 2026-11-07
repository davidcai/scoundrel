import { act, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CardId } from '../../src/engine';
import { createTranslator } from '../../src/i18n';
import type { WeaponView } from '../../src/store/selectors';
import { WeaponRail } from '../../src/ui/components/WeaponRail';
import { renderWithProviders } from '../helpers/render';

const t = createTranslator('en');

const KILLS = ['club-2', 'club-3', 'club-4', 'club-5', 'club-6', 'club-7'] as readonly CardId[];

class CapturingResizeObserver {
  static instances: CapturingResizeObserver[] = [];
  readonly callback: ResizeObserverCallback;

  constructor(callback: ResizeObserverCallback) {
    this.callback = callback;
    CapturingResizeObserver.instances.push(this);
  }

  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

function baseView(overrides: Partial<WeaponView> = {}): WeaponView {
  return {
    weapon: { card: 'diamond-5' as CardId, value: 5, kills: KILLS, limit: null },
    broken: false,
    brokenLimit: null,
    kills: KILLS,
    ...overrides,
  };
}

function setRailWidth(width: number): void {
  act(() => {
    for (const observer of CapturingResizeObserver.instances) {
      observer.callback(
        [{ contentRect: { width } } as ResizeObserverEntry],
        observer as unknown as ResizeObserver,
      );
    }
  });
}

describe('weapon rail', () => {
  beforeEach(() => {
    CapturingResizeObserver.instances = [];
    vi.stubGlobal('ResizeObserver', CapturingResizeObserver);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('caps the kill stack by the rail width and renders newest top/right', () => {
    const { container } = renderWithProviders(<WeaponRail view={baseView()} />);

    // The rail is 240px wide at wide layout: four 96px thumbs fit the cap.
    setRailWidth(240);

    const thumbs = container.querySelectorAll('.kill-stack__thumb');
    expect(thumbs).toHaveLength(4);
    const images = Array.from(
      container.querySelectorAll<HTMLImageElement>('.kill-stack__thumb img'),
    );
    expect(images).toHaveLength(4);
    // Oldest→newest left-to-right, so the newest kill is the last/top thumb.
    expect(images[0]!.src).toContain('club-4.png');
    expect(images[images.length - 1]!.src).toContain('club-7.png');
    // The stack has no totals or overflow captions; the heading alone labels it.
    expect(screen.getByRole('heading', { name: t('play.killStackTitle') })).toBeInTheDocument();
    expect(screen.queryByText(/defeated|\+\d+ more|…/)).toBeNull();
    // The full stack is always available as text for assistive technology.
    const names = container.querySelector('.visually-hidden')?.textContent ?? '';
    expect(names.length).toBeGreaterThan(0);
  });

  it('never renders a damage strip or broken caption for a spent weapon', () => {
    const view = baseView({
      weapon: { card: 'diamond-5' as CardId, value: 5, kills: KILLS, limit: 4 },
      broken: true,
      brokenLimit: 4,
    });
    const { container } = renderWithProviders(<WeaponRail view={view} />);

    expect(container.querySelector('.card__damage')).toBeNull();
    expect(container.querySelectorAll('.weapon__card .card__frame')).toHaveLength(1);
    expect(screen.queryByText(/Broken|损坏/)).toBeNull();
  });

  it('shows the empty slot and barehanded hint without a weapon', () => {
    renderWithProviders(
      <WeaponRail view={{ weapon: null, broken: false, brokenLimit: null, kills: [] }} />,
    );

    expect(screen.getByText(t('play.noWeapon'))).toBeInTheDocument();
    expect(screen.getByText(t('play.noWeaponHint'))).toBeInTheDocument();
  });
});
