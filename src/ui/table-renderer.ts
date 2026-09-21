import { create } from 'zustand';
import { loadSettings, saveSettings, type TableRenderer } from '../store/settings';

/**
 * Reactive settings hook for the play-screen renderer switch (docs/phaser-plan.md
 * §4 Phase 1). The settings shard has no reactive store of its own, so this
 * mirrors the `useLanguage` pattern in `src/i18n.ts`: a tiny zustand store
 * seeded from the persisted settings, persisted through the shard's save API
 * (preserving stored config/language). The renderer flag is per-device
 * appearance and deliberately does not round-trip through share URLs.
 */
interface TableRendererStore {
  renderer: TableRenderer;
  setRenderer: (renderer: TableRenderer) => void;
}

export const useTableRenderer = create<TableRendererStore>((set) => ({
  renderer: loadSettings().tableRenderer,
  setRenderer: (renderer) => {
    const stored = loadSettings();
    saveSettings(stored.config, stored.language, renderer);
    set({ renderer });
  },
}));
