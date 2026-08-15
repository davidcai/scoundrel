import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from './App.tsx';

describe('App', () => {
  it('renders the Scoundrel title', () => {
    render(<App />);
    expect(screen.getByRole('heading', { name: 'Scoundrel' })).toBeInTheDocument();
  });
});
