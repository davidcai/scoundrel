import { useState } from 'react';
import { configToQuery, parseConfig } from '../../store/configCodec';
import type { RunRecord } from '../../store/stats';
import { loadStats } from '../../store/stats';
import { navigate } from '../router';

export function StatsScreen() {
  const [stats] = useState(() => loadStats());
  const winRate = stats.gamesPlayed === 0 ? 0 : Math.round((stats.wins / stats.gamesPlayed) * 100);

  const replay = (r: RunRecord) => {
    navigate('play', 'seed=' + r.seed + '&' + configToQuery(parseConfig(r.config)));
  };

  return (
    <div className='screen stats-screen'>
      <h1>Stats</h1>
      <div className='stats-grid'>
        <div className='stat'>
          <span>{stats.gamesPlayed}</span>
          <label>Games</label>
        </div>
        <div className='stat'>
          <span>{stats.wins}</span>
          <label>Wins</label>
        </div>
        <div className='stat'>
          <span>{stats.losses}</span>
          <label>Losses</label>
        </div>
        <div className='stat'>
          <span>{winRate}%</span>
          <label>Win rate</label>
        </div>
        <div className='stat'>
          <span>{stats.bestScore}</span>
          <label>Best score</label>
        </div>
        <div className='stat'>
          <span>{stats.currentStreak}</span>
          <label>Streak</label>
        </div>
        <div className='stat'>
          <span>{stats.bestStreak}</span>
          <label>Best streak</label>
        </div>
      </div>

      <h2>Run history</h2>
      {stats.runs.length === 0 ? (
        <p className='muted'>No completed runs yet.</p>
      ) : (
        <ul className='run-history'>
          {stats.runs.map((r, i) => (
            <li key={i} className={'run ' + r.outcome}>
              <span className='run-outcome'>{r.outcome}</span>
              <span className='run-score'>{r.score}</span>
              <span className='run-seed'>seed {r.seed}</span>
              <span className='run-rooms'>{r.roomsCleared} rooms</span>
              <span className='run-date'>{new Date(r.date).toLocaleDateString()}</span>
              <button type='button' className='run-replay' onClick={() => replay(r)}>
                Replay
              </button>
            </li>
          ))}
        </ul>
      )}
      <button type='button' className='back' onClick={() => navigate('title')}>
        Back
      </button>
    </div>
  );
}
