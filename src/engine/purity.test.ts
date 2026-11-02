// @vitest-environment node
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * The engine boundary from docs/implementation-plan.md: pure TypeScript with no
 * interface, browser-storage, clock, or random-source dependencies. These checks
 * fail the suite if the boundary is crossed, even when behavior still passes.
 */

const engineDir = fileURLToPath(new URL('.', import.meta.url));

const sourceFiles = readdirSync(engineDir, { recursive: true, encoding: 'utf8' })
  .filter((file) => file.endsWith('.ts') && !file.endsWith('.test.ts'))
  .sort();

const FORBIDDEN_PATTERNS: readonly { readonly pattern: RegExp; readonly label: string }[] = [
  { pattern: /from\s+['"]react(?:-dom)?['"]/, label: 'React import' },
  { pattern: /\bwindow\b/, label: 'window access' },
  { pattern: /\bdocument\b/, label: 'document access' },
  { pattern: /\blocalStorage\b/, label: 'localStorage access' },
  { pattern: /\bsessionStorage\b/, label: 'sessionStorage access' },
  { pattern: /\bindexedDB\b/, label: 'indexedDB access' },
  { pattern: /\bfetch\s*\(/, label: 'fetch call' },
  { pattern: /\bXMLHttpRequest\b/, label: 'XMLHttpRequest access' },
  { pattern: /\bMath\.random\b/, label: 'Math.random call' },
  { pattern: /\bDate\.now\b/, label: 'Date.now call' },
  { pattern: /\bnew\s+Date\b/, label: 'Date construction' },
  { pattern: /\bDate\s*\(/, label: 'callable Date()' },
  { pattern: /\bperformance\b/, label: 'performance API' },
  { pattern: /\bcrypto\b/, label: 'crypto access' },
  { pattern: /\bset(?:Timeout|Interval)\s*\(/, label: 'timer' },
  { pattern: /\brequestAnimationFrame\b/, label: 'animation frame' },
  {
    pattern: /from\s+['"][^'"]*(?:\/store\/|\/ui\/|\/game\/|zustand)[^'"]*['"]/,
    label: 'presentation or storage import',
  },
];

describe('engine purity', () => {
  it('finds engine source files to check', () => {
    expect(sourceFiles.length).toBeGreaterThan(5);
    expect(sourceFiles.some((file) => file.endsWith('index.ts'))).toBe(true);
  });

  it('contains no DOM, storage, clock, or random-source dependencies', () => {
    for (const file of sourceFiles) {
      const source = readFileSync(join(engineDir, file), 'utf8');
      for (const { pattern, label } of FORBIDDEN_PATTERNS) {
        expect(pattern.test(source), `${file} must not contain ${label}`).toBe(false);
      }
    }
  });

  it('guards timer and callable-Date probes', () => {
    const probes = ['performance.now()', 'const stamp = Date();'];
    const matched = probes.map((probe) =>
      FORBIDDEN_PATTERNS.some(({ pattern }) => pattern.test(probe)),
    );
    expect(matched).toEqual([true, true]);
  });

  it('imports only from inside the engine directory', () => {
    const importPattern = /from\s+['"]([^'"]+)['"]/g;
    for (const file of sourceFiles) {
      const source = readFileSync(join(engineDir, file), 'utf8');
      for (const match of source.matchAll(importPattern)) {
        const specifier = match[1];
        expect(specifier.startsWith('.'), `${file} imports ${specifier}`).toBe(true);
      }
    }
  });

  it('is TypeScript-only: no JSX or framework component files', () => {
    const allFiles = readdirSync(engineDir, { recursive: true, encoding: 'utf8' });
    expect(allFiles.filter((file) => file.endsWith('.tsx'))).toEqual([]);
    expect(allFiles.filter((file) => file.endsWith('.js') || file.endsWith('.jsx'))).toEqual([]);
  });

  it('keeps focused engine tests next to the engine code', () => {
    const testFiles = readdirSync(engineDir, { recursive: true, encoding: 'utf8' })
      .filter((file) => file.endsWith('.test.ts') && !file.includes('/'))
      .sort();

    expect(testFiles.length).toBeGreaterThanOrEqual(5);
    expect(testFiles).toContain('cards.test.ts');
    expect(testFiles).toContain('combat.test.ts');
    expect(testFiles).toContain('undo.test.ts');
  });
});
