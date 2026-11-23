// Tests dans un vrai navigateur, sur ordinateur et sur téléphone.
// Ils complètent "npm run check" : ici on vérifie ce qu'un visiteur voit et peut faire.

import { existsSync, readdirSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';

const DIST = fileURLToPath(new URL('../dist/', import.meta.url));
const lister = (dossier) =>
  readdirSync(dossier, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? lister(join(dossier, e.name)) : [join(dossier, e.name)]));
const pages = existsSync(DIST)
  ? lister(DIST)
      .filter((f) => f.endsWith('.html') && !f.endsWith('404.html'))
      .map((f) => '/' + relative(DIST, f).split(sep).join('/').replace(/index\.html$/, ''))
      .sort()
  : [];

test('le site a été construit', () => {
  expect(pages.length, 'aucune page dans dist/ : lancer "npm run build" avant les tests').toBeGreaterThan(0);
});

for (const page of pages) {
  test(`la page ${page} s'affiche correctement`, async ({ page: onglet }, infos) => {
    const erreurs = [];
    onglet.on('pageerror', (e) => erreurs.push(e.message));
    onglet.on('console', (m) => m.type() === 'error' && erreurs.push(m.text()));

    const reponse = await onglet.goto(page);
    expect(reponse?.status(), `code HTTP de ${page}`).toBe(200);
    await expect(onglet.locator('h1')).toBeVisible();
    await expect(onglet.locator('header nav')).toBeVisible();

    const debordement = await onglet.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(debordement, `${page} dépasse en largeur de ${debordement}px`).toBeLessThanOrEqual(1);
    expect(erreurs, `erreurs JavaScript sur ${page}`).toEqual([]);

    // "Mesurer ET regarder" : la capture est conservée par la CI pour un contrôle visuel.
    const nom = page === '/' ? 'accueil' : page.replaceAll('/', '_');
    await onglet.screenshot({ path: `test-results/captures/${infos.project.name}-${nom}.png`, fullPage: true });
  });
}

test('le menu mène à des pages qui existent', async ({ page: onglet }) => {
  await onglet.goto('/');
  const liens = await onglet.locator('header nav a').evaluateAll((elements) => elements.map((a) => a.getAttribute('href')));
  expect(liens.length).toBeGreaterThan(0);
  for (const lien of liens) {
    const reponse = await onglet.goto(lien);
    expect(reponse?.status(), `lien du menu ${lien}`).toBe(200);
    await expect(onglet.locator('h1')).toBeVisible();
  }
});

test('une adresse inconnue affiche la page 404', async ({ page: onglet }) => {
  const reponse = await onglet.goto('/cette-page-n-existe-pas/');
  expect(reponse?.status()).toBe(404);
  await expect(onglet.locator('h1')).toHaveText(/introuvable/i);
});

test('le formulaire de contact s\'envoie et confirme au visiteur', async ({ page: onglet }) => {
  await onglet.goto('/contact/');
  await onglet.getByLabel('Votre nom').fill('Test automatique');
  await onglet.getByLabel('Votre e-mail').fill('test-automatique@example.com');
  await onglet.getByLabel('Votre message').fill('Ceci est un test automatique du formulaire.');
  await onglet.getByRole('button', { name: 'Envoyer' }).click();
  const message = onglet.locator('#message-formulaire');
  await expect(message).toBeVisible();
  await expect(message).toHaveAttribute('data-etat', 'succes');
});

test('le formulaire refuse un envoi invalide', async ({ request }) => {
  const reponse = await request.post('/api/contact', { multipart: { nom: 'Test', email: 'pas-un-email', message: 'Bonjour à tous' } });
  expect(reponse.status()).toBe(422);
  expect((await reponse.json()).ok).toBe(false);
});

test('le formulaire affiche une erreur quand l\'envoi échoue', async ({ page: onglet }) => {
  await onglet.route('**/api/contact', (route) => route.fulfill({ status: 502, contentType: 'application/json', body: '{"ok":false}' }));
  await onglet.goto('/contact/');
  await onglet.getByLabel('Votre nom').fill('Test automatique');
  await onglet.getByLabel('Votre e-mail').fill('test-automatique@example.com');
  await onglet.getByLabel('Votre message').fill('Ceci est un test automatique du formulaire.');
  await onglet.getByRole('button', { name: 'Envoyer' }).click();
  await expect(onglet.locator('#message-formulaire')).toHaveAttribute('data-etat', 'erreur');
});
