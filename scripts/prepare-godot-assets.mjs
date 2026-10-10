#!/usr/bin/env node
/**
 * prepare-godot-assets.mjs — stage the card deck for the Godot frame
 * (godot-plan.md, "Asset pipeline").
 *
 * `assets/*.jpg` stays the ONLY authored source. This script validates the
 * exact expected 44 card ids and generates resized PNG derivatives under
 * `godot/assets/cards/` (the Godot import staging directory), preserving
 * aspect ratio and never upscaling smaller sources. Derivatives are staging
 * input for the Godot import — they are not served; the export ships the
 * imported (lossy-compressed) textures inside the PCK.
 *
 * Start settings (Phase 1, validated against the payload budget):
 *   max width 576 px  — the current 192 CSS px card width at DPR 3
 *   import: Lossy, quality 0.8, mipmaps disabled (patched into the generated
 *   .import files by scripts/export-godot.mjs after the first import pass)
 *
 * The manifest (godot/assets/manifest.json) pins tool/version, dimensions,
 * and source/derivative SHA-256 hashes — part of the build cache key. The
 * output is deterministic for a given sharp version; no timestamps.
 */

import { createHash } from 'node:crypto';
import { readFile, readdir, mkdir, writeFile, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourceDir = path.join(repoRoot, 'assets');
const outDir = path.join(repoRoot, 'godot', 'assets', 'cards');
const manifestPath = path.join(repoRoot, 'godot', 'assets', 'manifest.json');

/** Maximum derivative width in px (192 CSS px card width at DPR 3). */
const MAX_WIDTH = Number(process.env.GODOT_CARD_MAX_WIDTH ?? 576);
const PNG_OPTIONS = { compressionLevel: 9 };

/** The Scoundrel deck: clubs/spades full 13 ranks, diamonds/hearts 2–10. */
const FULL_RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'j', 'q', 'k', 'a'];
const NUMBER_RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', '10'];
const EXPECTED_IDS = [
  ...['club', 'spade'].flatMap((suit) => FULL_RANKS.map((rank) => `${suit}-${rank}`)),
  ...['diamond', 'heart'].flatMap((suit) => NUMBER_RANKS.map((rank) => `${suit}-${rank}`)),
].sort();

function sha256(buffer) {
  return createHash('sha256').update(buffer).digest('hex');
}

async function main() {
  if (!existsSync(sourceDir)) {
    console.error(`[godot-assets] source directory missing: ${sourceDir}`);
    process.exit(1);
  }
  const sourceFiles = new Set((await readdir(sourceDir)).filter((f) => f.endsWith('.jpg')));
  const expectedFiles = new Set(EXPECTED_IDS.map((id) => `${id}.jpg`));
  const missing = [...expectedFiles].filter((f) => !sourceFiles.has(f));
  const unexpected = [...sourceFiles].filter((f) => !expectedFiles.has(f));
  if (missing.length > 0 || unexpected.length > 0) {
    console.error('[godot-assets] asset set does not match the expected 44 ids');
    for (const id of missing) console.error(`  missing: ${id}`);
    for (const id of unexpected) console.error(`  unexpected: ${id}`);
    process.exit(1);
  }

  await rm(outDir, { recursive: true, force: true });
  await mkdir(outDir, { recursive: true });

  const sharpVersion = sharp.versions.sharp;
  const entries = {};
  let resized = 0;
  let copiedScale = 0;

  for (const id of EXPECTED_IDS) {
    const sourcePath = path.join(sourceDir, `${id}.jpg`);
    const source = await readFile(sourcePath);
    const metadata = await sharp(source).metadata();
    const targetWidth = Math.min(MAX_WIDTH, metadata.width);
    if (targetWidth < metadata.width) resized += 1;
    else copiedScale += 1;
    const derivative = await sharp(source)
      .resize({ width: targetWidth, withoutEnlargement: true })
      .png(PNG_OPTIONS)
      .toBuffer();
    const outPath = path.join(outDir, `${id}.png`);
    await writeFile(outPath, derivative);
    entries[id] = {
      source: `assets/${id}.jpg`,
      sourceSha256: sha256(source),
      sourceSize: { width: metadata.width, height: metadata.height },
      derivative: `godot/assets/cards/${id}.png`,
      derivativeSha256: sha256(derivative),
      derivativeBytes: derivative.length,
      derivativeWidth: targetWidth,
      // Height preserved by aspect ratio; recorded so a regression in the
      // resize pipeline is visible without decoding the PNG.
      derivativeHeight: Math.round((targetWidth / metadata.width) * metadata.height),
    };
  }

  const manifest = {
    tool: `sharp@${sharpVersion}`,
    maxDerivativeWidth: MAX_WIDTH,
    pngOptions: PNG_OPTIONS,
    // Godot import options applied to these derivatives by export-godot.mjs
    // (patched into the generated .import files; verified post-import).
    importOptions: {
      compressMode: 'lossy(1)',
      lossyQuality: Number(process.env.GODOT_CARD_LOSSY_QUALITY ?? 0.8),
      mipmaps: false,
    },
    expectedCardCount: EXPECTED_IDS.length,
    entries,
  };
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

  const totalBytes = Object.values(entries).reduce((sum, e) => sum + e.derivativeBytes, 0);
  console.log(
    `[godot-assets] staged ${EXPECTED_IDS.length} derivatives ` +
      `(${resized} resized to ≤${MAX_WIDTH}px, ${copiedScale} at native width), ` +
      `${(totalBytes / 1024 / 1024).toFixed(2)} MiB PNG staging → godot/assets/cards/`,
  );
}

main().catch((error) => {
  console.error('[godot-assets] failed:', error);
  process.exit(1);
});
