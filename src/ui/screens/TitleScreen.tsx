import { useState } from 'react';
import { randomSeed } from '../../engine';
import { useGameStore } from '../../store/gameStore';
import { navigate } from '../router';

export function TitleScreen() {
  const state = useGameStore((s) => s.state);
  const startRun = useGameStore((s) => s.startRun);
  const [seedInput, setSeedInput] = useState('');
  const [showSeed, setShowSeed] = useState(false);
  const hasRun = state !== null && state.phase === 'playing';

  const newRun = () => {
    startRun(randomSeed());
    navigate('play');
  };

  const startSeed = () => {
    startRun(seedInput.trim() || randomSeed());
    navigate('play');
  };

  return (
    <div className='screen title-screen'>
      <h1 className='game-title'>SCOUNDREL</h1>
      <p className='tagline'>A one-player roguelike dungeon-crawling card game</p>
      <nav className='menu' aria-label='Main menu'>
        <button type='button' className='menu-item primary' onClick={newRun}>
          New Run
        </button>
        {hasRun && (
          <button type='button' className='menu-item' onClick={() => navigate('play')}>
            Continue
          </button>
        )}
        <button type='button' className='menu-item' onClick={() => setShowSeed((v) => !v)}>
          Enter Seed
        </button>
        {showSeed && (
          <div className='seed-form'>
            <input
              value={seedInput}
              onChange={(e) => setSeedInput(e.target.value)}
              placeholder='seed (optional)'
              aria-label='Seed'
            />
            <button type='button' onClick={startSeed}>
              Start
            </button>
          </div>
        )}
        <button type='button' className='menu-item' onClick={() => navigate('stats')}>
          Stats
        </button>
        <button type='button' className='menu-item' onClick={() => navigate('settings')}>
          Settings
        </button>
        <button type='button' className='menu-item' onClick={() => navigate('about')}>
          About
        </button>
      </nav>
    </div>
  );
}
