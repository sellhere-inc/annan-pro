import { test, expect } from '@playwright/test';
test('login comes first and private data is absent', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('Sign in.', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Email', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Password', { exact: true })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'People' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Add person' })).toHaveCount(0);
  await expect(page.getByText('Aarav Sharma')).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('button', { name: 'New here? Create an account' }).click();
  await expect(page.getByLabel('Full name')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Create account', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Already registered? Sign in' }).click();
  await expect(page.getByText('Sign in.', { exact: true })).toBeVisible();
});
test('iPhone installation assets are present', async ({ request, page }) => {
  const manifest = await request.get('/manifest.webmanifest');
  const json = await manifest.json();
  expect(json.name).toBe('Annan Pro');
  expect(json.display).toBe('standalone');
  expect((await request.get('/sw.js')).ok()).toBe(true);
  expect((await request.get('/icon-192.png')).ok()).toBe(true);
  await page.goto('/');
  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute('href', '/manifest.webmanifest');
  await expect(page.locator('meta[name="apple-mobile-web-app-capable"]')).toHaveAttribute('content','yes');
});
