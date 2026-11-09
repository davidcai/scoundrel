import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, isStoredSettings, mergeSettings } from './settings';

describe('saved settings', () => {
  it('defaults to English and the system motion preference', () => {
    expect(DEFAULT_SETTINGS).toEqual({ locale: 'en', reducedMotion: null });
    expect(isStoredSettings(DEFAULT_SETTINGS)).toBe(true);
    expect(isStoredSettings({ locale: 'zh-Hans', reducedMotion: false })).toBe(true);
    expect(isStoredSettings({ locale: 'zh-Hans', reducedMotion: true })).toBe(true);
    expect(isStoredSettings({ locale: 'auto', reducedMotion: null })).toBe(true);
  });

  it.each([
    ['a non-object', null],
    ['an unknown locale', { locale: 'fr', reducedMotion: null }],
    ['a missing locale', { reducedMotion: null }],
    ['a non-boolean motion value', { locale: 'en', reducedMotion: 'reduce' }],
    ['a missing motion value', { locale: 'en' }],
  ])('rejects %s', (_label, value) => {
    expect(isStoredSettings(value)).toBe(false);
  });

  it('merges partial updates without mutating the current settings', () => {
    const current = { locale: 'zh-Hans' as const, reducedMotion: true };
    expect(mergeSettings(current, { locale: 'en' })).toEqual({ locale: 'en', reducedMotion: true });
    expect(mergeSettings(current, { locale: 'auto' })).toEqual({
      locale: 'auto',
      reducedMotion: true,
    });
    expect(mergeSettings(current, { reducedMotion: null })).toEqual({
      locale: 'zh-Hans',
      reducedMotion: null,
    });
    expect(mergeSettings(current, {})).toEqual(current);
    expect(current).toEqual({ locale: 'zh-Hans', reducedMotion: true });
  });
});
