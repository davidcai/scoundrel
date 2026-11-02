#!/usr/bin/env node
/**
 * Release-asset audit for the Scoundrel production build.
 *
 * Provides the docs/implementation-plan.md §5 evidence that the shipped build
 * contains exactly the current 44 PNG card illustrations (1024x1536, byte
 * identical to `assets/`), one hashed JavaScript entry, one hashed stylesheet,
 * no archived or JPEG artwork, and a static-safe vercel.json. It also reports
 * the payload a browser downloads.
 *
 * Usage: pnpm build && pnpm check:release-assets [--json <file>]
 *   --json <file>  write a machine-readable summary for CI artifacts.
 */

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import process from 'node:process';
import { fileURLToPath, URL } from 'node:url';
import { gzipSync } from 'node:zlib';

const PROJECT_DIR = fileURLToPath(new URL('../', import.meta.url));
const ASSETS_DIR = join(PROJECT_DIR, 'assets');
const DIST_DIR = join(PROJECT_DIR, 'dist');
const INDEX_FILE = join(DIST_DIR, 'index.html');
const VERCEL_FILE = join(PROJECT_DIR, 'vercel.json');

const KIB = 1024;
const MIB = 1024 * 1024;
const EXPECTED_PNG_COUNT = 44;
const EXPECTED_ASSET_COUNT = 46; // 44 PNG + 1 JS + 1 CSS in dist/assets/
const EXPECTED_DIST_FILE_COUNT = 47; // 46 hashed assets + index.html
const CARD_WIDTH = 1024;
const CARD_HEIGHT = 1536;
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

const MONSTER_RANKS = ['a', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'j', 'q', 'k'];
const NUMBER_RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', '10'];
const EXPECTED_CARD_NAMES = [
  ...MONSTER_RANKS.map((rank) => `club-${rank}.png`),
  ...MONSTER_RANKS.map((rank) => `spade-${rank}.png`),
  ...NUMBER_RANKS.map((rank) => `diamond-${rank}.png`),
  ...NUMBER_RANKS.map((rank) => `heart-${rank}.png`),
].sort();
const HASHED_CARD_PATTERN =
  /^(club|spade|diamond|heart)-(a|2|3|4|5|6|7|8|9|10|j|q|k)-[A-Za-z0-9_-]+\.png$/;

const errors = [];

function log(line) {
  process.stdout.write(`${line}\n`);
}

function fail(message) {
  errors.push(message);
  process.stderr.write(`release-assets: ${message}\n`);
}

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function formatKiB(bytes) {
  return `${(bytes / KIB).toFixed(2)} KiB`;
}

function formatMiB(bytes) {
  return `${(bytes / MIB).toFixed(2)} MiB`;
}

function walk(directory) {
  const files = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const absolute = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...walk(absolute));
    else if (entry.isFile()) files.push(absolute);
  }
  return files;
}

function toPosix(filePath) {
  return filePath.split(sep).join('/');
}

function readPngHeader(bytes, label) {
  if (bytes.length < 24 || !bytes.subarray(0, 8).equals(PNG_SIGNATURE)) {
    fail(`${label} is not a PNG file.`);
    return null;
  }
  if (bytes.toString('latin1', 12, 16) !== 'IHDR') {
    fail(`${label} has no PNG IHDR chunk.`);
    return null;
  }
  const width = bytes.readUInt32BE(16);
  const height = bytes.readUInt32BE(20);
  if (width !== CARD_WIDTH || height !== CARD_HEIGHT) {
    fail(`${label} is ${width}x${height}; expected ${CARD_WIDTH}x${CARD_HEIGHT}.`);
  }
  return { width, height };
}

function attribute(tag, name) {
  const match = tag.match(new RegExp(`\\b${name}\\s*=\\s*"([^"]*)"`, 'i'));
  return match ? match[1] : null;
}

function extractReferences(indexHtml) {
  const scripts = [];
  const stylesheets = [];
  for (const tag of indexHtml.match(/<script\b[^>]*>/gi) ?? []) {
    const src = attribute(tag, 'src');
    if (src) scripts.push(src);
  }
  for (const tag of indexHtml.match(/<link\b[^>]*>/gi) ?? []) {
    const rel = attribute(tag, 'rel');
    if (rel && rel.split(/\s+/).includes('stylesheet')) {
      const href = attribute(tag, 'href');
      if (href) stylesheets.push(href);
    }
  }
  return { scripts, stylesheets };
}

