import { defineConfig, devices } from '@playwright/test';

// Les tests tournent contre le site construit (dist/), servi en local comme sur
// Cloudflare Pages, formulaire compris (mode simulation, voir .dev.vars).
const ADRESSE = 'http://127.0.0.1:8788';

export default defineConfig({
  testDir: 'tests',
  timeout: 30_000,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list']],
  outputDir: 'test-results',
  use: {
    baseURL: process.env.BASE_URL ?? ADRESSE,
    locale: 'fr-FR',
    // Facultatif : chemin d'un Chromium déjà installé (utile là où le téléchargement est bloqué).
    launchOptions: process.env.NAVIGATEUR ? { executablePath: process.env.NAVIGATEUR } : {},
  },
  webServer: process.env.BASE_URL
    ? undefined
    : {
        command: 'npx wrangler pages dev dist --ip 127.0.0.1 --port 8788 --compatibility-date=2026-11-01',
        url: ADRESSE,
        reuseExistingServer: !process.env.CI,
        timeout: 90_000,
      },
  projects: [
    { name: 'ordinateur', use: { ...devices['Desktop Chrome'] } },
    { name: 'telephone', use: { ...devices['Pixel 7'] } },
  ],
});
