import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import App from '../src/App';

describe('Phase 1 scaffold', () => {
  it('renders the Scoundrel wordmark as the page heading', () => {
    render(<App />);

    expect(screen.getByRole('heading', { level: 1, name: 'Scoundrel' })).toBeInTheDocument();
  });

  it('displays a current-artwork card', () => {
    render(<App />);

    const card = screen.getByRole('img', { name: 'Eight of clubs' });

    expect(card).toBeInTheDocument();
    expect(card.getAttribute('src')).toContain('club-8');
    expect(screen.getByText(/Card 1 of 1 · Eight of clubs/)).toBeInTheDocument();
  });
});
