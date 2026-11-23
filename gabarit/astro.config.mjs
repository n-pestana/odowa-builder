import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import { readFileSync } from 'node:fs';

const config = JSON.parse(readFileSync(new URL('./site.config.json', import.meta.url), 'utf8'));

export default defineConfig({
  // L'URL de prod sert aux canonical et au sitemap, y compris sur le site dev.
  site: config.urlProd,
  trailingSlash: 'always',
  build: { format: 'directory' },
  integrations: [sitemap({ filter: (page) => !page.includes('/404') })],
});
