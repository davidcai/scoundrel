#!/usr/bin/env node
/**
 * Bundle-size gate for the Scoundrel production build.
 *
 * Measurement basis: gzip size (node:zlib level 9) of the built files in
 * `dist/`, because that approximates what a browser downloads for the static
 * build. Only gzip sizes are gated; raw sizes are not reported or budgeted.
 *
 * The gate budgets code, not artwork: the 44 PNG illustrations are the known
 * dominant payload (~106 MB) and are covered by the asset-weight decision in
 * docs/implementation-plan.md.
 *
 * Usage: pnpm build && pnpm bundle-size
 * Budget overrides (KiB, for deliberate negative testing only):
 *   BUNDLE_ENTRY_JS_GZIP_MAX_KB, BUNDLE_TOTAL_JS_GZIP_MAX_KB, BUNDLE_TOTAL_CSS_GZIP_MAX_KB
 */

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import process from 'node:process';
import { fileURLToPath, URL } from 'node:url';
import { gzipSync } from 'node:zlib';

const PROJECT_DIR = fileURLToPath(new URL('../', import.meta.url));
const DIST_DIR = join(PROJECT_DIR, 'dist');
const KIB = 1024;

/** Keep these limits in sync with docs/implementation-plan.md. */
const BUDGETS = [
  { key: 'entryJs', label: 'entry JS', limitKiB: 250, env: 'BUNDLE_ENTRY_JS_GZIP_MAX_KB' },
  { key: 'totalJs', label: 'total JS', limitKiB: 350, env: 'BUNDLE_TOTAL_JS_GZIP_MAX_KB' },
  { key: 'totalCss', label: 'total CSS', limitKiB: 50, env: 'BUNDLE_TOTAL_CSS_GZIP_MAX_KB' },
];

function log(line) {
  process.stdout.write(`${line}\n`);
}

function fail(message) {
  process.stderr.write(`bundle-size: ${message}\n`);
  process.exitCode = 1;
}

function formatKiB(bytes) {
  return `${(bytes / KIB).toFixed(2)} KiB`;
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

function measure(file) {
  const raw = readFileSync(file);
  return { raw: raw.length, gzip: gzipSync(raw, { level: 9 }).length };
}

function displayPath(file) {
  return relative(DIST_DIR, file).split(sep).join('/');
}

function resolveBuildReference(reference, filesByPath) {
  const pathname = decodeURIComponent(reference.split('?')[0].split('#')[0]);
  const withoutLeadingSlashes = pathname.replace(/^\/+/, '');
  const exact = filesByPath.get(withoutLeadingSlashes);
  if (exact !== undefined) return exact;

  // A non-root Vite BASE_URL prefixes the emitted URLs; match the hashed
  // basename against the built files instead of assuming the base is `/`.
  const basename = withoutLeadingSlashes.split('/').pop() ?? '';
  const matches = [...filesByPath.entries()].filter(
    ([relativePath]) => relativePath.split('/').pop() === basename,
  );
  if (matches.length === 1) return matches[0][1];
  throw new Error(`cannot resolve build reference "${reference}" to a single file in dist/`);
}

function readBudgetOverride(budget) {
  const raw = process.env[budget.env];
  if (raw === undefined || raw === '') return undefined;
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${budget.env} must be a positive number of KiB (received "${raw}")`);
  }
  return value;
}

function main() {
  if (!existsSync(DIST_DIR)) {
    fail('dist/ not found — run "pnpm build" first.');
    return;
  }

  const files = walk(DIST_DIR);
  const filesByPath = new Map(files.map((file) => [displayPath(file), file]));
  const indexHtml = filesByPath.get('index.html');
  if (indexHtml === undefined) {
    fail('dist/index.html not found — the Vite build output is incomplete.');
    return;
  }

  const html = readFileSync(indexHtml, 'utf8');
  const scriptRefs = [...html.matchAll(/<script\b[^>]*\bsrc="([^"]+)"/g)].map((match) => match[1]);
  const styleRefs = [...html.matchAll(/<link\b[^>]*>/g)]
    .map((match) => match[0])
    .filter((tag) => /\brel="stylesheet"/.test(tag))
    .map((tag) => tag.match(/\bhref="([^"]+)"/)?.[1])
    .filter((href) => typeof href === 'string');

  if (scriptRefs.length === 0) {
    fail('dist/index.html references no JavaScript entry — nothing to budget.');
    return;
  }

  const entryFiles = [...new Set(scriptRefs.map((ref) => resolveBuildReference(ref, filesByPath)))];
  const entryCssFiles = [
    ...new Set(styleRefs.map((ref) => resolveBuildReference(ref, filesByPath))),
  ];
  const jsFiles = files.filter((file) => file.endsWith('.js'));
  const cssFiles = files.filter((file) => file.endsWith('.css'));
  const sumGzip = (measured) => measured.reduce((total, item) => total + item.gzip, 0);

  const measurements = {
    entryJs: sumGzip(entryFiles.map(measure)),
    totalJs: sumGzip(jsFiles.map(measure)),
    totalCss: sumGzip(cssFiles.map(measure)),
  };

  log('bundle-size: gzip measurement (node:zlib level 9) of dist/');
  log(`  dist: ${DIST_DIR}`);
  log(`  entry: ${entryFiles.map(displayPath).join(', ')}`);
  log(`  styles: ${entryCssFiles.map(displayPath).join(', ') || '(none)'}`);
  log(`  files: ${jsFiles.length} JS, ${cssFiles.length} CSS`);

  let failed = false;
  for (const budget of BUDGETS) {
    const override = readBudgetOverride(budget);
    const limitKiB = override ?? budget.limitKiB;
    const limit = Math.round(limitKiB * KIB);
    const measured = measurements[budget.key];
    const passed = measured <= limit;
    if (!passed) failed = true;
    const source = override === undefined ? '' : ' [env override]';
    log(
      `  ${budget.label.padEnd(9)} ${formatKiB(measured).padStart(12)} / ${formatKiB(limit).padStart(12)}  ${passed ? 'PASS' : 'FAIL'}${source}`,
    );
  }

  if (failed) {
    fail(
      [
        'budget exceeded.',
        '  Reduce the bundle, or raise the documented budget in docs/implementation-plan.md',
        '  and scripts/check-bundle-size.mjs after reviewing the cause.',
      ].join('\n'),
    );
    return;
  }

  log('bundle-size: passed.');
}

try {
  main();
} catch (caught) {
  fail(caught instanceof Error ? caught.message : String(caught));
}
