import { test, expect } from '@playwright/test';
import { saved, storedRaw } from './save-helper';
test('reload and reopening restore progress at title, including room undo', async ({
  page,
  context,
}) => {
  await page.goto('/#/play?v=1&seed=cinder&rules=001');
  await page.locator('[data-card-id="diamond-6"]').click();
  await page.getByRole('button', { name: 'Equip weapon', exact: true }).click();
  await page.locator('[data-card-id="spade-7"]').click();
  await page.getByRole('button', { name: 'Fight with weapon', exact: true }).click();
  await expect(page.locator('.health-value')).toHaveText('19 / 20');
  await saved(page);
  await page.reload();
  await page.getByRole('button', { name: 'Continue run', exact: true }).click();
  await expect(page.locator('.health-value')).toHaveText('19 / 20');
  await expect(page.getByRole('heading', { name: 'Your weapon 6', exact: true })).toBeVisible();
  await saved(page);
  await page.close();
  const reopened = await context.newPage();
  await reopened.goto('/');
  await reopened.getByRole('button', { name: 'Continue run', exact: true }).click();
  await expect(reopened.locator('.health-value')).toHaveText('19 / 20');
  await reopened.getByRole('button', { name: 'Undo room', exact: true }).click();
  await expect(reopened.locator('.health-value')).toHaveText('20 / 20');
  await expect(reopened.locator('[data-card-id]')).toHaveCount(4);
  await expect(
    reopened.getByRole('heading', { name: 'No weapon equipped', exact: true }),
  ).toBeVisible();
});

test('language, motion and future-run rules persist across reload', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByLabel('Allow consecutive escapes', { exact: true }).check();
  await page.getByLabel('Unlimited potions per room', { exact: true }).check();
  await page.getByLabel('Weapon degradation', { exact: true }).uncheck();
  await page.getByLabel('Reduce motion', { exact: true }).check();
  await page.locator('#language').selectOption('zh');
  await page.keyboard.press('Escape');
  await saved(page);
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('lang', 'zh-CN');
  await expect(page.locator('.shell')).toHaveAttribute('data-reduced-motion', 'true');
  await page.getByRole('button', { name: '设置', exact: true }).click();
  await expect(page.getByLabel('允许连续逃跑', { exact: true })).toBeChecked();
  await expect(page.getByLabel('每个房间不限药水次数', { exact: true })).toBeChecked();
  await expect(page.getByLabel('武器退化', { exact: true })).not.toBeChecked();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: '新游戏', exact: true }).click();
  expect((await saved(page)).session.game.config).toEqual({
    allowConsecutiveEscapes: true,
    unlimitedPotions: true,
    weaponDegradation: false,
  });
});

test('abandonment statistics are durable and history replay uses original rules', async ({
  page,
}) => {
  await page.goto('/#/play?v=1&seed=cinder&rules=001');
  await page.getByRole('button', { name: 'Menu', exact: true }).click();
  await page.getByRole('button', { name: 'New run', exact: true }).click();
  await page.getByRole('button', { name: 'Start new run', exact: true }).click();
  expect((await saved(page)).session.statistics).toMatchObject({
    gamesPlayed: 1,
    wins: 0,
    losses: 1,
  });
  await saved(page);
  await page.reload();
  await page.getByRole('button', { name: 'Stats', exact: true }).click();
  await expect(page.locator('.history-entry')).toHaveCount(1);
  await expect(page.locator('.history-entry')).toContainText('Abandoned · Loss');
  await expect(page.locator('.history-entry h3')).toHaveText('cinder');
  await page.getByRole('button', { name: 'Back to title', exact: true }).click();
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByLabel('Weapon degradation', { exact: true }).uncheck();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Stats', exact: true }).click();
  await page
    .locator('.history-entry')
    .getByRole('button', { name: 'Replay this dungeon', exact: true })
    .click();
  await page.getByRole('button', { name: 'Start new run', exact: true }).click();
  await expect(page.locator('.seed-value')).toHaveText('cinder');
  const state = await saved(page);
  expect(state.session.statistics.losses).toBe(2);
  expect(state.preferences.config.weaponDegradation).toBe(false);
  expect(state.session.game.config.weaponDegradation).toBe(true);
});

