import { describe, expect, it } from 'vitest';
import {
  SCHEMA_VERSION,
  SHARD_MIGRATIONS,
  STORAGE_KEYS,
  STORAGE_NAMESPACE,
  readStoredShard,
  removeStoredShard,
  writeStoredShard,
} from './persistence';
import { createMemoryStorage, createUnavailableStorage } from './storage';
import { isRecord } from './validation';

interface Named {
  readonly name: string;
}

function isNamed(value: unknown): value is Named {
  return isRecord(value) && typeof value.name === 'string';
}

describe('storage names and versions', () => {
  it('uses the product namespace and stable shard keys', () => {
    expect(STORAGE_NAMESPACE).toBe('scoundrel');
    expect(STORAGE_KEYS).toEqual({
      settings: 'scoundrel:settings',
      stats: 'scoundrel:stats',
      run: 'scoundrel:run',
    });
    expect(SCHEMA_VERSION).toBe(1);
  });

  it('starts the first released schema without production migrations', () => {
    expect(SHARD_MIGRATIONS).toEqual({ settings: {}, stats: {}, run: {} });
    expect(Object.isFrozen(SHARD_MIGRATIONS)).toBe(true);
  });
});

describe('readStoredShard', () => {
  const key = 'scoundrel:test';

  it('round-trips a validated payload inside a versioned envelope', () => {
    const storage = createMemoryStorage();
    expect(writeStoredShard(storage, key, { name: 'run' })).toEqual({ status: 'ok' });

    const raw = storage.snapshot()[key];
    expect(raw).toBeDefined();
    expect(JSON.parse(raw ?? '{}')).toEqual({
      schemaVersion: SCHEMA_VERSION,
      data: { name: 'run' },
    });

    const read = readStoredShard(storage, key, { validate: isNamed });
    expect(read).toEqual({ status: 'ok', version: SCHEMA_VERSION, data: { name: 'run' } });
  });

  it('reports a missing shard without inventing data', () => {
    const storage = createMemoryStorage();
    expect(readStoredShard(storage, key, { validate: isNamed })).toEqual({ status: 'missing' });
  });

  it('reports unavailable storage instead of throwing', () => {
    const storage = createUnavailableStorage();
    expect(readStoredShard(storage, key, { validate: isNamed })).toEqual({ status: 'unavailable' });
    expect(writeStoredShard(storage, key, { name: 'x' })).toEqual({ status: 'unavailable' });
    expect(removeStoredShard(storage, key)).toEqual({ status: 'unavailable' });
  });

  it('returns corrupt raw text for invalid JSON so it can be preserved', () => {
    const storage = createMemoryStorage({ [key]: '{not json' });
    expect(readStoredShard(storage, key, { validate: isNamed })).toEqual({
      status: 'corrupt',
      raw: '{not json',
    });
  });

  it.each([
    ['null', 'null'],
    ['an array', '[]'],
    ['a string', '"payload"'],
    ['a missing version', '{"data":{"name":"x"}}'],
    ['a non-integer version', '{"schemaVersion":1.5,"data":{"name":"x"}}'],
    ['a negative version', '{"schemaVersion":-1,"data":{"name":"x"}}'],
    ['an invalid payload', '{"schemaVersion":1,"data":{"name":42}}'],
  ])('treats %s as corrupt', (_label, raw) => {
    const storage = createMemoryStorage({ [key]: raw });
    expect(readStoredShard(storage, key, { validate: isNamed })).toEqual({
      status: 'corrupt',
      raw,
    });
  });

  it('reports a newer schema as unsupported and keeps the raw payload', () => {
    const raw = '{"schemaVersion":99,"data":{"name":"future"}}';
    const storage = createMemoryStorage({ [key]: raw });
    expect(readStoredShard(storage, key, { validate: isNamed })).toEqual({
      status: 'unsupported-version',
      raw,
      version: 99,
    });
  });

  it('chains ordered migrations to the target version', () => {
    const storage = createMemoryStorage({
      [key]: '{"schemaVersion":1,"data":{"value":10}}',
    });
    const migrations = {
      1: (data: unknown) => ({ value: isRecord(data) ? Number(data.value) + 1 : 0 }),
      2: (data: unknown) => ({ name: `n${isRecord(data) ? String(data.value) : '?'}` }),
    };

    const read = readStoredShard(storage, key, {
      validate: isNamed,
      migrations,
      schemaVersion: 3,
    });
    expect(read).toEqual({
      status: 'ok',
      version: 3,
      migratedFrom: 1,
      data: { name: 'n11' },
    });
  });

  it('reports a missing migration step as an unsupported version', () => {
    const raw = '{"schemaVersion":1,"data":{"value":1}}';
    const storage = createMemoryStorage({ [key]: raw });
    const read = readStoredShard(storage, key, {
      validate: isNamed,
      migrations: { 2: () => ({ name: 'skipped' }) },
      schemaVersion: 3,
    });
    expect(read).toEqual({ status: 'unsupported-version', raw, version: 1 });
  });

  it('treats a throwing migration as corrupt', () => {
    const raw = '{"schemaVersion":1,"data":{"value":1}}';
    const storage = createMemoryStorage({ [key]: raw });
    const read = readStoredShard(storage, key, {
      validate: isNamed,
      migrations: {
        1: () => {
          throw new Error('bad migration');
        },
      },
      schemaVersion: 2,
    });
    expect(read).toEqual({ status: 'corrupt', raw });
  });

  it('validates migrated data before returning it', () => {
    const raw = '{"schemaVersion":1,"data":{"value":1}}';
    const storage = createMemoryStorage({ [key]: raw });
    const read = readStoredShard(storage, key, {
      validate: isNamed,
      migrations: { 1: () => ({ wrong: true }) },
      schemaVersion: 2,
    });
    expect(read).toEqual({ status: 'corrupt', raw });
  });
});

describe('removeStoredShard', () => {
  it('removes only the target shard', () => {
    const storage = createMemoryStorage({ a: '1', b: '2' });
    expect(removeStoredShard(storage, 'a')).toEqual({ status: 'ok' });
    expect(storage.snapshot()).toEqual({ b: '2' });
  });
});
