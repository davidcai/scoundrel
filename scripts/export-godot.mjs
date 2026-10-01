#!/usr/bin/env node
/**
 * export-godot.mjs — reproducible Godot board export (godot-plan.md,
 * "Reproducible export"). Steps:
 *
 *   1. ensure the pinned toolchain (godot/toolchain.json): download the
 *      editor + export templates on first use into a local cache, verify
 *      SHA-512 against the pinned sums, extract in Godot self-contained mode
 *      (`_sc_` marker → editor_data/export_templates) — no system-wide install
 *   2. stage the 44 card derivatives (prepare-godot-assets.mjs)
 *   3. first headless import (generates .import files)
 *   4. patch every card texture's .import params to Lossy / 0.8 / no mipmaps
 *      (godot-plan.md: "Explicitly set Godot's texture import to Lossy,
 *      quality 0.8, mipmaps disabled"; a clean import must never silently
 *      revert to lossless defaults)
 *   5. second headless import (applies the patched params)
 *   6. `--export-release Web` into public/godot/<build-id>/board.html
 *   7. hand off to check-godot-artifacts.mjs for output validation
 *
 * Usage:
 *   node scripts/export-godot.mjs                    # full export (build-id: spike)
 *   node scripts/export-godot.mjs --import-only      # steps 1–5 (no export)
 *   node scripts/export-godot.mjs --build-id ci      # different output dir
 *
 * Environment:
 *   GODOT_TOOLCHAIN_DIR  override the toolchain cache location
 */

import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import {
  createReadStream,
  createWriteStream,
  existsSync,
  readFileSync,
  readdirSync,
  renameSync,
  writeFileSync,
  mkdirSync,
} from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const godotDir = path.join(repoRoot, 'godot');
const toolchainPath = path.join(godotDir, 'toolchain.json');

// ── args ────────────────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
const importOnly = argv.includes('--import-only');
const buildIdFlag = argv.indexOf('--build-id');
const buildId = buildIdFlag !== -1 ? argv[buildIdFlag + 1] : 'spike';
const skipAssets = argv.includes('--skip-assets');
const skipToolchain = argv.includes('--skip-toolchain');
const outputDir = path.join(repoRoot, 'public', 'godot', buildId);

// ── toolchain ───────────────────────────────────────────────────────────────
const toolchain = JSON.parse(readFileSync(toolchainPath, 'utf8'));
const versionDirName = `${toolchain.godotVersion}.${toolchain.godotRelease}`;
const platformKey = process.platform === 'win32' ? 'windows-x86_64' : 'linux-x86_64';
const platform = toolchain.platforms[platformKey];
const cacheDir =
  process.env.GODOT_TOOLCHAIN_DIR ?? path.join(repoRoot, '.toolchain', 'godot', toolchain.godotTag);
const editorDir = path.join(cacheDir, 'editor');
const editorExe = path.join(editorDir, platform.editor.binary);
// Windows: the _console.exe variant writes to stdout (needed for log checks).
const consoleExe =
  process.platform === 'win32'
    ? path.join(editorDir, platform.editor.binary.replace(/\.exe$/, '_console.exe'))
    : editorExe;
const editorBinary = existsSync(consoleExe) ? consoleExe : editorExe;
const templatesDir = path.join(editorDir, 'editor_data', 'export_templates', versionDirName);

function sha512File(filePath) {
  return new Promise((resolve, reject) => {
    const hash = createHash('sha512');
    createReadStream(filePath)
      .on('data', (c) => hash.update(c))
      .on('end', () => resolve(hash.digest('hex')))
      .on('error', reject);
  });
}