test('explicit abandon removes the saved run while retaining stats and preferences', async ({
  page,
}) => {
  await page.goto('/#/play?v=1&seed=cinder&rules=001');
  await page.getByRole('button', { name: 'Menu', exact: true }).click();
  await page.getByRole('button', { name: 'Abandon run', exact: true }).click();
  await saved(page);
  await page.reload();
  await expect(page.getByRole('button', { name: 'Continue run', exact: true })).toHaveCount(0);
  const state = await saved(page);
  expect(state.session.game).toBe(null);
  expect(state.session.statistics.losses).toBe(1);
  await page.getByRole('button', { name: 'Stats', exact: true }).click();
  await expect(page.locator('.history-entry')).toHaveCount(1);
});

test('a stale tab cannot overwrite another tab and safely reloads the saved game', async ({
  page,
  context,
}) => {
  await page.goto('/#/play?v=1&seed=cinder&rules=001');
  await saved(page);
  const other = await context.newPage();
  await other.goto('/');
  await other.getByRole('button', { name: 'New run', exact: true }).click();
  await other.getByRole('button', { name: 'Start new run', exact: true }).click();
  const replacementSeed = await other.locator('.seed-value').innerText();
  await expect(page.getByRole('alert')).toContainText('changed in another tab');
  await page.getByRole('button', { name: 'Reload saved game', exact: true }).click();
  await page.getByRole('button', { name: 'Continue run', exact: true }).click();
  await expect(page.locator('.seed-value')).toHaveText(replacementSeed);
  expect((await saved(page)).session.statistics.gamesPlayed).toBe(1);
});

for (const [name, raw, message] of [
  ['corrupt', '{', 'could not be read'],
  ['unsupported', '{"version":999,"data":{"keep":"unchanged"}}', 'newer version'],
]) {
  test(`${name} saves remain unchanged while unsaved play remains possible`, async ({ page }) => {
    await page.goto('/');
    await storedRaw(page, raw);
    await page.reload();
    await expect(page.getByRole('alert')).toContainText(message);
    await page.getByRole('button', { name: 'New run', exact: true }).click();
    await expect(page.locator('[data-card-id]')).toHaveCount(4);
    expect(await storedRaw(page)).toBe(raw);
  });
}

test('unavailable browser storage leaves the game playable with a visible notice', async ({
  page,
}) => {
  await page.addInitScript(() => {
    indexedDB.open = () => {
      throw new DOMException('Storage denied', 'SecurityError');
    };
  });
  await page.goto('/');
  await expect(page.getByRole('alert')).toContainText('Saving is unavailable');
  await page.getByRole('button', { name: 'New run', exact: true }).click();
  await expect(page.locator('[data-card-id]')).toHaveCount(4);
  await expect(page.locator('[data-save-status]')).toHaveAttribute('data-save-status', 'unsaved');
});

