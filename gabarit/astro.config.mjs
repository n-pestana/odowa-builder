import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import { readFileSync, writeFileSync } from 'node:fs';

const config = JSON.parse(readFileSync(new URL('./site.config.json', import.meta.url), 'utf8'));

// En-tetes de securite servis par Cloudflare Pages (dist/_headers), produits ici pour
// rester dans le gabarit (mis a jour chez les clients) et non dans public/ (contenu du client).
// Seul domaine exterieur admis : le captcha du formulaire. 'unsafe-inline' : Astro integre
// le script du formulaire et les styles dans la page. Verifie par npm run check [en-tetes].
const CAPTCHA = 'https://challenges.cloudflare.com';
const EN_TETES = `/*
  Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline' ${CAPTCHA}; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; frame-src ${CAPTCHA}; form-action 'self'; frame-ancestors 'none'; base-uri 'self'; object-src 'none'
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  X-Frame-Options: DENY
  Permissions-Policy: camera=(), microphone=(), geolocation=()
`;
const enTetes = {
  name: 'en-tetes-securite',
  hooks: { 'astro:build:done': ({ dir }) => writeFileSync(new URL('_headers', dir), EN_TETES) },
};

// robots.txt vient du noyau (reserve, mis a jour chez les clients), pas de src/pages/.
const robots = {
  name: 'robots-du-noyau',
  hooks: { 'astro:config:setup': ({ injectRoute }) => injectRoute({ pattern: '/robots.txt', entrypoint: './noyau/robots.txt.js' }) },
};

export default defineConfig({
  // L'URL de prod sert aux canonical et au sitemap, y compris sur le site dev.
  site: config.urlProd,
  trailingSlash: 'always',
  build: { format: 'directory' },
  integrations: [sitemap({ filter: (page) => !page.includes('/404') }), enTetes, robots],
});
