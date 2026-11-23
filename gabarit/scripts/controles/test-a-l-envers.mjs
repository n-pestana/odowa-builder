// "Un controle non teste a l'envers ne vaut rien."
// Pour chaque controle : on injecte une regression dans une copie de dist/,
// on verifie que le controle echoue en nommant la bonne page, puis on jette la copie.
// Usage : npm run build && npm run check:envers

import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { controler } from './index.mjs';

const RACINE = fileURLToPath(new URL('../../', import.meta.url));
const DIST = join(RACINE, 'dist');
const config = JSON.parse(readFileSync(join(RACINE, 'site.config.json'), 'utf8'));

const modifier = (dossier, fichier, transformation) => {
  const chemin = join(dossier, fichier);
  const avant = readFileSync(chemin, 'utf8');
  const apres = transformation(avant);
  if (apres === avant) throw new Error(`Le sabotage n'a rien change dans ${fichier}`);
  writeFileSync(chemin, apres);
};

const sabotages = [
  {
    nom: 'titre supprime',
    attendu: { controle: 'titre', page: '/contact/' },
    appliquer: (d) => modifier(d, 'contact/index.html', (h) => h.replace(/<title>.*?<\/title>/s, '')),
  },
  {
    nom: 'description supprimee',
    attendu: { controle: 'description', page: '/prestations/' },
    appliquer: (d) => modifier(d, 'prestations/index.html', (h) => h.replace(/<meta name="description"[^>]*>/, '')),
  },
  {
    nom: 'deuxieme h1',
    attendu: { controle: 'h1', page: '/' },
    appliquer: (d) => modifier(d, 'index.html', (h) => h.replace('</main>', '<h1>Doublon</h1></main>')),
  },
  {
    nom: 'lien interne casse',
    attendu: { controle: 'liens', page: '/' },
    appliquer: (d) => modifier(d, 'index.html', (h) => h.replace('</main>', '<a href="/page-inexistante/">x</a></main>')),
  },
  {
    nom: 'noindex en prod',
    attendu: { controle: 'indexation', page: '/prestations/' },
    appliquer: (d) =>
      modifier(d, 'prestations/index.html', (h) => h.replace('</head>', '<meta name="robots" content="noindex"></head>')),
  },
  {
    nom: 'image sans alt',
    attendu: { controle: 'images-alt', page: '/' },
    appliquer: (d) => modifier(d, 'index.html', (h) => h.replace('</main>', '<img src="/robots.txt"></main>')),
  },
  {
    nom: 'canonical vers un autre domaine',
    attendu: { controle: 'canonical', page: '/contact/' },
    appliquer: (d) =>
      modifier(d, 'contact/index.html', (h) => h.replace(/(<link rel="canonical" href=")[^"]*/, '$1https://autre-domaine.test/contact/')),
  },
  {
    nom: 'attribut lang supprime',
    attendu: { controle: 'langue', page: '/mentions-legales/' },
    appliquer: (d) => modifier(d, 'mentions-legales/index.html', (h) => h.replace(/<html lang="[^"]*"/, '<html')),
  },
  {
    nom: 'titre en double',
    attendu: { controle: 'titres-uniques' },
    appliquer: (d) => {
      const titre = readFileSync(join(d, 'index.html'), 'utf8').match(/<title>.*?<\/title>/s)[0];
      modifier(d, 'contact/index.html', (h) => h.replace(/<title>.*?<\/title>/s, titre));
    },
  },
  {
    nom: 'description en double',
    attendu: { controle: 'descriptions-uniques' },
    appliquer: (d) => {
      const description = readFileSync(join(d, 'index.html'), 'utf8').match(/<meta name="description"[^>]*>/)[0];
      modifier(d, 'contact/index.html', (h) => h.replace(/<meta name="description"[^>]*>/, description));
    },
  },
  {
    nom: 'sitemap supprime',
    attendu: { controle: 'sitemap' },
    appliquer: (d) => rmSync(join(d, 'sitemap-index.xml')),
  },
  {
    nom: 'page retiree du sitemap',
    attendu: { controle: 'sitemap', page: '/prestations/' },
    appliquer: (d) => modifier(d, 'sitemap-0.xml', (x) => x.replace(/<url><loc>[^<]*\/prestations\/<\/loc>.*?<\/url>/s, '')),
  },
  {
    nom: 'robots.txt qui bloque tout',
    attendu: { controle: 'robots' },
    appliquer: (d) => writeFileSync(join(d, 'robots.txt'), 'User-agent: *\nDisallow: /\n'),
  },
  {
    nom: 'image trop lourde',
    attendu: { controle: 'poids-images' },
    appliquer: (d) => writeFileSync(join(d, 'lourde.jpg'), Buffer.alloc(500 * 1024)),
  },
  {
    nom: 'donnees structurees illisibles',
    attendu: { controle: 'donnees-structurees', page: '/' },
    appliquer: (d) => modifier(d, 'index.html', (h) => h.replace('<script type="application/ld+json">{', '<script type="application/ld+json">{,')),
  },
];

const reference = controler({ dossier: DIST, urlProd: config.urlProd, mode: 'prod' });
if (reference.problemes.length > 0) {
  console.log('Impossible de tester a l\'envers : le build de depart n\'est pas vert. Lancer "npm run check".');
  process.exit(1);
}

let rates = 0;
for (const sabotage of sabotages) {
  const copie = mkdtempSync(join(tmpdir(), 'envers-'));
  try {
    cpSync(DIST, copie, { recursive: true });
    sabotage.appliquer(copie);
    const { problemes } = controler({ dossier: copie, urlProd: config.urlProd, mode: 'prod' });
    const detecte = problemes.some(
      (p) => p.controle === sabotage.attendu.controle && (!sabotage.attendu.page || p.page.includes(sabotage.attendu.page)),
    );
    console.log(`${detecte ? 'DETECTE    ' : 'NON DETECTE'} - ${sabotage.nom} -> [${sabotage.attendu.controle}]`);
    if (!detecte) rates += 1;
  } catch (erreur) {
    console.log(`ERREUR      - ${sabotage.nom} : ${erreur.message}`);
    rates += 1;
  } finally {
    rmSync(copie, { recursive: true, force: true });
  }
}

// Le mode dev a son propre controle : un build de prod doit y echouer (pas de noindex).
const enDev = controler({ dossier: DIST, urlProd: config.urlProd, mode: 'dev' });
const devDetecte = enDev.problemes.some((p) => p.controle === 'indexation') && enDev.problemes.some((p) => p.controle === 'robots');
console.log(`${devDetecte ? 'DETECTE    ' : 'NON DETECTE'} - build de prod controle en mode dev -> [indexation] + [robots]`);
if (!devDetecte) rates += 1;

if (rates > 0) {
  console.log(`\nROUGE - ${rates} regression(s) non detectee(s) : les controles concernes ne protegent rien.`);
  process.exit(1);
}
console.log(`\nVERT - ${sabotages.length + 1} regressions injectees, toutes detectees.`);