test('quota failure is visible and retry saves the latest state without duplicate outcomes', async ({
  page,
}) => {
  await page.addInitScript(() => {
    const original = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function (value, key) {
      if (this.name === 'saves' && sessionStorage.getItem('test:fail-write') === '1')
        throw new DOMException('Quota exceeded', 'QuotaExceededError');
      return original.call(this, value, key);
    };
  });
  await page.goto('/#/play?v=1&seed=cinder&rules=001');
  await saved(page);
  const original = await storedRaw(page);
  await page.evaluate(() => sessionStorage.setItem('test:fail-write', '1'));
  await page.locator('[data-card-id="diamond-6"]').click();
  await page.getByRole('button', { name: 'Equip weapon', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Your weapon 6', exact: true })).toBeVisible();
  await expect(page.getByRole('alert')).toContainText('could not be saved');
  expect(await storedRaw(page)).toBe(original);
  await page.evaluate(() => sessionStorage.removeItem('test:fail-write'));
  await page.getByRole('button', { name: 'Retry saving', exact: true }).click();
  await expect(page.getByRole('alert')).toHaveCount(0);
  expect((await saved(page)).session.statistics.gamesPlayed).toBe(0);
  await saved(page);
  await page.reload();
  await page.getByRole('button', { name: 'Continue run', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Your weapon 6', exact: true })).toBeVisible();
});

test('simultaneous tabs cannot both replace the same saved revision', async ({ page, context }) => {
  await context.addInitScript(() => {
    const original = IDBDatabase.prototype.transaction;
    (window as Window & { saveTransactions?: number }).saveTransactions = 0;
    IDBDatabase.prototype.transaction = function (...args: Parameters<typeof original>) {
      if (args[1] === 'readwrite') {
        const state = window as Window & { saveTransactions?: number };
        state.saveTransactions = (state.saveTransactions ?? 0) + 1;
      }
      return original.apply(this, args);
    };
  });
  await page.goto('/');
  const other = await context.newPage();
  await other.goto('/');
  // Keep a real transaction open until both app transactions have been created.
  await page.evaluate(async () => {
    const database = await new Promise<IDBDatabase>((resolve) => {
      const request = indexedDB.open('scoundrel', 1);
      request.onsuccess = () => resolve(request.result);
    });
    const transaction = database.transaction('saves', 'readwrite');
    const store = transaction.objectStore('saves');
    const state = window as Window & { releaseSaveTransaction?: boolean };
    function keepOpen() {
      const request = store.get('scoundrel:save');
      request.onsuccess = () => {
        if (!state.releaseSaveTransaction) keepOpen();
      };
    }
    keepOpen();
    transaction.oncomplete = () => database.close();
  });
  await Promise.all([
    page.getByRole('button', { name: 'New run', exact: true }).click(),
    other.getByRole('button', { name: 'New run', exact: true }).click(),
  ]);
  await expect
    .poll(() =>
      page.evaluate(() => (window as Window & { saveTransactions?: number }).saveTransactions),
    )
    .toBe(2);
  await expect
    .poll(() =>
      other.evaluate(() => (window as Window & { saveTransactions?: number }).saveTransactions),
    )
    .toBe(1);
  await page.evaluate(() => {
    (window as Window & { releaseSaveTransaction?: boolean }).releaseSaveTransaction = true;
  });
  await expect
    .poll(async () => {
      const statuses = await Promise.all(
        [page, other].map((p) => p.locator('[data-save-status]').getAttribute('data-save-status')),
      );
      return statuses.sort();
    })
    .toEqual(['saved', 'unsaved']);
  const stored = JSON.parse((await storedRaw(page))!).data;
  expect(stored.session.runNumber).toBe(1);
  expect(stored.session.statistics.gamesPlayed).toBe(0);
  const winner = (await page.locator('[data-save-status="saved"]').count()) ? page : other;
  const loser = winner === page ? other : page;
  await expect(loser.getByRole('alert')).toContainText('changed in another tab');
  await expect(winner.locator('.seed-value')).toHaveText(stored.session.game.seed);
});

for (const language of ['en', 'zh'] as const) {
  test(`replacement confirmation can cancel, escape, and confirm once (${language})`, async ({
    page,
  }) => {
    const zh = language === 'zh';
    await page.goto('/#/play?v=1&seed=cinder&rules=001');
    await page.locator('[data-card-id="diamond-6"]').click();
    await page.getByRole('button', { name: 'Equip weapon', exact: true }).click();
    await page.getByRole('button', { name: 'Menu', exact: true }).click();
    if (zh) {
      await page.getByRole('button', { name: 'Settings', exact: true }).click();
      await page.locator('#language').selectOption('zh');
      await page.keyboard.press('Escape');
    }
    await saved(page);
    const before = await storedRaw(page);
    const newRun = page.getByRole('button', { name: zh ? '新游戏' : 'New run', exact: true });
    await expect(page.locator('#replacement-note')).toHaveCount(0);
    await newRun.click();
    const cancel = page.getByRole('button', { name: zh ? '取消' : 'Cancel', exact: true });
    await expect(cancel).toBeFocused();
    await cancel.click();
    expect(await storedRaw(page)).toBe(before);
    await newRun.click();
    await page.keyboard.press('Escape');
    expect(await storedRaw(page)).toBe(before);
    await page.getByRole('button', { name: zh ? '继续游戏' : 'Continue run', exact: true }).click();
    await expect(
      page.getByRole('heading', { name: zh ? '当前武器 6' : 'Your weapon 6', exact: true }),
    ).toBeVisible();
    await page.getByRole('button', { name: zh ? '菜单' : 'Menu', exact: true }).click();
    await page.getByRole('button', { name: zh ? '输入种子' : 'Enter seed', exact: true }).click();
    await page.locator('#seed-input').fill('replacement-test');
    await page
      .getByRole('button', { name: zh ? '开始探索' : 'Start dungeon', exact: true })
      .click();
    await expect(page.getByRole('dialog')).toContainText(
      zh ? '记为一次失败' : 'records it as a loss',
    );
    expect(await storedRaw(page)).toBe(before);
    await page
      .getByRole('button', { name: zh ? '开始新游戏' : 'Start new run', exact: true })
      .click();
    await expect(page.getByRole('dialog')).not.toBeVisible();
    await expect(page.locator('.seed-value')).toHaveText('replacement-test');
    const after = await saved(page);
    expect(after.session.runNumber).toBe(2);
    expect(after.session.statistics.losses).toBe(1);
    expect(after.session.history[0].reason).toBe('abandoned');
    await page.reload();
    expect((await saved(page)).session.statistics.losses).toBe(1);
  });
}
