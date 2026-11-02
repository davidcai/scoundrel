import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { expectedCardFiles } from './artwork-catalog.mjs';

const directory = '.generated/card-artwork';
const manifestPath = `${directory}/manifest.json`;
const options = { lossless: true, effort: 4 };
const signature = JSON.stringify({ versions: sharp.versions, options });
assert.deepEqual((await readdir('assets')).sort(), [...expectedCardFiles].sort());
await mkdir(directory, { recursive: true });
let previous = {};
try {
  const cached = JSON.parse(await readFile(manifestPath, 'utf8'));
  if (cached && typeof cached === 'object' && !Array.isArray(cached)) previous = cached;
} catch {
  // Missing or invalid generated caches are safe to rebuild from source artwork.
}
const manifest = {};
let sourceBytes = 0;
let deliveryBytes = 0;
let converted = 0;
async function generate(name) {
  const source = await readFile(`assets/${name}`);
  const key = createHash('sha256').update(signature).update(source).digest('hex');
  const destination = `${directory}/${name.replace('.png', '.webp')}`;
  let output;
  if (previous[name] === key) {
    try {
      output = await readFile(destination);
    } catch {
      /* Regenerate missing cache files. */
    }
  }
  if (!output) {
    output = await sharp(source).keepIccProfile().webp(options).toBuffer();
    converted++;
  }
  const original = await sharp(source).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const decoded = await sharp(output).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  assert.equal(decoded.info.width, original.info.width, `${name}: width changed`);
  assert.equal(decoded.info.height, original.info.height, `${name}: height changed`);
  assert(original.data.equals(decoded.data), `${name}: decoded pixels changed`);
  await writeFile(destination, output);
  manifest[name] = key;
  sourceBytes += source.length;
  deliveryBytes += output.length;
}
for (let i = 0; i < expectedCardFiles.length; i += 3) {
  await Promise.all(expectedCardFiles.slice(i, i + 3).map(generate));
}
await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
console.log(
  `Verified ${expectedCardFiles.length} lossless cards (${converted} converted): ${(sourceBytes / 1e6).toFixed(2)} MB → ${(deliveryBytes / 1e6).toFixed(2)} MB. Dimensions and decoded pixels unchanged.`,
);
