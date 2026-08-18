/**
 * Settings screen: the three canonical-default toggles render, switching one
 * persists a versioned envelope immediately, and defaults come from rules.md.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { loadSettings } from '../../persistence/settings';
import { STORAGE_KEYS } from '../../persistence/storage';
import { SettingsScreen } from './SettingsScreen';

function readStoredSettings(): { version: number; data: Record<string, unknown> } {
  const raw = localStorage.getItem(STORAGE_KEYS.settings);
  if (raw === null) throw new Error('expected stored settings');
  return JSON.parse(raw) as { version: number; data: Record<string, unknown> };
}

beforeEach(() => {
  localStorage.clear();
});

describe('SettingsScreen', () => {
  it('renders all three rule toggles at canonical defaults', () => {
    render(<SettingsScreen />);
    for (const name of [/restrict run-away/i, /one potion per room/i, /weapon degradation/i]) {
      const toggle = screen.getByRole('switch', { name });
      expect(toggle).toHaveAttribute('aria-checked', 'true');
    }
    expect(screen.getAllByText('Canonical rule')).toHaveLength(3);
  });

  it('toggling weapon degradation persists to the settings shard', async () => {
    const user = userEvent.setup();
    render(<SettingsScreen />);

    await user.click(screen.getByRole('switch', { name: /weapon degradation/i }));
    expect(screen.getByRole('switch', { name: /weapon degradation/i })).toHaveAttribute(
      'aria-checked',
      'false',
    );

    const raw = readStoredSettings();
    expect(raw.version).toBe(1);
    expect(raw.data.weaponDegradation).toBe(false);
    // And a fresh load sees it (persisted across sessions).
    expect(loadSettings().weaponDegradation).toBe(false);
  });

  it('toggling potions off canonical stores Infinity (null on the wire)', async () => {
    const user = userEvent.setup();
    render(<SettingsScreen />);
    await user.click(screen.getByRole('switch', { name: /one potion per room/i }));
    expect(loadSettings().potionsPerRoom).toBe(Number.POSITIVE_INFINITY);
    expect(readStoredSettings().data.potionsPerRoom).toBeNull();
  });

  it('defaults persist as canonical when nothing changed', async () => {
    render(<SettingsScreen />);
    expect(loadSettings()).toEqual({
      runAwayMode: 'once',
      potionsPerRoom: 1,
      weaponDegradation: true,
    });
  });
});