async function downloadTo(url, dest, expectedSha512, expectedSize) {
  console.log(
    `[godot-export] downloading ${path.basename(dest)} (${(expectedSize / 1024 / 1024).toFixed(1)} MB)`,
  );
  const response = await fetch(url, { redirect: 'follow' });
  if (!response.ok || !response.body) {
    throw new Error(`download failed: ${response.status} ${response.statusText}`);
  }
  await pipeline(Readable.fromWeb(response.body), createWriteStream(dest));
  const actual = await sha512File(dest);
  if (actual !== expectedSha512) {
    throw new Error(
      `checksum mismatch for ${path.basename(dest)}: expected ${expectedSha512}, got ${actual}`,
    );
  }
  console.log(`[godot-export] checksum ok: ${path.basename(dest)}`);
}

function extract(archive, destDir) {
  mkdirSync(destDir, { recursive: true });
  // Windows: System32's bsdtar handles zip — but Git Bash's GNU tar (first on
  // PATH) parses "C:\..." as a remote host, so pin the System32 binary.
  // Linux CI has unzip.
  const tar = path.join(process.env.SystemRoot ?? 'C:\\Windows', 'System32', 'tar.exe');
  const result =
    process.platform === 'win32'
      ? spawnSync(tar, ['-xf', archive, '-C', destDir], { stdio: 'inherit' })
      : spawnSync('unzip', ['-q', '-o', archive, '-d', destDir], { stdio: 'inherit' });
  if (result.status !== 0) {
    throw new Error(`extraction failed for ${path.basename(archive)} (status ${result.status})`);
  }
}

async function ensureToolchain() {
  const marker = path.join(editorDir, '_sc_');
  if (existsSync(editorBinary) && existsSync(templatesDir) && existsSync(marker)) {
    console.log(`[godot-export] toolchain cached: ${cacheDir}`);
    return;
  }
  mkdirSync(editorDir, { recursive: true });
  writeFileSync(marker, ''); // self-contained mode BEFORE any editor run

  const editorZip = path.join(cacheDir, path.basename(platform.editor.url));
  if (!existsSync(editorZip)) {
    await downloadTo(platform.editor.url, editorZip, platform.editor.sha512, platform.editor.size);
  }
  const templatesTpz = path.join(cacheDir, path.basename(platform.templates.url));
  if (!existsSync(templatesTpz)) {
    await downloadTo(
      platform.templates.url,
      templatesTpz,
      platform.templates.sha512,
      platform.templates.size,
    );
  }
  // Editor zip extracts flat (editor exe + console exe) → editor dir.
  if (!existsSync(editorBinary)) {
    extract(editorZip, editorDir);
  }
  // Templates tpz extracts to templates/… → editor_data/export_templates/<version>.
  if (!existsSync(templatesDir)) {
    const staging = path.join(cacheDir, 'templates-extract');
    extract(templatesTpz, staging);
    mkdirSync(templatesDir, { recursive: true });
    for (const entry of readdirSync(path.join(staging, 'templates'))) {
      const from = path.join(staging, 'templates', entry);
      const to = path.join(templatesDir, entry);
      // Cross-device rename can fail; fall back to shell copy (cache dir).
      try {
        renameSync(from, to);
      } catch {
        spawnSync(
          process.platform === 'win32' ? 'cmd' : 'cp',
          process.platform === 'win32' ? ['/c', 'copy', '/y', from, to] : [from, to],
          { stdio: 'ignore' },
        );
      }
    }
  }
  if (!existsSync(editorBinary) || !existsSync(templatesDir)) {
    throw new Error('toolchain installation incomplete (editor binary or templates missing)');
  }
  console.log(`[godot-export] toolchain ready: ${editorBinary}`);
}

// ── godot invocation ────────────────────────────────────────────────────────
function runGodot(args, label) {
  console.log(`[godot-export] ${label}: godot ${args.join(' ')}`);
  const result = spawnSync(editorBinary, ['--headless', '--path', godotDir, ...args], {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    timeout: 10 * 60 * 1000,
  });
  const output = `${result.stdout ?? ''}${result.stderr ?? ''}`;
  process.stdout.write(output);
  if (result.status !== 0) {
    throw new Error(`godot ${label} failed with exit code ${result.status}`);
  }
  // Loud, non-fatal signal of import problems (missing textures, script errors).
  const errorLines = output
    .split(/\r?\n/)
    .filter((l) => l.startsWith('ERROR') || l.includes('##ERROR##'));
  if (errorLines.length > 0) {
    console.warn(`[godot-export] WARNING: ${errorLines.length} ERROR lines in ${label} output`);
  }
  return output;
}

