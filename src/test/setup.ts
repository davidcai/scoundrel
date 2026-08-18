import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// Vitest runs without Jest globals, so RTL's auto-cleanup is skipped and
// every render would stack up in the same document. Unmount after each test.
afterEach(() => {
  cleanup();
});
