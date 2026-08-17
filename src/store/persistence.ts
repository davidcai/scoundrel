import type { GameConfig, GameState } from '../engine';
import { DEFAULT_CONFIG } from '../engine';
import type { SerializedConfig } from './configCodec';
import { parseConfig, serializeConfig } from './configCodec';

const SETTINGS_KEY = 'scoundrel:settings';
const RUN_KEY = 'scoundrel:run';
const SETTINGS_VERSION = 1;
const RUN_VERSION = 1;

interface Versioned<T> {
  version: number;
  data: T;
}

/** Read a versioned value and migrate it to the current schema. */
export function loadVersioned<T>(
  key: string,
  _currentVersion: number,
  migrate: (version: number, data: unknown) => T,
): T | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Versioned<unknown>;
    return migrate(parsed.version ?? 1, parsed.data);
  } catch {
    return null;
  }
}

/** Write a versioned value. */
export function saveVersioned<T>(key: string, version: number, data: T): void {
  try {
    localStorage.setItem(key, JSON.stringify({ version, data }));
  } catch {
    // Quota / private-mode errors are non-fatal for a local game.
  }
}

export function removeKey(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    // ignore
  }
}

export function loadSettings(): GameConfig {
  const raw = loadVersioned<SerializedConfig>(SETTINGS_KEY, SETTINGS_VERSION, (_v, d) => d as SerializedConfig);
  return raw ? parseConfig(raw) : { ...DEFAULT_CONFIG };
}

export function saveSettings(config: GameConfig): void {
  saveVersioned(SETTINGS_KEY, SETTINGS_VERSION, serializeConfig(config));
}

export interface TerminalOutcome {
  outcome: 'won' | 'lost';
  score: number;
}

export interface RunSaveData {
  state: GameState;
  terminalOutcome: TerminalOutcome | null;
  statsWritten: boolean;
}

export function loadRun(): RunSaveData | null {
  return loadVersioned<RunSaveData>(RUN_KEY, RUN_VERSION, (_v, d) => d as RunSaveData);
}

export function saveRun(data: RunSaveData): void {
  saveVersioned(RUN_KEY, RUN_VERSION, data);
}

export function clearRun(): void {
  removeKey(RUN_KEY);
}
