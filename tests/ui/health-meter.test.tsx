import { describe, expect, it } from 'vitest';
import { HealthMeter } from '../../src/ui/components/HealthMeter';
import { renderWithProviders } from '../helpers/render';

function toneFor(health: number): string | null {
  const { container, unmount } = renderWithProviders(<HealthMeter health={health} max={20} />);
  const healthEl = container.querySelector<HTMLElement>('.health');
  const className = healthEl?.className ?? '';
  unmount();
  if (className.includes('health--low')) return 'low';
  return null;
}

describe('health meter tones', () => {
  it('uses green above 7 HP', () => {
    expect(toneFor(20)).toBeNull();
    expect(toneFor(15)).toBeNull();
    expect(toneFor(8)).toBeNull();
  });

  it('uses yellow at 7 HP and below', () => {
    expect(toneFor(7)).toBe('low');
    expect(toneFor(0)).toBe('low');
  });
});
