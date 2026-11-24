// Controles automatiques du site construit (dossier dist/).
// Usage : npm run check            (mode prod, le defaut)
//         npm run check -- --mode=dev
//         npm run check -- --mode=dev --seulement=indexation,robots
//           (publication du site de test : seul le non-referencement bloque ; les autres
//            controles tournent en parallele dans le job "controles" et bloquent la mise en prod)
// Sortie : une ligne par probleme, avec la page et la cause. Code 1 si un controle echoue.
//
// REGLE : tout controle ajoute ici doit avoir son sabotage dans test-a-l-envers.mjs.

import { execFileSync } from 'node:child_process';
import { existsSync, realpathSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'node-html-parser';

const RACINE = fileURLToPath(new URL('../../', import.meta.url));
const POIDS_MAX_IMAGE = 400 * 1024;
const POIDS_MAX_PAGE = 1024 * 1024; // HTML + CSS + JS + images d'une page
const EXTENSIONS_IMAGE = /\.(png|jpe?g|gif|webp|avif|svg)$/i;
// Seul domaine exterieur admis : le captcha du formulaire (Cloudflare, deja hebergeur du site).
const DOMAINES_ADMIS = ['challenges.cloudflare.com'];
const LIENS_VAGUES = ['cliquez ici', 'ici', 'lire la suite', 'en savoir plus', 'plus', 'lien', 'voir'];
// Motifs de secrets connus. Le secret n'est jamais affiche, seulement le fichier.
const SECRETS = /\bre_[A-Za-z0-9_]{20,}|-----BEGIN [A-Z ]*PRIVATE KEY-----|\bghp_[A-Za-z0-9]{30,}|\bgithub_pat_[A-Za-z0-9_]{30,}|\bsk_live_[A-Za-z0-9]{20,}/;
const EN_TETES_OBLIGATOIRES = ['Content-Security-Policy', 'X-Content-Type-Options', 'Referrer-Policy', 'X-Frame-Options'];

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

// Adresse d'une page a partir de son fichier source : src/pages/a/b.md -> /a/b/ ; index -> /
// null pour ce qui n'est pas une page (robots.txt.js, 404, pages dynamiques).
export function adresseDuSource(fichier) {
  const m = fichier.replace(/^src\/pages\//, '').match(/^(.*)\.(md|mdx|astro|html)$/);
  if (!m || /(^|\/)(_|\[)/.test(m[1]) || m[1] === '404') return null;
  const chemin = m[1].replace(/(^|\/)index$/, '');
  return chemin === '' ? '/' : `/${chemin}/`;
}

const estExterne = (url) => /^(https?:)?\/\//i.test(url);
const domaine = (url) => {
  try {
    return new URL(url, 'https://local.invalid').hostname;
  } catch {
    return '?';
  }
};

export function controler({ dossier, urlProd, mode = 'prod', seulement = null, sources = null, pagesEnLigne = null }) {
  const resultat = controlerTout({ dossier, urlProd, mode, sources, pagesEnLigne });
  if (!seulement) return resultat;
  // 'build' (dist/ absent) n'est jamais filtre : sans site construit, rien n'est controle.
  return { ...resultat, problemes: resultat.problemes.filter((p) => p.controle === 'build' || seulement.includes(p.controle)) };
}

function controlerTout({ dossier, urlProd, mode, sources, pagesEnLigne }) {
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
  const liensEntrants = new Map(); // page -> pages qui la citent
  const toutesLesPages = [];

  for (const fichier of pagesHtml) {
    const page = cheminPage(dossier, fichier);
    const est404 = page === '/404.html';
    const html = parse(readFileSync(fichier, 'utf8'));

    // Le noyau (noyau/Page.astro) produit l'en-tete de chaque page : referencement, site de test.
    if (html.querySelector('meta[name="noyau"]')?.getAttribute('content') !== 'odowa-builder') {
      signaler('noyau', page, 'La page ne passe pas par le noyau (noyau/Page.astro, via src/layouts/Base.astro).');
    }

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

    if (!est404) toutesLesPages.push(page);
    for (const lien of html.querySelectorAll('a[href]')) {
      const cible = (lien.getAttribute('href') ?? '').split('#')[0].split('?')[0];
      if (!cible.startsWith('/') || cible.startsWith('//') || cible === page) continue;
      liensEntrants.set(cible, [...(liensEntrants.get(cible) ?? []), page]);
    }

    // Adresse de page : minuscules, chiffres et tirets (lisible, durable, bonne pour Google).
    if (!est404 && !/^\/([a-z0-9]+(-[a-z0-9]+)*\/)*$/.test(page)) {
      signaler('adresses', page, 'Adresse de page avec majuscules, accents, espaces ou soulignes : utiliser des minuscules et des tirets (ex. /nos-tarifs/).');
    }

    // Niveaux de titres : pas de saut (h2 puis h4).
    let niveauPrecedent = 0;
    for (const t of html.querySelectorAll('h1, h2, h3, h4, h5, h6')) {
      const niveau = Number(t.tagName.slice(1));
      if (niveau > niveauPrecedent + 1 && niveauPrecedent > 0) {
        signaler('niveaux-titres', page, `Titre de niveau ${niveau} apres un niveau ${niveauPrecedent} : "${t.text.trim().slice(0, 50)}"`);
      }
      niveauPrecedent = niveau;
    }

    // Ressources exterieures : ni police, ni script, ni video chargee chez un tiers (RGPD, simplicite).
    const ressources = html.querySelectorAll('script[src], link[href], iframe[src], img[src], source[src], source[srcset], video[src], audio[src], embed[src], object[data]');
    for (const r of ressources) {
      if (r.tagName === 'LINK' && /^(canonical|alternate|sitemap)$/i.test(r.getAttribute('rel') ?? '')) continue;
      const url = r.getAttribute('src') ?? r.getAttribute('href') ?? r.getAttribute('data') ?? (r.getAttribute('srcset') ?? '').split(/\s/)[0];
      if (estExterne(url) && !DOMAINES_ADMIS.includes(domaine(url))) {
        signaler('ressources-externes', page, `Ressource chargee depuis ${domaine(url)} : la mettre sur le site, ou demander a Nicolas.`);
      }
    }
    for (const bloc of html.querySelectorAll('style')) {
      for (const m of bloc.text.matchAll(/(?:@import\s+(?:url\()?|url\()\s*["']?((?:https?:)?\/\/[^"')\s]+)/g)) {
        if (!DOMAINES_ADMIS.includes(domaine(m[1]))) signaler('ressources-externes', page, `Style charge depuis ${domaine(m[1])}.`);
      }
    }

    // JavaScript : seulement les donnees structurees, et le formulaire du noyau (<Formulaire />).
    const avecFormulaire = Boolean(html.querySelector('form#formulaire-contact'));
    for (const script of html.querySelectorAll('script')) {
      if (script.getAttribute('type') === 'application/ld+json') continue;
      if (!avecFormulaire) signaler('scripts', page, 'Script sur une page sans formulaire : le site reste sans JavaScript, sauf le formulaire de contact.');
    }

    // Accessibilite : champs de formulaire avec un libelle, liens avec un texte qui dit ou ils menent.
    const libelles = new Set(html.querySelectorAll('label[for]').map((l) => l.getAttribute('for')));
    for (const champ of html.querySelectorAll('input, select, textarea')) {
      if (/^(hidden|submit|button|reset)$/i.test(champ.getAttribute('type') ?? '')) continue;
      let dansUnLabel = false;
      for (let n = champ.parentNode; n; n = n.parentNode) if (n.tagName === 'LABEL') dansUnLabel = true;
      const nomme = dansUnLabel || libelles.has(champ.getAttribute('id')) || champ.getAttribute('aria-label') || champ.getAttribute('aria-labelledby');
      if (!nomme) signaler('formulaire-libelles', page, `Champ sans libelle : ${champ.getAttribute('name') ?? champ.tagName.toLowerCase()}`);
    }
    for (const lien of html.querySelectorAll('a[href]')) {
      const texte = (lien.text.trim() || lien.getAttribute('aria-label') || lien.querySelector('img')?.getAttribute('alt') || '').trim();
      if (!texte) signaler('liens-texte', page, `Lien sans texte : ${lien.getAttribute('href')}`);
      else if (LIENS_VAGUES.includes(texte.toLowerCase().replace(/[.!…]+$/, ''))) {
        signaler('liens-texte', page, `Lien au texte vague "${texte}" : dire ou il mene (ex. "voir nos tarifs").`);
      }
      if (lien.getAttribute('target') === '_blank' && !/\bnoopener\b/.test(lien.getAttribute('rel') ?? '')) {
        signaler('liens-externes', page, `Lien qui ouvre un nouvel onglet sans rel="noopener" : ${lien.getAttribute('href')}`);
      }
    }

    // Images : passees par Astro (WebP, dimensions declarees : la page ne saute pas au chargement).
    for (const image of html.querySelectorAll('img')) {
      const src = image.getAttribute('src') ?? '';
      if (!image.getAttribute('width') || !image.getAttribute('height')) {
        signaler('images-dimensions', page, `Image sans largeur ni hauteur declarees : ${src}. La mettre dans src/images/ (Astro les ajoute).`);
      }
      if (/\.(jpe?g|png)$/i.test(src.split('?')[0])) {
        signaler('images-format', page, `Image en ${src.split('.').pop()} : la mettre dans src/images/, Astro la convertit en WebP.`);
      }
    }

    // Poids de la page : HTML + fichiers locaux qu'elle charge.
    let poids = statSync(fichier).size;
    const charges = new Set(ressources.map((r) => r.getAttribute('src') ?? r.getAttribute('href') ?? '').filter((u) => u.startsWith('/') && !u.startsWith('//')));
    for (const u of charges) {
      const f = join(dossier, decodeURIComponent(u.split('?')[0]));
      if (existsSync(f) && statSync(f).isFile()) poids += statSync(f).size;
    }
    if (poids > POIDS_MAX_PAGE) signaler('poids-page', page, `Page de ${Math.round(poids / 1024)} Ko avec ses fichiers (maximum : 1024 Ko).`);

    // Typographie francaise : espace insecable avant : ; ! ? » et apres «.
    // Fin de bloc = fin de phrase : on y ajoute une espace pour ne pas coller deux paragraphes.
    const corps = parse((html.querySelector('body')?.innerHTML ?? '').replace(/<\/(p|li|h[1-6]|div|td|th|dt|dd|blockquote|section|article|header|footer|nav|main|label|button|option)>/gi, '$& '));
    for (const n of corps.querySelectorAll('script, style, pre, code')) n.remove();
    const texte = corps.text.replace(/[ \t\r\n]+/g, ' ');
    const fautes = [
      [/\S [;:!?»]/u, 'espace ordinaire avant la ponctuation : ecrire &nbsp;'],
      [/\p{L}[;!?»](?= |$)/u, 'ponctuation collee au mot : ajouter &nbsp; avant'],
      [/\p{L}:(?= |$)/u, 'deux-points colles au mot : ajouter &nbsp; avant'],
      [/«(?:[ ]|\p{L})/u, 'guillemet « sans espace insecable apres'],
    ];
    for (const [motif, explication] of fautes) {
      const m = texte.match(motif);
      if (m) signaler('typographie', page, `${explication} : "…${texte.slice(Math.max(0, m.index - 20), m.index + 5).trim()}…"`);
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

  if (!existsSync(join(dossier, 'sitemap.xml'))) signaler('sitemap', '/sitemap.xml', 'Le fichier /sitemap.xml est absent.');
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

  // Pages orphelines : chaque page est citee par au moins une autre (menu compris).
  for (const page of toutesLesPages) {
    if (page !== '/' && !liensEntrants.has(page)) signaler('orphelines', page, 'Aucune autre page ne fait de lien vers celle-ci : l\'ajouter au menu ou a une page.');
  }

  // En-tetes de securite (dist/_headers, produit par astro.config.mjs).
  const fichierEnTetes = join(dossier, '_headers');
  const enTetes = existsSync(fichierEnTetes) ? readFileSync(fichierEnTetes, 'utf8') : '';
  for (const nom of EN_TETES_OBLIGATOIRES) {
    if (!new RegExp(`^\\s+${nom}:`, 'mi').test(enTetes)) signaler('en-tetes', '/_headers', `En-tete de securite absent : ${nom}.`);
  }

  // Secrets : jamais dans le site publie.
  for (const fichier of fichiers.filter((f) => /\.(html|js|css|txt|xml|json|map)$/.test(f) || /_headers|_redirects/.test(f))) {
    if (SECRETS.test(readFileSync(fichier, 'utf8'))) signaler('secrets', cheminPage(dossier, fichier), 'Ce fichier contient ce qui ressemble a une cle secrete. Prevenir Nicolas.');
  }

  // Adresses durables : une page du site en ligne qui disparait garde une redirection.
  if (pagesEnLigne) {
    const redirections = existsSync(join(dossier, '_redirects')) ? readFileSync(join(dossier, '_redirects'), 'utf8') : '';
    const redirigees = new Set(redirections.split('\n').map((l) => l.trim().split(/\s+/)[0]).filter(Boolean));
    for (const ancienne of pagesEnLigne) {
      if (toutesLesPages.includes(ancienne) || redirigees.has(ancienne) || redirigees.has(ancienne.replace(/\/$/, ''))) continue;
      signaler('redirections', ancienne, `Page du site en ligne supprimee sans redirection : ajouter "${ancienne} /nouvelle-adresse/ 301" dans public/_redirects.`);
    }
  }

  // Sources (src/) : une seule source pour les coordonnees, une seule pour les couleurs.
  if (sources) {
    const entreprise = JSON.parse(readFileSync(join(sources, 'donnees', 'entreprise.json'), 'utf8'));
    const coordonnees = [entreprise.telephone, entreprise.telephoneAffiche, entreprise.email, entreprise.adresse?.rue].filter((v) => v && v.length >= 6);
    for (const fichier of listerFichiers(sources).filter((f) => /\.(md|mdx|astro|html|js)$/.test(f))) {
      const rel = 'src/' + relative(sources, fichier).split(sep).join('/');
      const contenu = readFileSync(fichier, 'utf8');
      for (const valeur of coordonnees) {
        if (contenu.includes(valeur)) signaler('ssot', rel, `"${valeur}" ecrit en dur : le lire dans src/donnees/entreprise.json (une seule source).`);
      }
      if (rel !== 'src/layouts/Base.astro') {
        const styles = [...contenu.matchAll(/<style[^>]*>([\s\S]*?)<\/style>|style="([^"]*)"/g)].map((m) => m[1] ?? m[2]).join('\n');
        const couleur = styles.match(/#[0-9a-fA-F]{3,8}\b|\brgba?\(|\bhsla?\(/);
        if (couleur) signaler('couleurs', rel, `Couleur ecrite en dur (${couleur[0]}…) : utiliser une variable var(--…) definie dans src/layouts/Base.astro.`);
      }
      if (SECRETS.test(contenu)) signaler('secrets', rel, 'Ce fichier contient ce qui ressemble a une cle secrete. Prevenir Nicolas.');
    }
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
  const seulement = process.argv.find((a) => a.startsWith('--seulement='))?.split('=')[1]?.split(',').filter(Boolean) ?? null;
  const config = JSON.parse(readFileSync(join(RACINE, 'site.config.json'), 'utf8'));
  // Pages du site en ligne, lues dans git (branche du site en ligne). Inconnues ici : non verifie, et on le dit.
  let pagesEnLigne = null;
  try {
    // Seulement dans un depot client (site a la racine du depot). Dans l'usine, gabarit/ n'a pas de site en ligne.
    const racineGit = execFileSync('git', ['rev-parse', '--show-toplevel'], { cwd: RACINE, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    if (realpathSync(racineGit) !== realpathSync(RACINE)) throw new Error('pas un depot client');
    pagesEnLigne = execFileSync('git', ['ls-tree', '-r', '--name-only', `origin/${config.brancheProd ?? 'main'}`, '--', 'src/pages'], { cwd: RACINE, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
      .split('\n').map(adresseDuSource).filter(Boolean);
  } catch {
    /* pas de branche du site en ligne ici */
  }
  const { problemes, pages } = controler({ dossier: join(RACINE, 'dist'), urlProd: config.urlProd, mode, seulement, sources: join(RACINE, 'src'), pagesEnLigne });
  const portee = seulement ? `, controles : ${seulement.join(', ')}` : '';
  if (!pagesEnLigne && (!seulement || seulement.includes('redirections'))) console.log('NON VERIFIE - redirections : pages du site en ligne inconnues ici (usine, ou pas de origin/main).');

  mkdirSync(join(RACINE, '.rapports'), { recursive: true });
  writeFileSync(
    join(RACINE, '.rapports', 'controles.json'),
    JSON.stringify({ date: new Date().toISOString(), mode, pages, vert: problemes.length === 0, problemes }, null, 2),
  );

  if (problemes.length === 0) {
    console.log(`VERT - ${pages} pages controlees (mode ${mode}${portee}), aucun probleme.`);
  } else {
    console.log(`ROUGE - ${problemes.length} probleme(s) sur ${pages} pages (mode ${mode}${portee}) :`);
    for (const p of problemes) console.log(`  [${p.controle}] ${p.page} - ${p.detail}`);
    process.exit(1);
  }
}