function resolveReference(reference, filesByPath) {
  const pathname = decodeURIComponent(reference.split('?')[0].split('#')[0]);
  const withoutLeadingSlashes = pathname.replace(/^\/+/, '');
  const exact = filesByPath.get(withoutLeadingSlashes);
  if (exact !== undefined) return exact;

  // A non-root Vite BASE_URL prefixes the emitted URLs; match the hashed
  // basename against the built files instead of assuming the base is `/`.
  const basename = withoutLeadingSlashes.split('/').pop() ?? '';
  const matches = [...filesByPath.values()].filter(
    (file) => file.relativePath.split('/').pop() === basename,
  );
  return matches.length === 1 ? matches[0] : null;
}

function auditSourceAssets() {
  if (!existsSync(ASSETS_DIR)) {
    fail('assets/ directory not found.');
    return new Map();
  }

  const entries = readdirSync(ASSETS_DIR).sort();
  const pngNames = entries.filter((name) => name.toLowerCase().endsWith('.png'));
  const unexpected = entries.filter(
    (name) => name !== '.DS_Store' && !name.toLowerCase().endsWith('.png'),
  );
  if (unexpected.length > 0) fail(`assets/ contains unexpected files: ${unexpected.join(', ')}`);
  if (pngNames.length !== EXPECTED_PNG_COUNT) {
    fail(`assets/ has ${pngNames.length} PNG files; expected ${EXPECTED_PNG_COUNT}.`);
  }
  const missing = EXPECTED_CARD_NAMES.filter((name) => !pngNames.includes(name));
  if (missing.length > 0) fail(`assets/ is missing expected cards: ${missing.join(', ')}`);
  const extra = pngNames.filter((name) => !EXPECTED_CARD_NAMES.includes(name));
  if (extra.length > 0) fail(`assets/ contains unexpected cards: ${extra.join(', ')}`);

  const sourceSha256 = new Map();
  for (const name of EXPECTED_CARD_NAMES) {
    if (!pngNames.includes(name)) continue;
    const bytes = readFileSync(join(ASSETS_DIR, name));
    readPngHeader(bytes, `assets/${name}`);
    sourceSha256.set(name, sha256(bytes));
  }
  return sourceSha256;
}

function auditVercelConfig() {
  if (!existsSync(VERCEL_FILE)) {
    fail('vercel.json not found.');
    return false;
  }
  let config;
  try {
    config = JSON.parse(readFileSync(VERCEL_FILE, 'utf8'));
  } catch (error) {
    fail(`vercel.json is not valid JSON (${error.message}).`);
    return false;
  }
  if (config.framework !== 'vite') fail('vercel.json must use the vite framework.');
  if (!String(config.installCommand ?? '').includes('--frozen-lockfile')) {
    fail('vercel.json installCommand must install from the frozen lockfile.');
  }
  if (!String(config.buildCommand ?? '').includes('pnpm build')) {
    fail('vercel.json buildCommand must run the repository build.');
  }
  if (config.outputDirectory !== 'dist') fail('vercel.json outputDirectory must be dist.');
  const assetsHeader = (config.headers ?? []).find((entry) => entry.source === '/assets/(.*)');
  const cacheControl = (assetsHeader?.headers ?? []).find(
    (header) => header.key === 'Cache-Control',
  );
  if (!String(cacheControl?.value ?? '').includes('immutable')) {
    fail('vercel.json must cache /assets/* as immutable.');
  }
  if (config.rewrites !== undefined && config.rewrites.length > 0) {
    fail('vercel.json must not rewrite routes: the app uses hash routing.');
  }
  return true;
}

