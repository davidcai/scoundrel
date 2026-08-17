import { useState } from 'react';
import type { GameConfig } from '../../engine';
import { DEFAULT_CONFIG } from '../../engine';
import { loadSettings, saveSettings } from '../../store/persistence';
import { navigate } from '../router';

export function SettingsScreen() {
  const [config, setConfig] = useState<GameConfig>(() => loadSettings());

  const update = (next: GameConfig) => {
    setConfig(next);
    saveSettings(next);
  };

  return (
    <div className='screen settings-screen'>
      <h1>Settings</h1>
      <p className='muted'>House rules apply to new runs. Defaults match the official rules.</p>

      <label className='toggle'>
        <span className='toggle-copy'>
          <strong>Run-away restriction</strong>
          <small>Run away once per room, or unlimited.</small>
        </span>
        <select
          value={config.runAwayMode}
          onChange={(e) => update({ ...config, runAwayMode: e.target.value as GameConfig['runAwayMode'] })}
        >
          <option value='once'>Once (cannot run twice in a row)</option>
          <option value='unlimited'>Unlimited</option>
        </select>
      </label>

      <label className='toggle'>
        <span className='toggle-copy'>
          <strong>Potions per room</strong>
          <small>Only the first potion heals, or every potion.</small>
        </span>
        <select
          value={config.potionsPerRoom === Infinity ? 'inf' : '1'}
          onChange={(e) =>
            update({ ...config, potionsPerRoom: e.target.value === 'inf' ? Infinity : 1 })
          }
        >
          <option value='1'>One</option>
          <option value='inf'>Unlimited</option>
        </select>
      </label>

      <label className='toggle'>
        <span className='toggle-copy'>
          <strong>Weapon degradation</strong>
          <small>A weapon can only fight monsters weaker than its last kill.</small>
        </span>
        <input
          type='checkbox'
          checked={config.weaponDegradation}
          onChange={(e) => update({ ...config, weaponDegradation: e.target.checked })}
        />
      </label>

      <div className='settings-actions'>
        <button type='button' onClick={() => update({ ...DEFAULT_CONFIG })}>
          Reset to defaults
        </button>
        <button type='button' className='back' onClick={() => navigate('title')}>
          Back
        </button>
      </div>
    </div>
  );
}
