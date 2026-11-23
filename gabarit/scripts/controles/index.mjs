// Controles automatiques du site construit (dossier dist/).
// Usage : npm run check            (mode prod, le defaut)
//         npm run check -- --mode=dev
// Sortie : une ligne par probleme, avec la page et la cause. Code 1 si un controle echoue.
//
// REGLE : tout controle ajoute ici doit avoir son sabotage dans test-a-l-envers.mjs.

import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'node-html-parser';

const RACINE = fileURLToPath(new URL('../../', import.meta.url));
const POIDS_MAX_IMAGE = 400 * 1024;
const EXTENSIONS_IMAGE = /\.(png|jpe?g|gif|webp|avif|svg)$/i;

function listerFichiers(dossier) {
  return readdirSync(dossier, { withFileTypes: true }).flatMap((entree) => {
    const chemin = join(dossier, entree.name);
    return entree.isDirectory() ? listerFichiers(chemin) : [chemin];
  });
}

// dist/contact/index.html -> /contact/   ;   dist/404.html -> /404.html
function cheminPage(dossier, fichier) {
  const rel = relative(dossier, fichier).split(sep).join('/');
  return '/' + rel.replace(/index\.html$/, '');
}

function cibleExiste(dossier, lien) {
  const propre = decodeURIComponent(lien.split('#')[0].split('?')[0]);
  if (propre === '' || propre === '/') return existsSync(join(dossier, 'index.html'));
  const base = join(dossier, propre);
  if (propre.endsWith('/')) return existsSync(join(base, 'index.html'));
  return (existsSync(base) && statSync(base).isFile()) || existsSync(join(base, 'index.html'));
}