function auditDist(sourceSha256) {
  if (!existsSync(DIST_DIR)) {
    fail('dist/ not found — run "pnpm build" first.');
    return null;
  }
  if (!existsSync(INDEX_FILE)) {
    fail('dist/index.html not found — the Vite build output is incomplete.');
    return null;
  }

  const distFiles = walk(DIST_DIR)
    .map((absolute) => {
      const relativePath = toPosix(relative(DIST_DIR, absolute));
      return { absolute, relativePath };
    })
    .sort((left, right) => left.relativePath.localeCompare(right.relativePath));
  const filesByPath = new Map(distFiles.map((file) => [file.relativePath, file]));

  if (distFiles.length !== EXPECTED_DIST_FILE_COUNT) {
    fail(
      `dist/ has ${distFiles.length} files; expected ${EXPECTED_DIST_FILE_COUNT} (index.html + ${EXPECTED_ASSET_COUNT} hashed assets).`,
    );
  }

  const pngFiles = distFiles.filter((file) => file.relativePath.toLowerCase().endsWith('.png'));
  const jsFiles = distFiles.filter((file) => file.relativePath.endsWith('.js'));
  const cssFiles = distFiles.filter((file) => file.relativePath.endsWith('.css'));
  const otherFiles = distFiles.filter(
    (file) => !/\.(png|js|css)$/i.test(file.relativePath) && file.relativePath !== 'index.html',
  );
  if (pngFiles.length !== EXPECTED_PNG_COUNT) {
    fail(`dist/ contains ${pngFiles.length} PNG files; expected ${EXPECTED_PNG_COUNT}.`);
  }
  if (jsFiles.length !== 1)
    fail(`dist/ must contain exactly one JavaScript entry, found ${jsFiles.length}.`);
  if (cssFiles.length !== 1)
    fail(`dist/ must contain exactly one stylesheet, found ${cssFiles.length}.`);
  if (otherFiles.length > 0) {
    fail(
      `dist/ contains unexpected files: ${otherFiles.map((file) => file.relativePath).join(', ')}`,
    );
  }

  const indexHtml = readFileSync(INDEX_FILE, 'utf8');
  const indexLower = indexHtml.toLowerCase();
  for (const needle of ['assets-old', '.jpg', '.jpeg']) {
    if (indexLower.includes(needle)) fail(`dist/index.html references "${needle}".`);
  }

  const distSha256 = new Map();
  for (const file of pngFiles) {
    if (file.relativePath.includes('assets-old'))
      fail(`dist/${file.relativePath} is archived artwork.`);
    if (/\.jpe?g$/i.test(file.relativePath)) fail(`dist/${file.relativePath} is a JPEG asset.`);
    const basename = file.relativePath.split('/').pop() ?? '';
    const match = basename.match(HASHED_CARD_PATTERN);
    if (!match) {
      fail(`dist/${file.relativePath} is not a hashed current-card build name.`);
      continue;
    }
    const sourceName = `${match[1]}-${match[2]}.png`;
    if (!EXPECTED_CARD_NAMES.includes(sourceName)) {
      fail(`dist/${file.relativePath} maps to unexpected source ${sourceName}.`);
      continue;
    }
    if (distSha256.has(sourceName)) {
      fail(`dist/${file.relativePath} duplicates source ${sourceName}.`);
      continue;
    }
    const bytes = readFileSync(file.absolute);
    readPngHeader(bytes, `dist/${file.relativePath}`);
    distSha256.set(sourceName, sha256(bytes));
  }
  for (const [sourceName, expectedHash] of sourceSha256) {
    const builtHash = distSha256.get(sourceName);
    if (builtHash === undefined) fail(`dist/ is missing current card ${sourceName}.`);
    else if (builtHash !== expectedHash)
      fail(`dist/${sourceName} does not match assets/${sourceName}.`);
  }

  const { scripts, stylesheets } = extractReferences(indexHtml);
  if (scripts.length !== 1)
    fail(`dist/index.html references ${scripts.length} scripts; expected 1.`);
  if (stylesheets.length !== 1) {
    fail(`dist/index.html references ${stylesheets.length} stylesheets; expected 1.`);
  }
  const entryJs = scripts.length === 1 ? resolveReference(scripts[0], filesByPath) : null;
  const entryCss = stylesheets.length === 1 ? resolveReference(stylesheets[0], filesByPath) : null;
  if (scripts.length === 1 && entryJs === null) {
    fail(`dist/index.html script "${scripts[0]}" does not resolve to a dist file.`);
  }
  if (stylesheets.length === 1 && entryCss === null) {
    fail(`dist/index.html stylesheet "${stylesheets[0]}" does not resolve to a dist file.`);
  }
  if (entryJs && !entryJs.relativePath.endsWith('.js')) fail('the entry script is not a .js file.');
  if (entryCss && !entryCss.relativePath.endsWith('.css')) {
    fail('the entry stylesheet is not a .css file.');
  }

  return {
    files: distFiles,
    pngFiles,
    entryJs,
    entryCss,
    indexHtmlBytes: readFileSync(INDEX_FILE).length,
    sourceSha256,
    distSha256,
    artworkBytes: pngFiles.reduce((total, file) => total + readFileSync(file.absolute).length, 0),
  };
}

