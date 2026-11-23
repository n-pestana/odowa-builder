// /etat : ou en est le site ? Lecture seule, ne modifie rien.

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  DEV,
  PROD,
  RACINE,
  arbre,
  config,
  controlesDuCommit,
  dateFr,
  git,
  gitEssai,
  githubEssai,
  passageDuWorkflow,
} from './lib.mjs';

const LIBELLES = { vert: 'VERT', rouge: 'ROUGE', 'en-cours': 'en cours', absent: 'pas encore lance' };
const essai = (fonction) => {
  try {
    return fonction();
  } catch {
    return { etat: 'inconnu' };
  }
};
const libelle = (r) => LIBELLES[r.etat] ?? 'inconnu (GitHub injoignable)';

export function collecterEtat() {
  const lignes = [];
  const joignable = gitEssai('fetch', '--quiet', '--prune', 'origin') !== null;
  const branche = gitEssai('rev-parse', '--abbrev-ref', 'HEAD') ?? '?';
  const nonEnregistres = (gitEssai('status', '--porcelain') ?? '').split('\n').filter(Boolean);
  const devDistant = gitEssai('rev-parse', `origin/${DEV}`);
  const prodDistant = gitEssai('rev-parse', `origin/${PROD}`);

  lignes.push(`ETAT DU SITE - ${config.nomSite}`);
  if (!joignable) lignes.push('ATTENTION : GitHub est injoignable, les informations ci-dessous peuvent dater.');
  lignes.push('');
  lignes.push('TRAVAIL EN COURS');
  lignes.push(`  Branche de travail : ${branche}${branche === PROD ? '  <-- ANORMAL, on ne travaille jamais ici' : ''}`);
  lignes.push(`  Modifications pas encore enregistrees : ${nonEnregistres.length} fichier(s)`);
  if (devDistant) {
    const nonEnvoyes = Number(gitEssai('rev-list', '--count', `origin/${DEV}..HEAD`) ?? 0);
    lignes.push(`  Modifications enregistrees mais pas encore envoyees sur le site de test : ${nonEnvoyes}`);
  }

  lignes.push('');
  lignes.push(`SITE DE TEST : ${config.urlDev}`);
  if (devDistant) {
    lignes.push(`  Derniere modification : ${dateFr(git('log', '-1', '--format=%cI', devDistant))} - ${git('log', '-1', '--format=%s', devDistant)}`);
    lignes.push(`  Publication sur le site de test : ${libelle(essai(() => passageDuWorkflow('dev.yml', devDistant)))}`);
    lignes.push(`  Controles automatiques : ${libelle(essai(() => controlesDuCommit(devDistant)))}`);
  }

  lignes.push('');
  lignes.push(`SITE EN LIGNE : ${config.urlProd}`);
  if (prodDistant) {
    lignes.push(`  Derniere mise en prod : ${dateFr(git('log', '-1', '--format=%cI', prodDistant))} - ${git('log', '-1', '--format=%s', prodDistant)}`);
    lignes.push(`  Deploiement et verification : ${libelle(essai(() => passageDuWorkflow('prod.yml', prodDistant)))}`);
  }

  lignes.push('');
  if (devDistant && prodDistant) {
    if (arbre(devDistant) === arbre(prodDistant)) {
      lignes.push('EN ATTENTE DE MISE EN PROD : rien. Le site de test et le site en ligne sont identiques.');
    } else {
      const fichiers = git('diff', '--name-status', prodDistant, devDistant).split('\n').filter(Boolean);
      lignes.push(`EN ATTENTE DE MISE EN PROD : ${fichiers.length} fichier(s) different(s) entre le site de test et le site en ligne`);
      for (const f of fichiers.slice(0, 30)) lignes.push(`  ${f.replace(/^A\t/, 'ajoute   ').replace(/^M\t/, 'modifie  ').replace(/^D\t/, 'supprime ')}`);
      if (fichiers.length > 30) lignes.push(`  ... et ${fichiers.length - 30} autre(s)`);
    }
  }

  const alertes = githubEssai('repos/{depot}/issues?state=open&labels=alerte&per_page=20');
  if (Array.isArray(alertes)) {
    lignes.push('');
    lignes.push(`ALERTES OUVERTES AUPRES DE NICOLAS : ${alertes.length}`);
    for (const a of alertes) lignes.push(`  #${a.number} ${a.title}`);
  }

  const rapport = join(RACINE, '.rapports', 'controles.json');
  if (existsSync(rapport)) {
    const r = JSON.parse(readFileSync(rapport, 'utf8'));
    lignes.push('');
    lignes.push(`DERNIER CONTROLE LANCE ICI : ${r.vert ? 'VERT' : `ROUGE (${r.problemes.length} probleme(s))`} le ${dateFr(r.date)}`);
    for (const p of r.problemes.slice(0, 10)) lignes.push(`  [${p.controle}] ${p.page} - ${p.detail}`);
  }

  return lignes.join('\n');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) console.log(collecterEtat());
