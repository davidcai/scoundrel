/**
 * Persisted-store boundary for the Phase 4 interface.
 *
 * Import runtime helpers from here and keep rules-engine imports in
 * `../engine`. The store owns saved-data formats and statistics; the interface
 * owns rendering and transient selection.
 */
export { createScoundrelStore } from './scoundrelStore';
export type {
  ActiveRunView,
  CompleteRunFailureReason,
  CompleteRunResult,
  CompletedResultView,
  DiscardRunFailureReason,
  DiscardRunResult,
  RecoveryIssue,
  SaveRunFailureReason,
  SaveRunResult,
  SaveSettingsResult,
  ScoundrelStore,
  ScoundrelStoreOptions,
  ShardName,
  StartRunFailureReason,
  StartRunResult,
  StartedRun,
  StoreSnapshot,
  StoreWarning,
  TitleState,
} from './scoundrelStore';
export { ScoundrelStoreProvider } from './ScoundrelStoreProvider';
export { useScoundrelSnapshot, useScoundrelStore } from './useScoundrelStore';
export { PLAY_ROUTE, buildReplayHash, buildReplayUrl, parseReplayLink } from './share';
export type { ParseReplayLinkResult, ReplayLinkIssue } from './share';
export { DEFAULT_SETTINGS, isStoredSettings, mergeSettings } from './settings';
export type { StoredSettings } from './settings';
export { HISTORY_LIMIT, addHistoryEntry, isHistory, isHistoryEntry } from './history';
export type { HistoryEntry } from './history';
export { EMPTY_STATISTICS, winRatePercent } from './stats';
export type { Statistics, StoredStats } from './stats';
export { SCHEMA_VERSION, STORAGE_KEYS } from './persistence';
