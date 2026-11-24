// "Un controle non teste a l'envers ne vaut rien."
// Pour chaque controle : on injecte une regression dans une copie de dist/,
// on verifie que le controle echoue en nommant la bonne page, puis on jette la copie.
// Usage : npm run build && npm run check:envers

import { appendFileSync, cpSync, mkdtempSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { controler } from './index.mjs';

const RACINE = fileURLToPath(new URL('../../', import.meta.url));
const DIST = join(RACINE, 'dist');
const SRC = join(RACINE, 'src');
const config = JSON.parse(readFileSync(join(RACINE, 'site.config.json'), 'utf8'));

// Les pages sabotees sont prises dans le site REEL du client, jamais dans le site d'exemple
// (un client qui supprime une page d'exemple ne doit pas bloquer ses propres controles).
const pagesDuSite = readdirSync(DIST, { recursive: true }).map(String).filter((f) => f.endsWith('index.html') && f !== 'index.html').sort();
const aUnFormulaire = (f) => readFileSync(join(DIST, f), 'utf8').includes('id="formulaire-contact"');
const FORMULAIRE = pagesDuSite.find(aUnFormulaire) ?? null; // page qui porte <Formulaire />
const AUTRE = pagesDuSite.find((f) => !aUnFormulaire(f)) ?? pagesDuSite[0]; // une page ordinaire
const TROISIEME = pagesDuSite.find((f) => f !== AUTRE) ?? AUTRE; // une deuxieme page
if (!AUTRE) {
  console.log('ROUGE - le site n\'a qu\'une page : les sabotages ont besoin d\'au moins deux pages. Prevenir Nicolas.');
  process.exit(1);
}
const adresse = (f) => '/' + f.replace(/index\.html$/, '');
const A = adresse(AUTRE);
const T = adresse(TROISIEME);
const echapper = (t) => t.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');

const modifier = (dossier, fichier, transformation) => {
  const chemin = join(dossier, fichier);
  const avant = readFileSync(chemin, 'utf8');
  const apres = transformation(avant);
  if (apres === avant) throw new Error(`Le sabotage n'a rien change dans ${fichier}`);
  writeFileSync(chemin, apres);
};

const ajouter = (d, fichier, morceau) => modifier(d, fichier, (h) => h.replace('</main>', `${morceau}</main>`));
const pagesHtml = (d) => readdirSync(d, { recursive: true }).map(String).filter((f) => f.endsWith('.html'));
// Les sabotages des sources (src/) portent sur une copie : d/__src
const source = (d, fichier) => join(d, '__src', fichier);

const sabotages = [
  {
    nom: 'titre supprime',
    attendu: { controle: 'titre', page: T },
    appliquer: (d) => modifier(d, TROISIEME, (h) => h.replace(/<title>.*?<\/title>/s, '')),
  },
  {
    nom: 'description supprimee',
    attendu: { controle: 'description', page: A },
    appliquer: (d) => modifier(d, AUTRE, (h) => h.replace(/<meta name="description"[^>]*>/, '')),
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
    attendu: { controle: 'indexation', page: A },
    appliquer: (d) =>
      modifier(d, AUTRE, (h) => h.replace('</head>', '<meta name="robots" content="noindex"></head>')),
  },
  {
    nom: 'image sans alt',
    attendu: { controle: 'images-alt', page: '/' },
    appliquer: (d) => modifier(d, 'index.html', (h) => h.replace('</main>', '<img src="/robots.txt"></main>')),
  },
  {
    nom: 'canonical vers un autre domaine',
    attendu: { controle: 'canonical', page: T },
    appliquer: (d) =>
      modifier(d, TROISIEME, (h) => h.replace(/(<link rel="canonical" href=")[^"]*/, '$1https://autre-domaine.test/page/')),
  },
  {
    nom: 'attribut lang supprime',
    attendu: { controle: 'langue', page: T },
    appliquer: (d) => modifier(d, TROISIEME, (h) => h.replace(/<html lang="[^"]*"/, '<html')),
  },
  {
    nom: 'titre en double',
    attendu: { controle: 'titres-uniques' },
    appliquer: (d) => {
      const titre = readFileSync(join(d, 'index.html'), 'utf8').match(/<title>.*?<\/title>/s)[0];
      modifier(d, TROISIEME, (h) => h.replace(/<title>.*?<\/title>/s, titre));
    },
  },
  {
    nom: 'description en double',
    attendu: { controle: 'descriptions-uniques' },
    appliquer: (d) => {
      const description = readFileSync(join(d, 'index.html'), 'utf8').match(/<meta name="description"[^>]*>/)[0];
      modifier(d, TROISIEME, (h) => h.replace(/<meta name="description"[^>]*>/, description));
    },
  },
  {
    nom: 'sitemap supprime',
    attendu: { controle: 'sitemap' },
    appliquer: (d) => rmSync(join(d, 'sitemap-index.xml')),
  },
  {
    nom: 'page retiree du sitemap',
    attendu: { controle: 'sitemap', page: A },
    appliquer: (d) => modifier(d, 'sitemap-0.xml', (x) => x.replace(new RegExp(`<url><loc>[^<]*${echapper(A)}</loc>.*?</url>`, 's'), '')),
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
  {
    nom: 'page qui ne passe pas par le noyau',
    attendu: { controle: 'noyau', page: A },
    appliquer: (d) => modifier(d, AUTRE, (h) => h.replace(/<meta name="noyau"[^>]*>/, '')),
  },
  // --- Bonnes methodes de construction ---
  {
    nom: 'adresse de page avec majuscules et souligne',
    attendu: { controle: 'adresses', page: '_Mal_Nommee/' },
    appliquer: (d) => renameSync(join(d, dirname(AUTRE)), join(d, dirname(dirname(AUTRE)), `${basename(dirname(AUTRE))}_Mal_Nommee`)),
  },
  {
    nom: 'niveau de titre saute (h4 apres h2)',
    attendu: { controle: 'niveaux-titres', page: A },
    appliquer: (d) => ajouter(d, AUTRE, '<h2>Section</h2><h4>Saut</h4>'),
  },
  {
    nom: 'police chargee chez Google',
    attendu: { controle: 'ressources-externes', page: '/' },
    appliquer: (d) => modifier(d, 'index.html', (h) => h.replace('</head>', '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Roboto"></head>')),
  },
  {
    nom: 'police importee dans un style',
    attendu: { controle: 'ressources-externes', page: T },
    appliquer: (d) => modifier(d, TROISIEME, (h) => h.replace('</head>', '<style>@import url("https://fonts.googleapis.com/css2?family=Roboto");</style></head>')),
  },
  {
    nom: 'video integree depuis un autre site',
    attendu: { controle: 'ressources-externes', page: A },
    appliquer: (d) => ajouter(d, AUTRE, '<iframe src="https://www.youtube.com/embed/x" title="video"></iframe>'),
  },
  {
    nom: 'script sur une page sans formulaire',
    attendu: { controle: 'scripts', page: A },
    appliquer: (d) => ajouter(d, AUTRE, '<script>console.log(1)</script>'),
  },
  {
    nom: 'champ de formulaire sans libelle',
    attendu: { controle: 'formulaire-libelles', page: T },
    appliquer: (d) => ajouter(d, TROISIEME, '<input name="societe" type="text">'),
  },
  {
    nom: 'lien au texte vague',
    attendu: { controle: 'liens-texte', page: '/' },
    appliquer: (d) => ajouter(d, 'index.html', `<a href="${A}">cliquez ici</a>`),
  },
  {
    nom: 'lien sans texte',
    attendu: { controle: 'liens-texte', page: '/' },
    appliquer: (d) => ajouter(d, 'index.html', `<a href="${A}"></a>`),
  },
  {
    nom: 'nouvel onglet sans noopener',
    attendu: { controle: 'liens-externes', page: '/' },
    appliquer: (d) => ajouter(d, 'index.html', '<a href="https://partenaire.test/" target="_blank">notre partenaire</a>'),
  },
  {
    nom: 'image sans dimensions',
    attendu: { controle: 'images-dimensions', page: '/' },
    appliquer: (d) => ajouter(d, 'index.html', '<img src="/favicon.svg" alt="logo">'),
  },
  {
    nom: 'photo en jpg non convertie',
    attendu: { controle: 'images-format', page: '/' },
    appliquer: (d) => {
      writeFileSync(join(d, 'photo.jpg'), 'x');
      ajouter(d, 'index.html', '<img src="/photo.jpg" alt="photo" width="10" height="10">');
    },
  },
  {
    nom: 'page trop lourde',
    attendu: { controle: 'poids-page', page: '/' },
    appliquer: (d) => {
      writeFileSync(join(d, 'gros.css'), 'a{}'.repeat(400 * 1024));
      modifier(d, 'index.html', (h) => h.replace('</head>', '<link rel="stylesheet" href="/gros.css"></head>'));
    },
  },
  {
    nom: 'espace ordinaire avant un point d\'exclamation',
    attendu: { controle: 'typographie', page: '/' },
    appliquer: (d) => ajouter(d, 'index.html', '<p>Bienvenue !</p>'),
  },
  {
    nom: 'point d\'interrogation colle au mot',
    attendu: { controle: 'typographie', page: T },
    appliquer: (d) => ajouter(d, TROISIEME, '<p>Une question?</p>'),
  },
  {
    nom: 'page orpheline (plus aucun lien vers elle)',
    attendu: { controle: 'orphelines', page: A },
    appliquer: (d) => {
      for (const f of pagesHtml(d)) writeFileSync(join(d, f), readFileSync(join(d, f), 'utf8').replace(new RegExp(`<a [^>]*href="${echapper(A)}"[^>]*>.*?</a>`, 'gs'), ''));
    },
  },
  {
    nom: 'en-tetes de securite absents',
    attendu: { controle: 'en-tetes' },
    appliquer: (d) => rmSync(join(d, '_headers')),
  },
  {
    nom: 'cle secrete dans une page',
    attendu: { controle: 'secrets', page: '/' },
    appliquer: (d) => ajouter(d, 'index.html', `<!-- re_${'A'.repeat(24)} -->`),
  },
  {
    nom: 'page du site en ligne supprimee sans redirection',
    attendu: { controle: 'redirections', page: '/ancienne-page/' },
    pagesEnLigne: ['/', '/ancienne-page/'],
    appliquer: () => {},
  },
  {
    nom: 'telephone ecrit en dur dans une page',
    attendu: { controle: 'ssot', page: 'src/pages/index.md' },
    appliquer: (d) => {
      // Un numero est pose dans la copie : le site du client peut ne pas en avoir encore.
      const fichier = source(d, 'donnees/entreprise.json');
      const entreprise = JSON.parse(readFileSync(fichier, 'utf8'));
      entreprise.telephoneAffiche ||= '06 12 34 56 78';
      writeFileSync(fichier, JSON.stringify(entreprise));
      appendFileSync(source(d, 'pages/index.md'), `\nAppelez le ${entreprise.telephoneAffiche}.\n`);
    },
  },
  {
    nom: 'couleur ecrite en dur hors de Base.astro',
    attendu: { controle: 'couleurs', page: 'src/pages/contact.astro' },
    appliquer: (d) => appendFileSync(source(d, 'pages/contact.astro'), '\n<style>p { color: #ff0000; }</style>\n'),
  },
  {
    nom: 'cle secrete dans les sources',
    attendu: { controle: 'secrets', page: 'src/pages/index.md' },
    appliquer: (d) => appendFileSync(source(d, 'pages/index.md'), `\nre_${'B'.repeat(24)}\n`),
  },
];

// Cas AUTORISES : la bonne methode ne doit pas etre refusee (un controle trop large bloque le client).
const autorises = [
  {
    nom: 'captcha du formulaire (seul domaine exterieur admis)',
    controles: ['ressources-externes', 'scripts'],
    applicable: FORMULAIRE !== null, // le captcha n'est admis que sur la page du formulaire
    appliquer: (d) => ajouter(d, FORMULAIRE, '<script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>'),
  },
  {
    nom: 'espace insecable avant la ponctuation',
    controles: ['typographie'],
    appliquer: (d) => ajouter(d, 'index.html', '<p>Bienvenue&nbsp;! Une question&nbsp;? Horaires&nbsp;: 8&nbsp;h. «&nbsp;Merci&nbsp;»</p><p>https://exemple.test/a?b=c 8:30</p>'),
  },
  {
    nom: 'nouvel onglet avec noopener',
    controles: ['liens-externes'],
    appliquer: (d) => ajouter(d, 'index.html', '<a href="https://partenaire.test/" target="_blank" rel="noopener noreferrer">notre partenaire</a>'),
  },
  {
    nom: 'image passee par Astro (WebP, dimensions)',
    controles: ['images-dimensions', 'images-format'],
    appliquer: (d) => {
      writeFileSync(join(d, 'photo.webp'), 'x');
      ajouter(d, 'index.html', '<img src="/photo.webp" alt="photo" width="1600" height="900" loading="lazy">');
    },
  },
  {
    nom: 'page supprimee avec sa redirection',
    controles: ['redirections'],
    pagesEnLigne: ['/', '/ancienne-page/'],
    appliquer: (d) => writeFileSync(join(d, '_redirects'), `/ancienne-page/ ${A} 301\n`),
  },
  {
    nom: 'coordonnees lues dans entreprise.json, couleur par variable',
    controles: ['ssot', 'couleurs'],
    appliquer: (d) => appendFileSync(source(d, 'pages/contact.astro'), '\n<p>{entreprise.telephoneAffiche}</p>\n<style>p { color: var(--texte); }</style>\n'),
  },
];

function copier() {
  const copie = mkdtempSync(join(tmpdir(), 'envers-'));
  cpSync(DIST, copie, { recursive: true });
  cpSync(SRC, join(copie, '__src'), { recursive: true });
  return copie;
}
const controlerCopie = (copie, pagesEnLigne = null) =>
  controler({ dossier: copie, urlProd: config.urlProd, mode: 'prod', sources: join(copie, '__src'), pagesEnLigne }).problemes
    // la copie des sources vit dans la copie du site : ses fichiers n'en font pas partie
    .filter((p) => !p.page.startsWith('/__src'));

const reference = controler({ dossier: DIST, urlProd: config.urlProd, mode: 'prod', sources: SRC, pagesEnLigne: ['/'] });
if (reference.problemes.length > 0) {
  console.log('Impossible de tester a l\'envers : le build de depart n\'est pas vert. Lancer "npm run check".');
  process.exit(1);
}

let rates = 0;
for (const sabotage of sabotages) {
  const copie = copier();
  try {
    sabotage.appliquer(copie);
    const problemes = controlerCopie(copie, sabotage.pagesEnLigne);
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

for (const cas of autorises) {
  if (cas.applicable === false) {
    console.log(`NON APPLICABLE - ${cas.nom} (aucune page avec <Formulaire />)`);
    continue;
  }
  const copie = copier();
  try {
    cas.appliquer(copie);
    const refuses = controlerCopie(copie, cas.pagesEnLigne).filter((p) => cas.controles.includes(p.controle));
    console.log(`${refuses.length === 0 ? 'AUTORISE   ' : 'REFUSE A TORT'} - ${cas.nom}${refuses.length ? ` : ${refuses.map((p) => `[${p.controle}] ${p.detail}`).join(' ; ')}` : ''}`);
    if (refuses.length) rates += 1;
  } catch (erreur) {
    console.log(`ERREUR      - ${cas.nom} : ${erreur.message}`);
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

// Publication du site de test (dev.yml) : seuls [indexation] et [robots] bloquent.
// Autorise : un lien casse ne doit PAS empecher le client de voir son site de test.
// Refuse : un site de test sans noindex doit TOUJOURS etre bloque.
const PUBLICATION = ['indexation', 'robots'];
function copieDeSiteDeTest() {
  const copie = mkdtempSync(join(tmpdir(), 'envers-'));
  cpSync(DIST, copie, { recursive: true });
  for (const f of readdirSync(copie, { recursive: true }).filter((f) => String(f).endsWith('.html'))) {
    modifier(copie, String(f), (h) => h.replace(/<meta name="robots"[^>]*>/g, '').replace('</head>', '<meta name="robots" content="noindex, nofollow"></head>'));
  }
  writeFileSync(join(copie, 'robots.txt'), 'User-agent: *\nDisallow: /\n');
  return copie;
}
const casPublication = [
  {
    nom: 'site de test avec un lien casse : publication autorisee',
    preparer: (d) => modifier(d, 'index.html', (h) => h.replace('</main>', '<a href="/page-inexistante/">x</a></main>')),
    conforme: (filtres, complets) => filtres.length === 0 && complets.some((p) => p.controle === 'liens'),
  },
  {
    nom: 'site de test sans noindex sur une page : publication refusee',
    preparer: (d) => modifier(d, AUTRE, (h) => h.replace(/<meta name="robots"[^>]*>/g, '')),
    conforme: (filtres) => filtres.some((p) => p.controle === 'indexation' && p.page === A),
  },
  {
    nom: 'site de test dont le robots.txt laisse indexer : publication refusee',
    preparer: (d) => writeFileSync(join(d, 'robots.txt'), 'User-agent: *\nAllow: /\n'),
    conforme: (filtres) => filtres.some((p) => p.controle === 'robots'),
  },
];
for (const cas of casPublication) {
  let copie;
  try {
    copie = copieDeSiteDeTest();
    cas.preparer(copie);
    const filtres = controler({ dossier: copie, urlProd: config.urlProd, mode: 'dev', seulement: PUBLICATION }).problemes;
    const complets = controler({ dossier: copie, urlProd: config.urlProd, mode: 'dev' }).problemes;
    const ok = cas.conforme(filtres, complets);
    console.log(`${ok ? 'CONFORME   ' : 'NON CONFORME'} - ${cas.nom}`);
    if (!ok) rates += 1;
  } catch (erreur) {
    console.log(`ERREUR      - ${cas.nom} : ${erreur.message}`);
    rates += 1;
  } finally {
    if (copie) rmSync(copie, { recursive: true, force: true });
  }
}

if (rates > 0) {
  console.log(`\nROUGE - ${rates} regression(s) non detectee(s) : les controles concernes ne protegent rien.`);
  process.exit(1);
}
console.log(`\nVERT - ${sabotages.length + 1} regressions injectees, toutes detectees ; ${autorises.filter((c) => c.applicable !== false).length} bonnes methodes autorisees ; ${casPublication.length} cas de publication du site de test conformes.`);
