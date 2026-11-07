import { readdir, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';

import { expectedCardFiles as expected } from './artwork-catalog.mjs';

const cards = await readdir('assets');
assert.deepEqual(cards.sort(), expected.sort(), 'Artwork must match the exact 44-card deck');
const outputFiles = await readdir('dist/assets');
assert.equal(
  outputFiles.filter((name) => name.endsWith('.webp')).length,
  44,
  'Build must contain all 44 WebP cards',
);
assert(
  !outputFiles.some((name) => /\.(png|jpe?g)$/i.test(name)),
  'Build must not contain duplicate PNG or archived JPEG artwork',
);
const generated = await readdir('.generated/card-artwork');
assert.deepEqual(
  generated.filter((name) => name.endsWith('.webp')).sort(),
  expected.map((name) => name.replace('.png', '.webp')).sort(),
);
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const archived = new Set(
  await Promise.all(
    (await readdir('assets-old')).map(async (name) => hash(await readFile(`assets-old/${name}`))),
  ),
);
const bundledHashes = new Set();
for (const name of outputFiles) {
  const bytes = await readFile(`dist/assets/${name}`);
  const digest = hash(bytes);
  bundledHashes.add(digest);
  assert(!archived.has(digest), `Archived artwork bundled: ${name}`);
}
for (const name of expected) {
  const webp = name.replace('.png', '.webp');
  assert(
    bundledHashes.has(hash(await readFile(`.generated/card-artwork/${webp}`))),
    `Missing generated card in build: ${webp}`,
  );
}
assert(
  !(await readdir('dist')).includes('assets-old'),
  'Archived artwork directory must not be published',
);
console.log(
  'Artwork check passed: 44 lossless WebP cards; no duplicate PNG or archived artwork in the build.',
);
