import { describe, expect, it } from 'vitest';
import type { RuleConfig } from '../engine';
import { PLAY_ROUTE, buildReplayHash, buildReplayUrl, parseReplayLink } from './share';

describe('buildReplayHash', () => {
  it('builds the documented in-app replay link', () => {
    expect(buildReplayHash('plain-257', 0)).toBe('#/play?seed=plain-257&config=0');
    expect(buildReplayHash('plain-257', 5)).toBe('#/play?seed=plain-257&config=5');
    expect(buildReplayHash('plain-257', 7)).toBe('#/play?seed=plain-257&config=7');
  });

  it('normalizes the seed and escapes it', () => {
    expect(buildReplayHash('  Plain-257 ', 1)).toBe('#/play?seed=Plain-257&config=1');
    expect(buildReplayHash('seed with spaces', 1)).toBe(
      '#/play?seed=seed%20with%20spaces&config=1',
    );
  });

  it('rejects invalid seeds and config masks', () => {
    expect(() => buildReplayHash('', 0)).toThrow(RangeError);
    expect(() => buildReplayHash('x'.repeat(65), 0)).toThrow(RangeError);
    expect(() => buildReplayHash('plain-257', 8 as RuleConfig)).toThrow(RangeError);
  });
});

describe('buildReplayUrl', () => {
  it('appends the hash to a base page URL', () => {
    expect(buildReplayUrl('plain-257', 0, 'https://example.com/scoundrel/')).toBe(
      'https://example.com/scoundrel#/play?seed=plain-257&config=0',
    );
  });

  it('replaces an existing hash and collapses trailing slashes', () => {
    expect(buildReplayUrl('plain-257', 3, 'https://example.com/scoundrel/#/result')).toBe(
      'https://example.com/scoundrel#/play?seed=plain-257&config=3',
    );
    expect(buildReplayUrl('plain-257', 3, 'https://example.com')).toBe(
      'https://example.com#/play?seed=plain-257&config=3',
    );
  });
});

describe('parseReplayLink', () => {
  it('parses a full replay URL', () => {
    expect(parseReplayLink('https://example.com/app/#/play?seed=plain-257&config=5', 0)).toEqual({
      ok: true,
      seed: 'plain-257',
      config: 5,
      configFromLink: true,
    });
  });

  it('parses a hash and a bare route', () => {
    expect(parseReplayLink('#/play?seed=plain-257&config=2', 0)).toEqual({
      ok: true,
      seed: 'plain-257',
      config: 2,
      configFromLink: true,
    });
    expect(parseReplayLink('/play?seed=plain-257&config=1', 0)).toEqual({
      ok: true,
      seed: 'plain-257',
      config: 1,
      configFromLink: true,
    });
  });

  it('normalizes the seed', () => {
    const parsed = parseReplayLink('#/play?seed=%20Plain-257%20&config=0', 0);
    expect(parsed).toEqual({ ok: true, seed: 'Plain-257', config: 0, configFromLink: true });
  });

  it('uses the selected options when the link has no config', () => {
    expect(parseReplayLink('#/play?seed=plain-257', 6)).toEqual({
      ok: true,
      seed: 'plain-257',
      config: 6,
      configFromLink: false,
    });
  });

  it('round-trips a built hash', () => {
    const parsed = parseReplayLink(buildReplayHash('plain-257', 4), 0);
    expect(parsed).toEqual({ ok: true, seed: 'plain-257', config: 4, configFromLink: true });
  });

  it('keeps config 0 from an explicit link', () => {
    const parsed = parseReplayLink('#/play?seed=plain-257&config=0', 7);
    expect(parsed).toEqual({ ok: true, seed: 'plain-257', config: 0, configFromLink: true });
  });

  it.each([
    ['an empty link', '', 'invalid-link'],
    ['a non-play route', '#/title?seed=plain-257&config=0', 'invalid-link'],
    ['a path without play', 'https://example.com/app', 'invalid-link'],
    ['a missing seed', '#/play?config=0', 'invalid-seed'],
    ['an empty seed', '#/play?seed=&config=0', 'invalid-seed'],
    ['an invalid seed', `#/play?seed=${'x'.repeat(65)}&config=0`, 'invalid-seed'],
    ['an invalid config', '#/play?seed=plain-257&config=8', 'invalid-config'],
    ['a non-numeric config', '#/play?seed=plain-257&config=hard', 'invalid-config'],
  ])('rejects %s', (_label, input, reason) => {
    expect(parseReplayLink(input, 0)).toEqual({ ok: false, reason });
  });

  it('returns the caller-provided fallback without validating it', () => {
    // The store validates the recipient's selected options before starting a run.
    expect(parseReplayLink('#/play?seed=plain-257', 9 as RuleConfig)).toEqual({
      ok: true,
      seed: 'plain-257',
      config: 9,
      configFromLink: false,
    });
  });

  it('exposes the play route matching the hash router', () => {
    expect(PLAY_ROUTE).toBe('/play');
  });
});