export function controler({ dossier, urlProd, mode = 'prod' }) {
  const problemes = [];
  const signaler = (controle, page, detail) => problemes.push({ controle, page, detail });

  if (!existsSync(dossier)) {
    signaler('build', '-', `Le dossier ${dossier} n'existe pas : lancer "npm run build" d'abord.`);
    return { problemes, pages: 0 };
  }

  const fichiers = listerFichiers(dossier);
  const pagesHtml = fichiers.filter((f) => f.endsWith('.html'));
  const titres = new Map();
  const descriptions = new Map();
  const urlsCanoniques = [];
  const base = urlProd.replace(/\/$/, '');

  for (const fichier of pagesHtml) {
    const page = cheminPage(dossier, fichier);
    const est404 = page === '/404.html';
    const html = parse(readFileSync(fichier, 'utf8'));

    if (!html.querySelector('html')?.getAttribute('lang')) {
      signaler('langue', page, 'La balise <html> n\'a pas d\'attribut lang.');
    }

    const titre = html.querySelector('head > title')?.text.trim() ?? '';
    if (!titre) signaler('titre', page, 'Pas de balise <title>.');
    else if (titre.length < 10 || titre.length > 65) {
      signaler('titre', page, `Titre de ${titre.length} caracteres (attendu : 10 a 65) : "${titre}"`);
    }
    if (titre) titres.set(titre, [...(titres.get(titre) ?? []), page]);

    const description = html.querySelector('meta[name="description"]')?.getAttribute('content')?.trim() ?? '';
    if (!description) signaler('description', page, 'Pas de meta description.');
    else if (description.length < 50 || description.length > 160) {
      signaler('description', page, `Description de ${description.length} caracteres (attendu : 50 a 160).`);
    }
    if (description) descriptions.set(description, [...(descriptions.get(description) ?? []), page]);

    const nombreH1 = html.querySelectorAll('h1').length;
    if (nombreH1 !== 1) signaler('h1', page, `${nombreH1} balise(s) <h1> (attendu : exactement 1).`);

    const robots = html.querySelector('meta[name="robots"]')?.getAttribute('content') ?? '';
    const noindex = /noindex/i.test(robots);
    if (mode === 'prod' && noindex && !est404) {
      signaler('indexation', page, 'La page porte "noindex" alors que c\'est un build de prod.');
    }
    if (mode === 'dev' && !noindex) {
      signaler('indexation', page, 'Le site dev doit porter "noindex" sur toutes les pages.');
    }

    if (!est404) {
      const canonical = html.querySelector('link[rel="canonical"]')?.getAttribute('href') ?? '';
      const attendu = base + page;
      if (!canonical) signaler('canonical', page, 'Pas de lien canonical.');
      else if (canonical !== attendu) {
        signaler('canonical', page, `Canonical "${canonical}" (attendu : "${attendu}").`);
      }
      urlsCanoniques.push({ page, url: attendu });
    }

    for (const image of html.querySelectorAll('img')) {
      if (image.getAttribute('alt') === undefined) {
        signaler('images-alt', page, `Image sans attribut alt : ${image.getAttribute('src') ?? '(sans src)'}`);
      }
    }

    for (const lien of html.querySelectorAll('a[href], link[href], img[src], script[src]')) {
      const cible = lien.getAttribute('href') ?? lien.getAttribute('src') ?? '';
      if (!cible.startsWith('/') || cible.startsWith('//') || cible.startsWith('/api/')) continue;
      if (!cibleExiste(dossier, cible)) signaler('liens', page, `Lien interne casse : ${cible}`);
    }

    for (const bloc of html.querySelectorAll('script[type="application/ld+json"]')) {
      try {
        const donnees = JSON.parse(bloc.text);
        if (!donnees['@type']) signaler('donnees-structurees', page, 'Bloc JSON-LD sans "@type".');
      } catch {
        signaler('donnees-structurees', page, 'Bloc JSON-LD illisible (JSON invalide).');
      }
    }
  }

  for (const [titre, pages] of titres) {
    if (pages.length > 1) signaler('titres-uniques', pages.join(', '), `Meme titre sur plusieurs pages : "${titre}"`);
  }
  for (const [, pages] of descriptions) {
    if (pages.length > 1) signaler('descriptions-uniques', pages.join(', '), 'Meme meta description sur plusieurs pages.');
  }

  const indexSitemap = join(dossier, 'sitemap-index.xml');
  if (!existsSync(indexSitemap)) {
    signaler('sitemap', '/sitemap-index.xml', 'Le sitemap est absent.');
  } else {
    const contenu = fichiers
      .filter((f) => /sitemap.*\.xml$/.test(f))
      .map((f) => readFileSync(f, 'utf8'))
      .join('\n');
    for (const { page, url } of urlsCanoniques) {
      if (!contenu.includes(`<loc>${url}</loc>`)) signaler('sitemap', page, `Page absente du sitemap : ${url}`);
    }
  }

  const fichierRobots = join(dossier, 'robots.txt');
  if (!existsSync(fichierRobots)) {
    signaler('robots', '/robots.txt', 'Le fichier robots.txt est absent.');
  } else {
    const robots = readFileSync(fichierRobots, 'utf8');
    const bloqueTout = /^Disallow:\s*\/\s*$/m.test(robots);
    if (mode === 'prod' && bloqueTout) signaler('robots', '/robots.txt', 'robots.txt bloque tout le site en prod.');
    if (mode === 'prod' && !robots.includes(`Sitemap: ${base}/sitemap-index.xml`)) {
      signaler('robots', '/robots.txt', 'robots.txt n\'indique pas le sitemap de prod.');
    }
    if (mode === 'dev' && !bloqueTout) signaler('robots', '/robots.txt', 'Le robots.txt du site dev doit tout bloquer.');
  }

  for (const fichier of fichiers.filter((f) => EXTENSIONS_IMAGE.test(f))) {
    const poids = statSync(fichier).size;
    if (poids > POIDS_MAX_IMAGE) {
      signaler('poids-images', cheminPage(dossier, fichier), `Image de ${Math.round(poids / 1024)} Ko (maximum : 400 Ko).`);
    }
  }

  return { problemes, pages: pagesHtml.length };
}

// --- Execution en ligne de commande -----------------------------------------
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const argMode = process.argv.find((a) => a.startsWith('--mode='))?.split('=')[1];
  const mode = argMode ?? (process.env.PUBLIC_ENV === 'dev' ? 'dev' : 'prod');
  const config = JSON.parse(readFileSync(join(RACINE, 'site.config.json'), 'utf8'));
  const { problemes, pages } = controler({ dossier: join(RACINE, 'dist'), urlProd: config.urlProd, mode });

  mkdirSync(join(RACINE, '.rapports'), { recursive: true });
  writeFileSync(
    join(RACINE, '.rapports', 'controles.json'),
    JSON.stringify({ date: new Date().toISOString(), mode, pages, vert: problemes.length === 0, problemes }, null, 2),
  );

  if (problemes.length === 0) {
    console.log(`VERT - ${pages} pages controlees (mode ${mode}), aucun probleme.`);
  } else {
    console.log(`ROUGE - ${problemes.length} probleme(s) sur ${pages} pages (mode ${mode}) :`);
    for (const p of problemes) console.log(`  [${p.controle}] ${p.page} - ${p.detail}`);
    process.exit(1);
  }
}
