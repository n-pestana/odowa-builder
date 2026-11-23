// Applique le gabarit dans le dossier du site d'un client, sans toucher à ce qui lui appartient.
//   node outils/appliquer-gabarit.mjs DOSSIER-DU-SITE VERSION
//
// Appartient au client, jamais modifié : src/, public/, .github/CODEOWNERS,
// et les valeurs de site.config.json (seules les clés nouvelles y sont ajoutées).
// Tout le reste est aligné sur le gabarit : fichiers remplacés, fichiers obsolètes supprimés.

import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const GABARIT = fileURLToPath(new URL('../gabarit/', import.meta.url));
const [, , site, version = 'inconnue'] = process.argv;
if (!site || !existsSync(join(site, 'site.config.json'))) {
  console.log('Usage : node outils/appliquer-gabarit.mjs DOSSIER-DU-SITE VERSION (le dossier doit contenir site.config.json)');
  process.exit(1);
}

const DU_CLIENT = ['src', 'public', 'site.config.json', '.github/CODEOWNERS', '.gabarit-version'];
const IGNORES = ['.git', 'node_modules', 'dist', '.astro', '.wrangler', '.rapports', 'test-results'];
const protege = (rel, liste) => liste.some((p) => rel === p || rel.startsWith(p + '/'));

function lister(racine, rel = '') {
  return readdirSync(join(racine, rel), { withFileTypes: true }).flatMap((entree) => {
    const chemin = rel ? `${rel}/${entree.name}` : entree.name;
    if (protege(chemin, IGNORES) || protege(chemin, DU_CLIENT)) return [];
    return entree.isDirectory() ? lister(racine, chemin) : [chemin];
  });
}

const duGabarit = new Set(lister(GABARIT));
const duSite = lister(site);

let supprimes = 0;
for (const rel of duSite.filter((f) => !duGabarit.has(f))) {
  rmSync(join(site, rel));
  supprimes += 1;
  // Retire les dossiers devenus vides.
  for (let dossier = dirname(rel); dossier !== '.'; dossier = dirname(dossier)) {
    if (readdirSync(join(site, dossier)).length > 0) break;
    rmdirSync(join(site, dossier));
  }
}

let remplaces = 0;
for (const rel of duGabarit) {
  const source = join(GABARIT, rel);
  const cible = join(site, rel);
  const identique = existsSync(cible) && readFileSync(source).equals(readFileSync(cible)) && statSync(source).mode === statSync(cible).mode;
  if (identique) continue;
  mkdirSync(dirname(cible), { recursive: true });
  copyFileSync(source, cible);
  remplaces += 1;
}

const modele = JSON.parse(readFileSync(join(GABARIT, 'site.config.json'), 'utf8'));
const actuel = JSON.parse(readFileSync(join(site, 'site.config.json'), 'utf8'));
const ajoutees = Object.keys(modele).filter((cle) => !(cle in actuel));
for (const cle of ajoutees) actuel[cle] = modele[cle];
if (ajoutees.length > 0) writeFileSync(join(site, 'site.config.json'), JSON.stringify(actuel, null, 2) + '\n');

writeFileSync(join(site, '.gabarit-version'), version + '\n');

console.log(`   gabarit ${version} : ${remplaces} fichier(s) remplacé(s) ou ajouté(s), ${supprimes} supprimé(s)`);
if (ajoutees.length > 0) console.log(`   site.config.json : clé(s) ajoutée(s) avec la valeur par défaut : ${ajoutees.join(', ')}`);
