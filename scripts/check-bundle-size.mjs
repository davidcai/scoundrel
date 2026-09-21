#!/usr/bin/env node
/**
 * CI bundle-size budget (phaser-adoption-plan.md, Phase 4/5: "CI size-budget
 * check — `#/play` chunk ≤ +400KB gz").
 *
 * Budget mapping: the plan's gate is the `#/play` DELTA at ≤ +400KB gz over
 * the pre-Phaser baseline (~30KB gz for the play chunk, ~90KB gz total JS).
 * Measured Phase 1 numbers: phaser.esm ≈ 383KB gz, board-scene ≈ 1.8KB gz.
 * We therefore enforce, with documented headroom:
 *   - every JS chunk ≤ 420KB gz   (383 + headroom for the phaser bundle)
 *   - total JS        ≤ 550KB gz  (~90 baseline + 383 phaser + growth headroom)
 * A violation of either cap means the plan's +400KB delta gate is blown.
 *
 * Gzip sizes are computed with node:zlib at the default level — close to
 * what a server/CDN serves; Vite's own reported "gzip" numbers use the same
 * library, so they are comparable.
 *
 * No new dependencies. Fails (exit 1) with a per-chunk table on violation.
 */

import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import path from 'node:path';

const KB = 1024;
const CHUNK_BUDGET_KB = 420;
const TOTAL_BUDGET_KB = 550;

const assetsDir = path.resolve(process.cwd(), 'dist', 'assets');

if (!existsSync(assetsDir)) {
  console.error(`✗ ${assetsDir} not found — run \`pnpm build\` before the budget check.`);
  process.exit(1);
}

const chunks = readdirSync(assetsDir)
  .filter((file) => file.endsWith('.js'))
  .map((file) => {
    const raw = readFileSync(path.join(assetsDir, file));
    return {
      file,
      rawKb: raw.length / KB,
      gzKb: gzipSync(raw).length / KB,
    };
  })
  .sort((a, b) => b.gzKb - a.gzKb);

if (chunks.length === 0) {
  console.error(`✗ no JS chunks found in ${assetsDir} — was the build produced correctly?`);
  process.exit(1);
}

const totalGzKb = chunks.reduce((sum, chunk) => sum + chunk.gzKb, 0);
const overChunks = chunks.filter((chunk) => chunk.gzKb > CHUNK_BUDGET_KB);
const totalOver = totalGzKb > TOTAL_BUDGET_KB;

const kb = (value) => value.toFixed(1).padStart(7);
const name = (file) => (file.length > 46 ? `…${file.slice(-45)}` : file);

console.log('bundle size budget (gzip, KB)');
console.log(`  per-chunk ≤ ${CHUNK_BUDGET_KB} · total ≤ ${TOTAL_BUDGET_KB}`);
console.log();
console.log(
  `${'chunk'.padEnd(48)}${'raw'.padStart(9)}${'gz'.padStart(9)}${'budget'.padStart(9)}  status`,
);
for (const chunk of chunks) {
  const over = chunk.gzKb > CHUNK_BUDGET_KB;
  console.log(
    `${name(chunk.file).padEnd(48)}${kb(chunk.rawKb)}${kb(chunk.gzKb)}${kb(CHUNK_BUDGET_KB)}  ${over ? '✗ OVER' : 'ok'}`,
  );
}
console.log(`${'-'.repeat(48)}${'-'.repeat(27)}`);
console.log(
  `${`total (${chunks.length} chunk${chunks.length === 1 ? '' : 's'})`.padEnd(48)}${' '.repeat(9)}${kb(totalGzKb)}${kb(TOTAL_BUDGET_KB)}  ${totalOver ? '✗ OVER' : 'ok'}`,
);
console.log();

if (overChunks.length > 0 || totalOver) {
  for (const chunk of overChunks) {
    console.error(
      `✗ ${chunk.file}: ${chunk.gzKb.toFixed(1)}KB gz exceeds the ${CHUNK_BUDGET_KB}KB gz chunk budget by ${(chunk.gzKb - CHUNK_BUDGET_KB).toFixed(1)}KB`,
    );
  }
  if (totalOver) {
    console.error(
      `✗ total JS: ${totalGzKb.toFixed(1)}KB gz exceeds the ${TOTAL_BUDGET_KB}KB gz budget by ${(totalGzKb - TOTAL_BUDGET_KB).toFixed(1)}KB`,
    );
  }
  console.error('  Bundle budget blown — see docs/plans/phaser-adoption-plan.md (Phase 4/5).');
  process.exit(1);
}

console.log('✓ bundle size within budget.');