// ── import patching ─────────────────────────────────────────────────────────
const IMPORT_PARAMS = {
  'compress/mode': '1', // Lossy
  'compress/lossy_quality': '0.8',
  'mipmaps/generate': 'false',
};

function patchCardImports() {
  const cardsDir = path.join(godotDir, 'assets', 'cards');
  if (!existsSync(cardsDir)) {
    throw new Error('godot/assets/cards missing — run asset preparation first');
  }
  const importFiles = readdirSync(cardsDir).filter((f) => f.endsWith('.png.import'));
  if (importFiles.length !== 44) {
    throw new Error(`expected 44 generated .import files, found ${importFiles.length}`);
  }
  let patched = 0;
  for (const file of importFiles) {
    const filePath = path.join(cardsDir, file);
    const lines = readFileSync(filePath, 'utf8').split(/\r?\n/);
    let inParams = false;
    const found = new Set();
    const outLines = lines.map((line) => {
      if (line.trim() === '[params]') {
        inParams = true;
        return line;
      }
      if (line.startsWith('[')) {
        inParams = false;
        return line;
      }
      if (!inParams) return line;
      const eq = line.indexOf('=');
      if (eq === -1) return line;
      const key = line.slice(0, eq).trim();
      if (!(key in IMPORT_PARAMS)) return line;
      found.add(key);
      const updated = `${key}=${IMPORT_PARAMS[key]}`;
      return updated === line ? line : updated;
    });
    for (const key of Object.keys(IMPORT_PARAMS)) {
      if (!found.has(key)) outLines.splice(outLines.length, 0, `${key}=${IMPORT_PARAMS[key]}`);
    }
    if (outLines.join('\n') !== lines.join('\n')) {
      writeFileSync(filePath, `${outLines.join('\n')}\n`);
      patched += 1;
    }
  }
  console.log(`[godot-export] patched ${patched} texture .import files (lossy 0.8, no mipmaps)`);
}

// ── main ────────────────────────────────────────────────────────────────────
async function main() {
  const started = Date.now();
  if (!skipToolchain) {
    await ensureToolchain();
  } else {
    console.log('[godot-export] skipping toolchain check (--skip-toolchain)');
  }

  if (!skipAssets) {
    console.log('[godot-export] preparing card assets');
    const prepare = spawnSync(
      process.execPath,
      [path.join(repoRoot, 'scripts', 'prepare-godot-assets.mjs')],
      { stdio: 'inherit' },
    );
    if (prepare.status !== 0) throw new Error(`asset preparation failed (exit ${prepare.status})`);
  }

  runGodot(['--import'], 'import pass 1 (generate .import files)');
  patchCardImports();
  runGodot(['--import'], 'import pass 2 (apply patched import params)');

  if (importOnly) {
    console.log(
      `[godot-export] import-only complete in ${((Date.now() - started) / 1000).toFixed(1)}s`,
    );
    return;
  }

  mkdirSync(outputDir, { recursive: true });
  const boardHtml = path.join(outputDir, 'board.html');
  runGodot(['--export-release', 'Web', boardHtml], 'export release (Web)');

  console.log(
    `[godot-export] export complete in ${((Date.now() - started) / 1000).toFixed(1)}s → ${boardHtml}`,
  );
  const check = spawnSync(
    process.execPath,
    [path.join(repoRoot, 'scripts', 'check-godot-artifacts.mjs'), '--build-id', buildId],
    { stdio: 'inherit' },
  );
  if (check.status !== 0) {
    console.warn('[godot-export] artifact check reported problems (see above)');
    process.exitCode = check.status;
  }
}

main().catch((error) => {
  console.error('[godot-export] failed:', error.message);
  process.exit(1);
});
