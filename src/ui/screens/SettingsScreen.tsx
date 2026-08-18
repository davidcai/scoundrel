/**
 * Settings screen (#/settings): the three core house-rule toggles (Q10a/Q52),
 * canonical rules by default (Q53), persisted across sessions (Q54). Changes
 * never disturb an active run — config is snapshotted at run start.
 */
import { useState } from 'react';
import type { GameConfig } from '../../engine';
import { loadSettings, saveSettings } from '../../persistence/settings';
import { navigate } from '../router/useHashRoute';
import './FormScreens.css';

interface ToggleRowProps {
  id: string;
  label: string;
  description: string;
  checked: boolean;
  canonicalWhen: 'on' | 'off';
  onChange: (checked: boolean) => void;
}

function ToggleRow({ id, label, description, checked, canonicalWhen, onChange }: ToggleRowProps) {
  const canonical = canonicalWhen === 'on' ? checked : !checked;
  return (
    <div className="toggle-row">
      <div className="toggle-row-text">
        <label className="toggle-row-label" htmlFor={id}>
          {label}
        </label>
        <p className="toggle-row-desc">{description}</p>
        <p className="toggle-row-canonical">{canonical ? 'Canonical rule' : 'House rule'}</p>
      </div>
      <button
        type="button"
        id={id}
        role="switch"
        aria-checked={checked}
        className={checked ? 'toggle toggle--on' : 'toggle'}
        onClick={() => onChange(!checked)}
      >
        <span className="toggle-thumb" aria-hidden="true" />
        <span className="sr-only">{label}</span>
      </button>
    </div>
  );
}

export function SettingsScreen() {
  const [config, setConfig] = useState<GameConfig>(() => loadSettings());

  const update = (next: GameConfig) => {
    setConfig(next);
    saveSettings(next);
  };

  return (
    <main className="form-screen">
      <h1 className="form-screen-title">Settings</h1>
      <p className="form-screen-lede">
        House rules apply to the next run you start — your active run keeps the rules it began with.
      </p>
      <div className="toggle-list">
        <ToggleRow
          id="toggle-run-away"
          label="Restrict run-away"
          description="Canonical: you cannot run from two rooms in a row. Off: run away as often as you like."
          checked={config.runAwayMode === 'once'}
          canonicalWhen="on"
          onChange={(restricted) =>
            update({ ...config, runAwayMode: restricted ? 'once' : 'unlimited' })
          }
        />
        <ToggleRow
          id="toggle-potions"
          label="One potion per room"
          description="Canonical: only the first heart in a room heals; extras are discarded. Off: every heart heals."
          checked={config.potionsPerRoom === 1}
          canonicalWhen="on"
          onChange={(one) =>
            update({ ...config, potionsPerRoom: one ? 1 : Number.POSITIVE_INFINITY })
          }
        />
        <ToggleRow
          id="toggle-degradation"
          label="Weapon degradation"
          description="Canonical: after a kill, a weapon only fights monsters weaker than its last kill. Off: weapons never degrade."
          checked={config.weaponDegradation}
          canonicalWhen="on"
          onChange={(on) => update({ ...config, weaponDegradation: on })}
        />
      </div>
      <button type="button" className="btn btn--ghost" onClick={() => navigate('#/')}>
        Back to title
      </button>
    </main>
  );
}
