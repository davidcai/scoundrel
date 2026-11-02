import { describe, expect, it } from 'vitest';
import {
  createMemoryStorage,
  createStoreStorage,
  createUnavailableStorage,
  type StorageLike,
  type StorageListener,
} from './storage';

class FakeTarget implements StorageLike {
  private readonly values = new Map<string, string>();
  public failRead = false;
  public failWrite = false;

  getItem(key: string): string | null {
    if (this.failRead) throw new Error('read blocked');
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    if (this.failWrite) throw new Error('write blocked');
    this.values.set(key, value);
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }
}

describe('createStoreStorage', () => {
  it('round-trips values through an injected Storage target', () => {
    const target = new FakeTarget();
    const storage = createStoreStorage({ target });

    expect(storage.available).toBe(true);
    expect(storage.read('missing')).toEqual({ status: 'ok', value: null });
    expect(storage.write('scoundrel:keys', 'value')).toEqual({ status: 'ok' });
    expect(storage.read('scoundrel:keys')).toEqual({ status: 'ok', value: 'value' });
    expect(storage.remove('scoundrel:keys')).toEqual({ status: 'ok' });
    expect(storage.read('scoundrel:keys')).toEqual({ status: 'ok', value: null });
  });

  it('reports unavailable storage when the probe cannot write', () => {
    const target = new FakeTarget();
    target.failWrite = true;
    const storage = createStoreStorage({ target });

    expect(storage.available).toBe(false);
    expect(storage.read('key')).toEqual({ status: 'unavailable' });
    expect(storage.write('key', 'value')).toEqual({ status: 'unavailable' });
    expect(storage.remove('key')).toEqual({ status: 'unavailable' });
  });

  it('degrades to unavailable when a later read throws', () => {
    const target = new FakeTarget();
    const storage = createStoreStorage({ target });
    target.failRead = true;

    expect(storage.read('key')).toEqual({ status: 'unavailable' });
    expect(storage.available).toBe(false);
    expect(storage.write('key', 'value')).toEqual({ status: 'unavailable' });
  });

  it('reports unavailable storage when there is no target', () => {
    const storage = createStoreStorage({ target: null });
    expect(storage.available).toBe(false);
    expect(storage.read('key')).toEqual({ status: 'unavailable' });
  });

  it('forwards cross-tab notifications and unsubscribes', () => {
    const listeners = new Set<StorageListener>();
    const storage = createStoreStorage({
      target: new FakeTarget(),
      subscribe(listener) {
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
    });

    const seen: Array<string | null> = [];
    const unsubscribe = storage.subscribe((key) => seen.push(key));
    for (const listener of listeners) listener('scoundrel:run');
    expect(seen).toEqual(['scoundrel:run']);

    unsubscribe();
    expect(listeners.size).toBe(0);
  });

  it('wraps the jsdom localStorage by default', () => {
    const storage = createStoreStorage();
    expect(storage.available).toBe(true);
    expect(storage.write('__scoundrel_test__', '1')).toEqual({ status: 'ok' });
    expect(storage.read('__scoundrel_test__')).toEqual({ status: 'ok', value: '1' });
    expect(storage.remove('__scoundrel_test__')).toEqual({ status: 'ok' });
  });
});

describe('createMemoryStorage', () => {
  it('starts empty or seeded and snapshots its raw values', () => {
    const empty = createMemoryStorage();
    expect(empty.available).toBe(true);
    expect(empty.snapshot()).toEqual({});

    const seeded = createMemoryStorage({ a: '1' });
    expect(seeded.snapshot()).toEqual({ a: '1' });
    seeded.write('b', '2');
    expect(seeded.snapshot()).toEqual({ a: '1', b: '2' });
    seeded.remove('a');
    expect(seeded.snapshot()).toEqual({ b: '2' });
  });

  it('never notifies itself so store writes cannot re-enter the store', () => {
    const storage = createMemoryStorage();
    let calls = 0;
    const unsubscribe = storage.subscribe(() => {
      calls += 1;
    });
    storage.write('key', 'value');
    storage.remove('key');
    expect(calls).toBe(0);
    unsubscribe();
  });
});

describe('createUnavailableStorage', () => {
  it('fails every storage operation without throwing', () => {
    const storage = createUnavailableStorage();
    expect(storage.available).toBe(false);
    expect(storage.read('key')).toEqual({ status: 'unavailable' });
    expect(storage.write('key', 'value')).toEqual({ status: 'unavailable' });
    expect(storage.remove('key')).toEqual({ status: 'unavailable' });
    const unsubscribe = storage.subscribe(() => undefined);
    expect(typeof unsubscribe).toBe('function');
  });
});