function printPayload(audit) {
  const totalBytes = audit.files.reduce(
    (total, file) => total + readFileSync(file.absolute).length,
    0,
  );
  const smallestCard = [...audit.pngFiles]
    .map((file) => ({ name: file.relativePath, bytes: readFileSync(file.absolute).length }))
    .sort((left, right) => left.bytes - right.bytes)[0];
  const entryJsBytes = audit.entryJs ? readFileSync(audit.entryJs.absolute) : null;
  const entryCssBytes = audit.entryCss ? readFileSync(audit.entryCss.absolute) : null;

  log(
    `release-assets: dist ${audit.files.length} files, ${formatMiB(totalBytes)} (${totalBytes} bytes)`,
  );
  log(
    `release-assets: artwork ${audit.pngFiles.length}/${EXPECTED_PNG_COUNT} current PNGs, ${formatMiB(audit.artworkBytes)}, ${CARD_WIDTH}x${CARD_HEIGHT} (${totalBytes >= 0 ? audit.distSha256.size : 0}/${EXPECTED_PNG_COUNT} hashes verified)`,
  );
  log(
    `release-assets: document ${formatKiB(audit.indexHtmlBytes)} (${audit.indexHtmlBytes} bytes)`,
  );
  if (entryJsBytes) {
    log(
      `release-assets: entry JS ${formatKiB(entryJsBytes.length)} raw, ${formatKiB(gzipSync(entryJsBytes, { level: 9 }).length)} gzip`,
    );
  }
  if (entryCssBytes) {
    log(
      `release-assets: entry CSS ${formatKiB(entryCssBytes.length)} raw, ${formatKiB(gzipSync(entryCssBytes, { level: 9 }).length)} gzip`,
    );
  }
  if (smallestCard) {
    log(
      `release-assets: smallest room card ${formatKiB(smallestCard.bytes)} (${smallestCard.name})`,
    );
  }
  return {
    totalBytes,
    totalMiB: Number((totalBytes / MIB).toFixed(2)),
    artworkBytes: audit.artworkBytes,
    artworkMiB: Number((audit.artworkBytes / MIB).toFixed(2)),
    indexBytes: audit.indexHtmlBytes,
    entryJs: entryJsBytes
      ? {
          rawBytes: entryJsBytes.length,
          gzipBytes: gzipSync(entryJsBytes, { level: 9 }).length,
        }
      : null,
    entryCss: entryCssBytes
      ? {
          rawBytes: entryCssBytes.length,
          gzipBytes: gzipSync(entryCssBytes, { level: 9 }).length,
        }
      : null,
    smallestCard: smallestCard ?? null,
  };
}

function main() {
  const jsonFlagIndex = process.argv.indexOf('--json');
  let jsonPath = null;
  if (jsonFlagIndex !== -1) {
    jsonPath = process.argv[jsonFlagIndex + 1];
    if (!jsonPath) fail('--json requires an output file path.');
  }
  const unknownArguments = process.argv.slice(2).filter((argument, index, all) => {
    if (argument === '--json') return false;
    return !(index > 0 && all[index - 1] === '--json');
  });
  if (unknownArguments.length > 0) {
    fail(`unknown arguments: ${unknownArguments.join(', ')}`);
  }

  log(`release-assets: auditing ${toPosix(relative(PROJECT_DIR, DIST_DIR))}/`);
  const sourceSha256 = auditSourceAssets();
  auditVercelConfig();
  const audit = auditDist(sourceSha256);
  let payload = null;
  if (audit) {
    payload = printPayload(audit);
    log(
      'release-assets: artwork hashes match assets/; no archived or JPEG artwork; vercel.json is static-safe.',
    );
  }

  const report = {
    ok: errors.length === 0,
    files: audit
      ? {
          total: audit.files.length,
          png: audit.pngFiles.length,
          expectedPng: EXPECTED_PNG_COUNT,
        }
      : null,
    artwork: {
      expected: EXPECTED_PNG_COUNT,
      filenamePattern: 'suits source names with Vite content hash',
      width: CARD_WIDTH,
      height: CARD_HEIGHT,
      sha256: audit ? Object.fromEntries(audit.distSha256) : {},
    },
    payload,
    errors,
  };
  if (jsonPath) {
    const absoluteJsonPath = resolve(process.cwd(), jsonPath);
    mkdirSync(dirname(absoluteJsonPath), { recursive: true });
    writeFileSync(absoluteJsonPath, `${JSON.stringify(report, null, 2)}\n`);
    log(`release-assets: wrote ${toPosix(relative(process.cwd(), absoluteJsonPath))}`);
  }

  if (errors.length > 0) {
    log(`release-assets: failed (${errors.length} problem${errors.length === 1 ? '' : 's'}).`);
    process.exitCode = 1;
    return;
  }
  log('release-assets: passed.');
}

main();
