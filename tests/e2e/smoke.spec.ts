import { expect, test } from '@playwright/test';

test('iskelet açılıyor ve dört sekme görünüyor', async ({ page }) => {
  await page.goto('/');
  for (const label of ['Antrenman', 'İlerleme', 'Program', 'Ayarlar']) {
    await expect(page.getByRole('button', { name: label })).toBeVisible();
  }
});

test('sekme değişince görünüm ve hash değişiyor (D40)', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Antrenman' })).toBeVisible();

  await page.getByRole('button', { name: 'Ayarlar' }).click();

  await expect(page.getByRole('heading', { name: 'Ayarlar' })).toBeVisible();
  await expect(page).toHaveURL(/#\/settings$/);
});
