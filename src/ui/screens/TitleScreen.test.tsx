/**
 * Title screen: menu composition, Continue gated on a saved run, Enter Seed
 * composes a shareable play URL.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { saveRun } from '../../persistence/run';
import { makeState, slotsFor } from '../../test/fixtures';
import { TitleScreen } from './TitleScreen';

beforeEach(() => {
  localStorage.clear();
  window.location.hash = '#/';
});

describe('TitleScreen', () => {
  it('renders the full menu without Continue when no save exists', () => {
    render(<TitleScreen />);
    for (const name of ['New Run', 'Enter Seed', 'Stats', 'Settings', 'About']) {
      expect(screen.getByRole('button', { name })).toBeInTheDocument();
    }
    expect(screen.queryByRole('button', { name: 'Continue' })).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Scoundrel' })).toBeInTheDocument();
    expect(screen.getByText('a dungeon solitaire')).toBeInTheDocument();
  });

  it('shows Continue when a run record exists', () => {
    saveRun({
      state: makeState(),
      slots: slotsFor(makeState().room),
      slotsSnapshot: null,
      carriedCardId: null,
      statsWritten: false,
      outcome: null,
    });
    render(<TitleScreen />);
    expect(screen.getByRole('button', { name: 'Continue' })).toBeInTheDocument();
  });

  it('Enter Seed reveals an input and navigates to the shareable URL', async () => {
    const user = userEvent.setup();
    render(<TitleScreen />);

    await user.click(screen.getByRole('button', { name: 'Enter Seed' }));
    const input = screen.getByLabelText('Seed');
    await user.type(input, 'zz9999');
    await user.click(screen.getByRole('button', { name: 'Start' }));

    expect(window.location.hash).toBe('#/play?seed=zz9999&config=o1d');
  });

  it('seed form rejects blank seeds', async () => {
    const user = userEvent.setup();
    render(<TitleScreen />);
    await user.click(screen.getByRole('button', { name: 'Enter Seed' }));
    expect(screen.getByRole('button', { name: 'Start' })).toBeDisabled();
  });
});
