import { expect, test } from '@playwright/test';

test.describe('Home page', () => {
  test('renders without console errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });

    const response = await page.goto('/');
    expect(response?.status()).toBe(200);

    // Sezioni principali
    await expect(page.locator('header')).toBeVisible();
    await expect(page.locator('footer')).toBeVisible();

    // Calendario disponibilità presente
    const calendar = page.locator('[class*="calendario"], [id*="calendario"], [data-testid="calendario"]').first();
    if (await calendar.count()) {
      await expect(calendar).toBeVisible();
    }

    expect(errors, `Console errors: ${errors.join('\n')}`).toEqual([]);
  });

  test('login page renders', async ({ page }) => {
    const response = await page.goto('/soci/login');
    expect(response?.status()).toBe(200);
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
  });

  test('privacy page renders', async ({ page }) => {
    const response = await page.goto('/privacy');
    expect(response?.status()).toBe(200);
  });

  test('protected route redirects to login', async ({ page }) => {
    await page.goto('/soci/');
    await expect(page).toHaveURL(/\/soci\/login/);
  });
});
