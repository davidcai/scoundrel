#!/usr/bin/env node
/**
 * check-godot-artifacts.mjs — validate and measure a Godot board export
 * (godot-plan.md, "Static artifact integration" + Payload gate).
 *
 * Checks the export at public/godot/<build-id>/:
 *   - board.html exists and every local file it references is present;
 *     the expected engine artifact set (loader JS / wasm / pck) is derived
 *     from the generated `$GODOT_CONFIG` `executable` name — never hardcoded,
 *     so a Godot upgrade that renames outputs fails loudly here
 *   - the PCK contains all 44 card textures (deck completeness: the plan
 *     requires the full optimized deck in the export even though the scene
 *     shows four sprites)
 *   - measures raw/gzip/brotli bytes per file and the compressed cold-payload
 *     total against the 5 MiB budget — Phase 1 reports (decision input),
 *     `--strict` fails (Phase 4 pre-rollout gate)
 *   - writes export-manifest.json (buildId, per-file sizes/hashes, totals)
 *
 * Brotli figures use quality 5 (close to edge defaults); they are decision
 * inputs, not a substitute for the deployed-transfer measurement (plan: gzip
 * AND brotli AND actual network transfer are separate rows).
 */

import { createHash } from 'node:crypto';
import { gzipSync, brotliCompressSync, constants as zlibConstants } from 'node:zlib';
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const buildIdFlag = argv.indexOf('--build-id');
const buildId = buildIdFlag !== -1 ? argv[buildIdFlag + 1] : 'spike';
const strict = argv.includes('--strict');

/** Hard compressed-cold-payload budget (Phase 4 gate; Phase 1 reports). */
const PAYLOAD_BUDGET_BYTES = 5 * 1024 * 1024;
const EXPECTED_DECK_COUNT = 44;

const exportDir = path.join(repoRoot, 'public', 'godot', buildId);
const problems = [];
const warnings = [];

function fail(message) {
  problems.push(message);
}

function warn(message) {
  warnings.push(message);
}

