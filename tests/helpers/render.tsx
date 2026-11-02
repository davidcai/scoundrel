import { render, type RenderResult } from '@testing-library/react';
import type { ReactElement } from 'react';
import { PreferencesProvider } from '../../src/store/preferences';
import { AnnouncerProvider } from '../../src/ui/components/Announcer';

/** Render interface components inside the preference and announcer providers. */
export function renderWithProviders(ui: ReactElement): RenderResult {
  return render(
    <PreferencesProvider>
      <AnnouncerProvider>{ui}</AnnouncerProvider>
    </PreferencesProvider>,
  );
}
