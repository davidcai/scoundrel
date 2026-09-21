import { useState } from 'react';
import { useT } from '../../i18n';
import { loadSettings, saveSettings, type TableRenderer } from '../../store/settings';

/**
 * Dev-gated renderer toggle for the SettingsScreen (docs/phaser-plan.md §4
 * Phase 1): writes `tableRenderer` through the settings shard's save API,
 * preserving the stored config/language. Renders nothing outside dev builds —
 * the flag stays dev-gated in Phase 1 and only becomes a user-visible setting
 * in Phase 2. Self-contained: the integration lane mounts it in
 * SettingsScreen.
 */
export function RendererToggle() {
  const t = useT();
  const [renderer, setRenderer] = useState<TableRenderer>(() => loadSettings().tableRenderer);

  if (!import.meta.env.DEV) return null;

  const onChange = (next: TableRenderer) => {
    setRenderer(next);
    const stored = loadSettings();
    saveSettings(stored.config, stored.language, next);
  };

  return (
    <div className="settings-row">
      <div>
        <label htmlFor="renderer-select">{t('rendererLabel')}</label>
        <p className="muted">{t('rendererDesc')}</p>
      </div>
      <select
        id="renderer-select"
        className="text-input"
        value={renderer}
        onChange={(e) => onChange(e.target.value as TableRenderer)}
      >
        <option value="dom">{t('rendererDom')}</option>
        <option value="phaser">{t('rendererPhaser')}</option>
      </select>
    </div>
  );
}