function referencedFiles(html) {
  // Local script/link/img references from the generated shell (skip absolute URLs/data:).
  const refs = new Set();
  for (const match of html.matchAll(/(?:src|href)="([^"]+)"/g)) {
    const url = match[1];
    if (
      url.startsWith('http://') ||
      url.startsWith('https://') ||
      url.startsWith('data:') ||
      url.startsWith('#')
    )
      continue;
    refs.add(url.replace(/^\.\//, '').split('?')[0]);
  }
  return refs;
}

function deckCountInPck(pckBuffer) {
  // PCK paths are length-prefixed UTF-8 — a latin1 scan finds them without
  // parsing the (version-dependent) header structure. Count DISTINCT ids.
  const haystack = pckBuffer.toString('latin1');
  const ids = new Set();
  for (const match of haystack.matchAll(/res:\/\/assets\/cards\/([a-z]+-(?:10|[2-9jqka]))\.png/g)) {
    ids.add(match[1]);
  }
  return ids.size;
}

function measure(file) {
  const buffer = readFileSync(file);
  return {
    bytes: statSync(file).size,
    gzip: gzipSync(buffer, { level: 9 }).length,
    brotli: brotliCompressSync(buffer, { params: { [zlibConstants.BROTLI_PARAM_QUALITY]: 5 } })
      .length,
    sha256: createHash('sha256').update(buffer).digest('hex'),
  };
}

function main() {
  if (!existsSync(exportDir)) {
    console.error(`[godot-check] export directory missing: ${exportDir}`);
    console.error(
      '[godot-check] run `pnpm godot:export` first (downloads the pinned toolchain on first use)',
    );
    process.exit(1);
  }
  const files = readdirSync(exportDir);
  const boardHtmlPath = path.join(exportDir, 'board.html');
  if (!existsSync(boardHtmlPath)) {
    fail('board.html missing (custom shell export did not run?)');
  } else {
    const html = readFileSync(boardHtmlPath, 'utf8');
    for (const ref of referencedFiles(html)) {
      if (!existsSync(path.join(exportDir, ref))) {
        fail(`board.html references missing file: ${ref}`);
      }
    }
    const exeMatch = html.match(/"executable"\s*:\s*"([^"]+)"/);
    if (exeMatch === null) {
      fail('generated $GODOT_CONFIG has no executable name (placeholder not expanded?)');
    } else {
      const exe = exeMatch[1];
      for (const suffix of ['wasm', 'pck']) {
        if (!files.includes(`${exe}.${suffix}`)) {
          fail(`expected engine artifact missing: ${exe}.${suffix}`);
        }
      }
      const loader = files.find((f) => f.endsWith('.js') && f !== 'board.html');
      if (loader === undefined) fail('no loader JS found next to board.html');
    }
  }

  // Deck completeness inside the PCK.
  const pckFile = files.find((f) => f.endsWith('.pck'));
  let deckCount = 0;
  if (pckFile !== undefined) {
    deckCount = deckCountInPck(readFileSync(path.join(exportDir, pckFile)));
    if (deckCount !== EXPECTED_DECK_COUNT) {
      fail(
        `PCK contains ${deckCount}/${EXPECTED_DECK_COUNT} card textures — full optimized deck required (plan Phase 1)`,
      );
    }
  } else {
    fail('no .pck file in export output');
  }

  // Sizes + manifest.
  const manifest = { buildId, files: {}, deckCount, totals: {} };
  let totalRaw = 0;
  let totalGzip = 0;
  let totalBrotli = 0;
  for (const file of files.sort()) {
    const filePath = path.join(exportDir, file);
    if (!statSync(filePath).isFile()) continue;
    const m = measure(filePath);
    manifest.files[file] = m;
    totalRaw += m.bytes;
    totalGzip += m.gzip;
    totalBrotli += m.brotli;
  }
  manifest.totals = {
    raw: totalRaw,
    gzip: totalGzip,
    brotli: totalBrotli,
    budgetBytes: PAYLOAD_BUDGET_BYTES,
  };
  writeFileSync(
    path.join(exportDir, 'export-manifest.json'),
    `${JSON.stringify(manifest, null, 2)}\n`,
  );

  console.log('godot export artifacts (public/godot/%s)', buildId);
  console.log('  %-34s %12s %12s %12s', 'file', 'raw', 'gzip', 'brotli');
  for (const [file, m] of Object.entries(manifest.files)) {
    console.log('  %-34s %12s %12s %12s', file, fmt(m.bytes), fmt(m.gzip), fmt(m.brotli));
  }
  console.log(
    '  %-34s %12s %12s %12s',
    'TOTAL (cold payload)',
    fmt(totalRaw),
    fmt(totalGzip),
    fmt(totalBrotli),
  );
  console.log('  deck textures in PCK: %d/%d', deckCount, EXPECTED_DECK_COUNT);

  const overBy = totalGzip - PAYLOAD_BUDGET_BYTES;
  if (overBy > 0) {
    const message = `compressed payload ${fmt(totalGzip)} exceeds the 5 MiB budget by ${fmt(overBy)}`;
    if (strict) fail(message);
    else warn(`${message} (reported only in Phase 1; hard gate is Phase 4 — use --strict)`);
  } else {
    console.log('  payload budget: OK (%s gzip ≤ 5.0 MiB)', fmt(totalGzip));
  }

  for (const warning of warnings) console.warn(`[godot-check] WARNING: ${warning}`);
  if (problems.length > 0) {
    for (const problem of problems) console.error(`[godot-check] FAIL: ${problem}`);
    process.exit(1);
  }
  console.log('[godot-check] artifacts validated; manifest written (export-manifest.json)');
}

const MIB = 1024 * 1024;
function fmt(bytes) {
  return bytes >= MIB ? `${(bytes / MIB).toFixed(2)} MiB` : `${(bytes / 1024).toFixed(1)} kB`;
}

main();
