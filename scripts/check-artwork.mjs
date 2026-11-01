import { readdir, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';

const expected = ['club', 'spade'].flatMap((suit) =>
  ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'j', 'q', 'k', 'a'].map(
    (rank) => `${suit}-${rank}.png`,
  ),
);
expected.push(
  ...['diamond', 'heart'].flatMap((suit) =>
    ['2', '3', '4', '5', '6', '7', '8', '9', '10'].map((rank) => `${suit}-${rank}.png`),
  ),
);
const cards = await readdir('assets');
assert.deepEqual(cards.sort(), expected.sort(), 'Artwork must match the exact 44-card deck');
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const archived = new Set(
  await Promise.all(
    (await readdir('assets-old')).map(async (name) => hash(await readFile(`assets-old/${name}`))),
  ),
);
for (const name of await readdir('dist/assets')) {
  const bytes = await readFile(`dist/assets/${name}`);
  assert(!archived.has(hash(bytes)), `Archived artwork bundled: ${name}`);
}
assert(
  !(await readdir('dist')).includes('assets-old'),
  'Archived artwork directory must not be published',
);
console.log('Artwork check passed: 44 source cards; no archived artwork in the build.');
