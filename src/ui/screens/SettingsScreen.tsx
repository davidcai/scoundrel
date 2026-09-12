import { useState } from 'react';
import type { GameConfig } from '../../engine';
import { useLanguage, useT } from '../../i18n';
import { loadSettings, saveSettings, type Language } from '../../store/settings';
import { navigate } from '../router';

interface ToggleProps {
  id: string;
  label: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}

function Toggle({ id, label, description, checked, onChange }: ToggleProps) {
  return (
    <div className="settings-row">
      <div>
        <label htmlFor={id}>{label}</label>
        <p className="muted">{description}</p>
      </div>
      <button
        id={id}
        type="button"
        className="switch"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
      >
        <span className="switch-knob" />
      </button>
    </div>
  );
}

const LANGUAGE_OPTIONS: { value: Language; label: string }[] = [
  { value: 'en', label: 'English' },
  { value: 'zh', label: '中文（简体）' },
];

export function SettingsScreen() {
  const t = useT();
  const lang = useLanguage((s) => s.lang);
  const setLang = useLanguage((s) => s.setLang);
  const [config, setConfig] = useState<GameConfig>(() => loadSettings().config);

  const update = (patch: Partial<GameConfig>) => {
    const next = { ...config, ...patch };
    setConfig(next);
    saveSettings(next);
  };

  return (
    <main className="screen">
      <div className="panel">
        <header className="panel-header">
          <h2>{t('settings')}</h2>
          <button type="button" className="btn ghost" onClick={() => navigate('#/')}>
            {t('backToTitle')}
          </button>
        </header>

        <div className="settings-row">
          <div>
            <label htmlFor="language-select">{t('languageLabel')}</label>
          </div>
          <select
            id="language-select"
            className="text-input"
            value={lang}
            onChange={(e) => setLang(e.target.value as Language)}
          >
            {LANGUAGE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <p className="muted">{t('settingsIntro')}</p>

        <Toggle
          id="toggle-run-away"
          label={t('toggleRunLabel')}
          description={t('toggleRunDesc')}
          checked={config.runAwayMode === 'once'}
          onChange={(checked) => update({ runAwayMode: checked ? 'once' : 'unlimited' })}
        />
        <Toggle
          id="toggle-potions"
          label={t('togglePotionLabel')}
          description={t('togglePotionDesc')}
          checked={config.potionsPerRoom === 'one'}
          onChange={(checked) => update({ potionsPerRoom: checked ? 'one' : 'unlimited' })}
        />
        <Toggle
          id="toggle-degradation"
          label={t('toggleDegLabel')}
          description={t('toggleDegDesc')}
          checked={config.weaponDegradation}
          onChange={(checked) => update({ weaponDegradation: checked })}
        />
      </div>
    </main>
  );
}
