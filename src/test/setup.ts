import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { webcrypto } from 'node:crypto';
import { afterEach } from 'vitest';

/**
 * jsdom stubs needed by the interface:
 * - `matchMedia` for responsive layout and the reduced-motion preference
 *   (tests can override it through tests/helpers/media.ts)
 * - `ResizeObserver` for the kill-stack width cap
 * - `scrollIntoView` for focus movement helpers
 */
type ChangeListener = (event: MediaQueryListEvent) => void;

function createMediaQueryList(query: string): MediaQueryList {
  const listeners = new Set<ChangeListener>();
  const list = {
    matches: false,
    media: query,
    onchange: null,
    addEventListener: (type: string, listener: EventListenerOrEventListenerObject) => {
      if (type === 'change' && typeof listener === 'function') {
        listeners.add(listener as ChangeListener);
      }
    },
    removeEventListener: (type: string, listener: EventListenerOrEventListenerObject) => {
      if (type === 'change' && typeof listener === 'function') {
        listeners.delete(listener as ChangeListener);
      }
    },
    addListener: (listener: ChangeListener) => listeners.add(listener),
    removeListener: (listener: ChangeListener) => listeners.delete(listener),
    dispatchEvent: (event: Event) => {
      for (const listener of listeners) listener(event as MediaQueryListEvent);
      return true;
    },
  };
  return list as unknown as MediaQueryList;
}

if (typeof window !== 'undefined') {
  window.matchMedia = ((query: string) => createMediaQueryList(query)) as typeof window.matchMedia;
}

if (typeof globalThis.ResizeObserver === 'undefined') {
  class ResizeObserverStub implements ResizeObserver {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  }
  globalThis.ResizeObserver = ResizeObserverStub;
}

if (typeof globalThis.crypto?.getRandomValues !== 'function') {
  Object.defineProperty(globalThis, 'crypto', {
    value: webcrypto,
    configurable: true,
  });
}

if (typeof Element !== 'undefined' && typeof Element.prototype.scrollIntoView !== 'function') {
  Element.prototype.scrollIntoView = function scrollIntoView() {};
}

afterEach(() => {
  if (typeof window === 'undefined') return;
  cleanup();
  window.history.replaceState(null, '', '#/');
  document.documentElement.lang = 'en';
  delete document.documentElement.dataset.motion;
});
