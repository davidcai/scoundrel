import { describe, expect, it } from 'vitest';
import { HealthMeter } from '../../src/ui/components/HealthMeter';
import { renderWithProviders } from '../helpers/render';

function toneFor(health: number): string | null {
  const { container, unmount } = renderWithProviders(<HealthMeter health={health} max={20} />);
  const healthEl = container.querySelector<HTMLElement>('.health');
  const className = healthEl?.className ?? '';
  unmount();
  if (className.includes('health--critical')) return 'critical';
  if (className.includes('health--wounded')) return 'wounded';
  return null;
}

describe('health meter tones', () => {
  it('uses green from 15 HP up', () => {
    expect(toneFor(20)).toBeNull();
    expect(toneFor(15)).toBeNull();
  });

  it('uses yellow from 8 to 14 HP', () => {
    expect(toneFor(14)).toBe('wounded');
    expect(toneFor(8)).toBe('wounded');
  });

  it('uses red below 8 HP', () => {
    expect(toneFor(7)).toBe('critical');
    expect(toneFor(0)).toBe('critical');
  });
});
