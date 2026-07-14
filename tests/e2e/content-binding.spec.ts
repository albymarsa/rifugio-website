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

  test('info section links to the storia page', async ({ page }) => {
    await page.goto('/');
    const link = page.locator('.info__storia-btn');
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute('href', '/storia');
    await expect(link).toHaveText('Scopri la storia del rifugio');
  });

  test('footer Facebook link href matches content.json', async ({ page }) => {
    await page.goto('/');
    await expect(
      page.locator('.footer__social[aria-label="Facebook"]')
    ).toHaveAttribute('href', content.footer.facebook_url);
  });

  test('footer Facebook link has target="_blank" and rel noopener', async ({ page }) => {
    await page.goto('/');
    const link = page.locator('.footer__social[aria-label="Facebook"]');
    await expect(link).toHaveAttribute('target', '_blank');
    const rel = await link.getAttribute('rel');
    expect(rel).toContain('noopener');
  });

  test('footer Instagram link href matches content.json', async ({ page }) => {
    await page.goto('/');
    await expect(
      page.locator('.footer__social[aria-label="Instagram"]')
    ).toHaveAttribute('href', content.footer.instagram_url);
  });

  test('footer Instagram link has target="_blank" and rel noopener', async ({ page }) => {
    await page.goto('/');
    const link = page.locator('.footer__social[aria-label="Instagram"]');
    await expect(link).toHaveAttribute('target', '_blank');
    const rel = await link.getAttribute('rel');
    expect(rel).toContain('noopener');
  });
});

/**
 * Regressione: la sezione "Link utili" DEVE leggere gruppi e link da
 * src/data/content.json (gestibile dal CMS) e mostrarli in fondo alla home.
 * I link esterni devono aprirsi in una nuova scheda con rel noopener.
 */
test.describe('Useful links section', () => {
  const useful = content.useful_links;
  const totalLinks = useful.groups.reduce(
    (n: number, g: { links: unknown[] }) => n + g.links.length,
    0
  );

  test('section title matches content.json', async ({ page }) => {
    await page.goto('/');
    const section = page.locator('section', { has: page.locator('.links__grid') });
    await expect(section.locator('.section-title')).toHaveText(useful.title);
  });

  test('renders all link groups from content.json', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.links__group')).toHaveCount(useful.groups.length);
  });

  test('renders all links from content.json', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.links__list a')).toHaveCount(totalLinks);
  });

  test('first link has the text and href from content.json', async ({ page }) => {
    await page.goto('/');
    const first = useful.groups[0].links[0];
    const link = page.locator('.links__list a').first();
    await expect(link).toHaveText(first.text);
    await expect(link).toHaveAttribute('href', first.url);
  });

  test('all links open in a new tab with rel noopener', async ({ page }) => {
    await page.goto('/');
    const links = page.locator('.links__list a');
    await expect(links).toHaveCount(totalLinks);
    for (let i = 0; i < totalLinks; i++) {
      const link = links.nth(i);
      await expect(link).toHaveAttribute('target', '_blank');
      const rel = await link.getAttribute('rel');
      expect(rel).toContain('noopener');
    }
  });
});
