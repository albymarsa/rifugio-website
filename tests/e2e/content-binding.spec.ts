import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const content = JSON.parse(
  readFileSync(resolve(__dirname, '../../src/data/content.json'), 'utf-8')
);

/**
 * Regressione: Hero.astro e InfoSection.astro DEVONO leggere i contenuti
 * da src/data/content.json. In passato sono stati committati con testi
 * hardcoded o con props richieste senza default, lasciando la home con
 * l'hero vuoto e la sezione info disallineata. Questi test catturano
 * quel tipo di regressione.
 */
test.describe('Content binding (CMS → home)', () => {
  test('hero shows the title from content.json', async ({ page }) => {
    await page.goto('/');
    const h1 = page.locator('.hero__title');
    await expect(h1).toBeVisible();
    await expect(h1).toHaveText(content.hero.title);
  });

  test('hero shows the subtitle from content.json', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.hero__subtitle')).toHaveText(content.hero.subtitle);
  });

  test('hero CTA shows the text from content.json', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.hero__cta')).toHaveText(content.hero.cta_text);
  });

  test('info section title matches content.json', async ({ page }) => {
    await page.goto('/');
    await expect(
      page.locator('.info .section-title').first()
    ).toHaveText(content.info.title);
  });

  test('info section first paragraph matches content.json', async ({ page }) => {
    await page.goto('/');
    const firstParagraph = content.info.paragraphs[0];
    await expect(page.locator('.info__text p').first()).toHaveText(firstParagraph);
  });

  test('footer Facebook link href matches content.json', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.footer__social')).toHaveAttribute('href', content.footer.facebook_url);
  });

  test('footer Facebook link has target="_blank" and rel noopener', async ({ page }) => {
    await page.goto('/');
    const link = page.locator('.footer__social');
    await expect(link).toHaveAttribute('target', '_blank');
    const rel = await link.getAttribute('rel');
    expect(rel).toContain('noopener');
  });
});
