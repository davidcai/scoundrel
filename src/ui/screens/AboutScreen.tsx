import { navigate } from '../router';

export function AboutScreen() {
  return (
    <div className='screen about-screen'>
      <h1>About Scoundrel</h1>
      <div className='rules-condensed'>
        <h2>How to play</h2>
        <ul>
          <li>Start with 20 health. Each room deals four cards; resolve three of them in any order.</li>
          <li>Clubs and spades are monsters: they deal damage equal to their value.</li>
          <li>Diamonds are weapons: subtract the weapon value from a monster to reduce damage.</li>
          <li>A weapon can only fight monsters weaker than the last monster it killed.</li>
          <li>Hearts are potions: restore health equal to their value, capped at 20 (one per room).</li>
          <li>Run away once per room (never twice in a row) to bury the room and deal a new one.</li>
          <li>Clear the dungeon to win; your score is your remaining health.</li>
          <li>Reach 0 health and you lose; your score is 0 minus the value of monsters left in the deck.</li>
        </ul>
        <h2>Credits</h2>
        <p>
          Scoundrel is a game by Kurt Bieg and Zach Gage. This is an unofficial fan implementation.
        </p>
        <ul className='links'>
          <li>
            <a href='http://stfj.net/art/2011/Scoundrel.pdf' target='_blank' rel='noreferrer'>
              Original PDF
            </a>
          </li>
          <li>
            <a href='https://community.arduboy.com/t/scoundrel/13085' target='_blank' rel='noreferrer'>
              Arduboy community thread
            </a>
          </li>
          <li>
            <a href='https://rpdillon.net/scoundrel.html' target='_blank' rel='noreferrer'>
              rpdillon rules page
            </a>
          </li>
        </ul>
      </div>
      <button type='button' className='back' onClick={() => navigate('title')}>
        Back
      </button>
    </div>
  );
}
