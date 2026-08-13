import type { GameConfig } from '../../engine/types'
import { Panel, PixelButton } from '../components'
import type { RunRecord, StatsData } from '../persistence'

export interface StatsScreenProps {
  stats: StatsData
  /** Replay a historical run's seed+config (US50). */
  onReplay: (record: RunRecord) => void
  onBack: () => void
}

function formatDate(epochMs: number): string {
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(epochMs))
}

function configChips(config: GameConfig): string[] {
  const chips: string[] = []
  if (config.runAwayMode === 'unlimited') chips.push('Run: unlimited')
  if (config.potionsPerRoom === 'unlimited') chips.push('Potions: ∞')
  if (!config.weaponDegradation) chips.push('No weapon wear')
  return chips
}

export function StatsScreen({ stats, onReplay, onBack }: StatsScreenProps) {
  const winRate = stats.gamesPlayed > 0 ? Math.round((stats.wins / stats.gamesPlayed) * 100) : null

  return (
    <main className="screen stats-screen" aria-labelledby="stats-heading">
      <header className="screen-header">
        <PixelButton variant="ghost" onClick={onBack}>
          ← Title
        </PixelButton>
        <h1 id="stats-heading">Stats</h1>
      </header>

      <div className="stats-scroll">
        {stats.gamesPlayed === 0 ? (
          <Panel shadowed>
            <p className="stats-empty">
              No runs on the ledger yet. Descend from the title screen and the dungeon will
              remember.
            </p>
          </Panel>
        ) : (
          <>
            <div className="stats-tiles" aria-label="Career aggregates">
              <StatTile label="Played" value={stats.gamesPlayed} />
              <StatTile label="Won" value={stats.wins} />
              <StatTile label="Lost" value={stats.losses} />
              <StatTile label="Win rate" value={winRate !== null ? `${String(winRate)}%` : '—'} />
              <StatTile label="Best score" value={stats.bestScore} />
              <StatTile label="Streak" value={stats.currentStreak} />
              <StatTile label="Best streak" value={stats.bestStreak} />
            </div>

            <Panel title="Run History" shadowed>
              <ul className="history-list" role="list">
                {stats.runs.map((record, index) => {
                  const chips = configChips(record.config)
                  return (
                    <li
                      key={`${record.seed}-${String(record.date)}-${String(index)}`}
                      className="history-row"
                    >
                      <span className={`outcome-badge outcome-badge--${record.outcome}`}>
                        {record.outcome === 'won' ? 'Won' : 'Lost'}
                      </span>
                      <span className="history-score">{record.score}</span>
                      <span className="history-meta">
                        <span className="history-seed">Seed {record.seed}</span>
                        <span className="history-detail">
                          {formatDate(record.date)} · {record.roomsCleared} rooms
                        </span>
                        {chips.length > 0 && (
                          <span className="history-chips">
                            {chips.map((chip) => (
                              <span key={chip} className="config-chip config-chip--small">
                                {chip}
                              </span>
                            ))}
                          </span>
                        )}
                      </span>
                      <span className="history-action">
                        <PixelButton
                          variant="steel"
                          aria-label={`Replay run ${record.seed}`}
                          onClick={() => {
                            onReplay(record)
                          }}
                        >
                          Replay
                        </PixelButton>
                      </span>
                    </li>
                  )
                })}
              </ul>
            </Panel>
          </>
        )}
      </div>
    </main>
  )
}

function StatTile({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="stat-tile bevel-sunken">
      <span className="stat-tile-label">{label}</span>
      <span className="stat-tile-value">{value}</span>
    </div>
  )
}
