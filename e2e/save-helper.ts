import { expect } from '@playwright/test';
import type { Page } from '@playwright/test';
export async function storedRaw(page: Page, replacement?: string): Promise<string | null> {
  return page.evaluate(async (replacement) => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('scoundrel', 1);
      request.onupgradeneeded = () => request.result.createObjectStore('saves');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    try {
      return await new Promise<string | null>((resolve, reject) => {
        const transaction = database.transaction(
          'saves',
          replacement === undefined ? 'readonly' : 'readwrite',
        );
        const store = transaction.objectStore('saves');
        const request = store.get('scoundrel:save');
        if (replacement !== undefined) store.put(replacement, 'scoundrel:save');
        transaction.oncomplete = () => resolve(replacement ?? request.result ?? null);
        transaction.onabort = () => reject(transaction.error);
      });
    } finally {
      database.close();
    }
  }, replacement);
}
export async function saved(page: Page) {
  await expect(page.locator('[data-save-status]')).toHaveAttribute('data-save-status', 'saved');
  return JSON.parse((await storedRaw(page))!).data;
}
