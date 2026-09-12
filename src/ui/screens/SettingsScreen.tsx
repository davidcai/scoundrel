import { useState } from 'react';
import type { GameConfig } from '../../engine';
import { loadSettings, saveSettings } from '../../store/settings';
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

export function SettingsScreen() {
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
          <h2>Settings</h2>
          <button type="button" className="btn ghost" onClick={() => navigate('#/')}>
            ← Title
          </button>
        </header>

        <p className="muted">
          House-rule toggles. Defaults follow the official rule set. Changes apply to new runs.
        </p>

        <Toggle
          id="toggle-run-away"
          label="Run-away restriction"
          description="On: you cannot run from two rooms in a row. Off: run away as often as you like."
          checked={config.runAwayMode === 'once'}
          onChange={(checked) => update({ runAwayMode: checked ? 'once' : 'unlimited' })}
        />
        <Toggle
          id="toggle-potions"
          label="One potion per room"
          description="On: only the first potion each room heals; extras are discarded. Off: every potion heals."
          checked={config.potionsPerRoom === 'one'}
          onChange={(checked) => update({ potionsPerRoom: checked ? 'one' : 'unlimited' })}
        />
        <Toggle
          id="toggle-degradation"
          label="Weapon degradation"
          description="On: a weapon can only fight monsters weaker than the last monster it killed. Off: weapons never degrade."
          checked={config.weaponDegradation}
          onChange={(checked) => update({ weaponDegradation: checked })}
        />
      </div>
    </main>
  );
}
