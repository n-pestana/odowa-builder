// Vérification du site EN LIGNE, juste après un déploiement (lancé par prod.yml).
// On teste le vrai site, pas le build : version servie, pages, 404, indexation, formulaire.
//
// Variables : VERSION_ATTENDUE (sha du commit), CONTACT_JETON_TEST (secret du formulaire),
//             URL_A_VERIFIER (facultatif, par défaut urlProd de site.config.json).

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const RACINE = fileURLToPath(new URL('../../', import.meta.url));
const config = JSON.parse(readFileSync(join(RACINE, 'site.config.json'), 'utf8'));
const base = (process.env.URL_A_VERIFIER ?? config.urlProd).replace(/\/$/, '');
const versionAttendue = process.env.VERSION_ATTENDUE;
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const resultats = [];
const noter = (etat, quoi, detail = '') => {
  resultats.push({ etat, quoi });
  console.log(`${etat.padEnd(9)} ${quoi}${detail ? ` - ${detail}` : ''}`);
};
const lire = async (chemin, options) => {
  try {
    return await fetch(base + chemin, { redirect: 'follow', ...options });
  } catch (erreur) {
    return { ok: false, status: 0, text: async () => '', json: async () => ({}), erreur: erreur.message };
  }
};

// 1. La nouvelle version est-elle bien celle qui est servie ? (jusqu'à 3 minutes d'attente)
if (versionAttendue) {
  let servie = null;
  for (let essai = 0; essai < 18; essai += 1) {
    const page = await lire(`/?v=${Date.now()}`);
    servie = (await page.text()).match(/<meta name="version" content="([^"]*)"/)?.[1] ?? null;
    if (servie === versionAttendue) break;
    await pause(10_000);
  }
  if (servie === versionAttendue) noter('VERT', 'Version servie', versionAttendue.slice(0, 7));
  else noter('ROUGE', 'Version servie', `attendue ${versionAttendue.slice(0, 7)}, servie ${servie?.slice(0, 7) ?? 'inconnue'}`);
} else {
  noter('NON TESTE', 'Version servie', 'VERSION_ATTENDUE non fournie');
}

// 2. Toutes les pages du build répondent 200.
const lister = (dossier) =>
  readdirSync(dossier, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? lister(join(dossier, e.name)) : [join(dossier, e.name)]));
const dist = join(RACINE, 'dist');
const pages = existsSync(dist)
  ? lister(dist)
      .filter((f) => f.endsWith('.html') && !f.endsWith('404.html'))
      .map((f) => '/' + relative(dist, f).split(sep).join('/').replace(/index\.html$/, ''))
  : ['/'];
for (const page of [...pages, '/robots.txt', '/sitemap-index.xml']) {
  const reponse = await lire(page);
  if (reponse.status === 200) noter('VERT', `Page ${page}`);
  else noter('ROUGE', `Page ${page}`, `code ${reponse.status} ${reponse.erreur ?? ''}`);
}

// 3. Une adresse inconnue renvoie bien une erreur 404 (et pas la page d'accueil).
const inconnue = await lire(`/page-qui-n-existe-pas-${Date.now()}/`);
if (inconnue.status === 404) noter('VERT', 'Adresse inconnue', 'code 404');
else noter('ROUGE', 'Adresse inconnue', `code ${inconnue.status} (attendu : 404)`);

// 4. Le site en ligne est indexable.
const accueil = await (await lire('/')).text();
const robots = await (await lire('/robots.txt')).text();
if (/<meta name="robots"[^>]*noindex/i.test(accueil) || /^Disallow:\s*\/\s*$/m.test(robots)) {
  noter('ROUGE', 'Indexation', 'le site en ligne interdit son indexation (noindex ou robots.txt)');
} else {
  noter('VERT', 'Indexation');
}

// 5. Le formulaire de contact envoie réellement un mail (vers la boîte de test, jamais le client).
if (config.formulaireContact === false) {
  noter('NON TESTE', 'Formulaire de contact', 'désactivé dans site.config.json');
} else if (!process.env.CONTACT_JETON_TEST) {
  noter('ROUGE', 'Formulaire de contact', 'secret CONTACT_JETON_TEST absent : le formulaire n\'a pas pu être testé');
} else {
  const corps = new FormData();
  corps.set('nom', 'Test automatique');
  corps.set('email', 'test-automatique@example.com');
  corps.set('message', `Test automatique après déploiement (${versionAttendue?.slice(0, 7) ?? 'sans version'}).`);
  const envoi = await lire('/api/contact', {
    method: 'POST',
    body: corps,
    headers: { 'x-test-contact': process.env.CONTACT_JETON_TEST, Accept: 'application/json' },
  });
  const reponse = await envoi.json().catch(() => ({}));
  if (envoi.status === 200 && reponse.ok === true && reponse.mode === 'test') {
    noter('VERT', 'Formulaire de contact', 'mail de test accepté par le fournisseur');
  } else {
    noter('ROUGE', 'Formulaire de contact', `code ${envoi.status}, réponse ${JSON.stringify(reponse)}`);
  }
}

const rouges = resultats.filter((r) => r.etat === 'ROUGE').length;
const nonTestes = resultats.filter((r) => r.etat === 'NON TESTE').length;
console.log(`\n${rouges === 0 ? 'VERT' : 'ROUGE'} - ${base} : ${resultats.length - rouges - nonTestes} vert(s), ${rouges} rouge(s), ${nonTestes} non testé(s).`);
process.exit(rouges === 0 ? 0 : 1);
