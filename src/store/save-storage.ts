import { encodeSave, SAVE_KEY, SaveConflict } from './persistence';
import type { SaveData } from './persistence';
const DATABASE = 'scoundrel';
const STORE = 'saves';
function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE, 1);
    let blocked = false;
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => {
      if (blocked) request.result.close();
      else resolve(request.result);
    };
    request.onerror = () => reject(request.error);
    request.onblocked = () => {
      blocked = true;
      reject(new Error('Save database is blocked'));
    };
  });
}
export async function readSave(): Promise<string | null> {
  const database = await openDatabase();
  try {
    return await new Promise((resolve, reject) => {
      const transaction = database.transaction(STORE, 'readonly');
      const request = transaction.objectStore(STORE).get(SAVE_KEY);
      transaction.oncomplete = () => resolve(request.result ?? null);
      transaction.onabort = () => reject(transaction.error);
    });
  } finally {
    database.close();
  }
}
export async function writeSave(
  data: SaveData,
  cursor: { current: string | null },
): Promise<string> {
  const raw = encodeSave(data);
  const database = await openDatabase();
  try {
    return await new Promise((resolve, reject) => {
      const transaction = database.transaction(STORE, 'readwrite');
      const store = transaction.objectStore(STORE);
      const request = store.get(SAVE_KEY);
      let conflict = false;
      let failure: unknown;
      request.onsuccess = () => {
        if ((request.result ?? null) !== cursor.current) {
          conflict = true;
          transaction.abort();
        } else if (raw !== cursor.current) {
          try {
            store.put(raw, SAVE_KEY);
          } catch (error) {
            failure = error;
            transaction.abort();
          }
        }
      };
      transaction.oncomplete = () => {
        cursor.current = raw;
        resolve(raw);
      };
      transaction.onabort = () =>
        reject(
          conflict
            ? new SaveConflict('Saved game changed in another tab')
            : (failure ?? transaction.error ?? new Error('Save transaction aborted')),
        );
    });
  } finally {
    database.close();
  }
}
