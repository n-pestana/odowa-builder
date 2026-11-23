// Actions sur le SITE EN LIGNE : /mise-en-prod et /retour-en-arriere.
//
//   node scripts/outils/prod.mjs preparer-mise-en-prod
//   node scripts/outils/prod.mjs preparer-retour
//   node scripts/outils/prod.mjs attendre <numero>
//   node scripts/outils/prod.mjs fusionner <numero>
//   node scripts/outils/prod.mjs suivre
//
// Principe : "main" n'est jamais melangee avec "dev". Chaque mise en prod est UN commit
// sur main dont le contenu est la copie exacte de dev. Un retour en arriere est UN commit
// dont le contenu est la copie exacte de l'etat precedent. Consequence : apres un retour
// en arriere, la mise en prod suivante remet bien tout le contenu de dev (pas de piege
// "revert d'un merge").

import {
  DEV,
  EN_COURS,
  PROD,
  actualiser,
  arbre,
  arreter,
  commit,
  config,
  consommerJeton,
  controlesDuCommit,
  court,
  dateFr,
  exigerJeton,
  git,
  gitEssai,
  github,
  heureFr,
  horodatage,
  lienSession,
  passageDuWorkflow,
  sonder,
} from './lib.mjs';
import { creerAlerte } from './alerter.mjs';

const [, , ordre, argument] = process.argv;
const PREFIXES = { 'prod/': 'mise-en-prod', 'retour/': 'retour-en-arriere' };
const actionDeLaBranche = (ref) => Object.entries(PREFIXES).find(([prefixe]) => ref.startsWith(prefixe))?.[1];

function listeFichiers(avant, apres) {
  return git('diff', '--name-status', avant, apres)
    .split('\n')
    .filter(Boolean)
    .map((l) => l.replace(/^A\t/, 'ajoute   ').replace(/^M\t/, 'modifie  ').replace(/^D\t/, 'supprime '));
}

function fermerDemandesOuvertes() {
  const ouvertes = github(`repos/{depot}/pulls?state=open&base=${PROD}&per_page=50`);
  for (const demande of ouvertes.filter((d) => actionDeLaBranche(d.head.ref))) {
    github(`repos/{depot}/pulls/${demande.number}`, { methode: 'PATCH', corps: { state: 'closed' } });
  }
}

function ouvrirDemande({ prefixe, titre, message, arbreCible, description }) {
  const nouveau = git('commit-tree', arbreCible, '-p', `origin/${PROD}`, '-m', message);
  const branche = `${prefixe}${horodatage()}-${court(nouveau)}`;
  git('push', '--quiet', 'origin', `${nouveau}:refs/heads/${branche}`);
  const session = lienSession();
  return github('repos/{depot}/pulls', {
    methode: 'POST',
    corps: {
      title: titre,
      head: branche,
      base: PROD,
      body: `${description}\n\n${session ? `Session Claude : ${session}` : ''}`,
    },
  });
}

function lireDemande(numero) {
  if (!/^\d+$/.test(numero ?? '')) arreter('Il manque le numero de la demande (ex. : attendre 12).');
  const demande = github(`repos/{depot}/pulls/${numero}`);
  const action = actionDeLaBranche(demande.head.ref);
  if (demande.base.ref !== PROD || !action) arreter(`REFUSE : la demande #${numero} n'est pas une mise en prod de ce gabarit.`);
  return { demande, action };
}

// ---------------------------------------------------------------------------------
if (ordre === 'preparer-mise-en-prod') {
  exigerJeton('mise-en-prod');
  if (git('status', '--porcelain') !== '') {
    arreter('REFUSE : il reste des modifications pas encore envoyees sur le site de test. Lancer /apercu d\'abord, verifier, puis relancer /mise-en-prod.');
  }
  actualiser();
  if (Number(git('rev-list', '--count', `origin/${DEV}..HEAD`)) > 0) {
    arreter('REFUSE : des modifications enregistrees ne sont pas encore sur le site de test. Lancer /apercu d\'abord.');
  }
  const dev = commit(`origin/${DEV}`);
  if (arbre(dev) === arbre(`origin/${PROD}`)) {
    arreter('Rien a mettre en prod : le site en ligne est deja identique au site de test.', 0);
  }
  const controles = controlesDuCommit(dev);
  if (controles.etat === 'en-cours') {
    arreter('PAS ENCORE : les controles automatiques du site de test tournent encore. Relancer cette commande dans une minute.', EN_COURS);
  }
  if (controles.etat !== 'vert') {
    arreter(
      `REFUSE : les controles automatiques du site de test ne sont pas verts (${controles.etat}).\n` +
        `${controles.lien ? `Detail : ${controles.lien}\n` : ''}` +
        'Rien n\'a ete mis en prod. Corriger puis relancer /apercu, ou lancer /alerter-nicolas. Il n\'existe pas de moyen de forcer.',
    );
  }
  const fichiers = listeFichiers(`origin/${PROD}`, dev);
  fermerDemandesOuvertes();
  const demande = ouvrirDemande({
    prefixe: 'prod/',
    titre: `Mise en prod du ${dateFr()}`,
    message: `Mise en prod du ${dateFr()}\n\nContenu identique a ${DEV}@${court(dev)}`,
    arbreCible: arbre(dev),
    description: `Copie exacte du site de test (${DEV}@${court(dev)}).\n\nFichiers concernes :\n${fichiers.map((f) => `- ${f}`).join('\n')}`,
  });
  console.log(`Demande de mise en prod #${demande.number} creee. RIEN n'est encore en ligne.`);
  console.log(`Ce qui partira en ligne (${fichiers.length} fichier(s)) :`);
  for (const f of fichiers) console.log(`  ${f}`);
  console.log(`ETAPE SUIVANTE : node scripts/outils/prod.mjs attendre ${demande.number}`);
}

// ---------------------------------------------------------------------------------
else if (ordre === 'preparer-retour') {
  exigerJeton('retour-en-arriere');
  actualiser();
  const tete = commit(`origin/${PROD}`);
  const sujet = git('log', '-1', '--format=%s', tete);
  if (sujet.startsWith('Retour en arriere')) {
    arreter('REFUSE : la derniere action sur le site en ligne est deja un retour en arriere. On ne remonte que d\'un cran. Pour aller plus loin : /alerter-nicolas.');
  }
  let precedent = gitEssai('rev-parse', '--verify', '--quiet', `${tete}~1`);
  if (!precedent) {
    gitEssai('fetch', '--quiet', '--deepen=20', 'origin', PROD);
    precedent = gitEssai('rev-parse', '--verify', '--quiet', `${tete}~1`);
  }
  if (!precedent) arreter('REFUSE : il n\'y a pas de version precedente du site en ligne. Lancer /alerter-nicolas.');
  const sujetPrecedent = git('log', '-1', '--format=%s', precedent);
  const datePrecedent = dateFr(git('log', '-1', '--format=%cI', precedent));
  fermerDemandesOuvertes();
  const demande = ouvrirDemande({
    prefixe: 'retour/',
    titre: `Retour en arriere du ${dateFr()}`,
    message: `Retour en arriere du ${dateFr()}\n\nAnnule : ${sujet}\nRevient a : ${sujetPrecedent}`,
    arbreCible: arbre(precedent),
    description: `Annule « ${sujet} ».\nLe site en ligne revient a l'etat « ${sujetPrecedent} » (${datePrecedent}).\nLe site de test n'est pas modifie.`,
  });
  console.log(`Demande de retour en arriere #${demande.number} creee. RIEN n'a encore change en ligne.`);
  console.log(`Ce qui sera annule : « ${sujet} »`);
  console.log(`Le site en ligne reviendra a : « ${sujetPrecedent} » (${datePrecedent})`);
  console.log('Le site de test garde les modifications : elles pourront etre corrigees puis remises en prod.');
  console.log(`ETAPE SUIVANTE : node scripts/outils/prod.mjs attendre ${demande.number}`);
}

// ---------------------------------------------------------------------------------
else if (ordre === 'attendre') {
  const { demande } = lireDemande(argument);
  if (demande.state !== 'open') arreter(`La demande #${argument} n'est plus ouverte (deja fusionnee ou fermee).`);
  const controles = await sonder(() => controlesDuCommit(demande.head.sha));
  if (controles.etat === 'vert') {
    console.log(`Controles automatiques de la demande #${argument} : VERT.`);
    console.log(`ETAPE SUIVANTE (apres le "oui" du client) : node scripts/outils/prod.mjs fusionner ${argument}`);
  } else if (controles.etat === 'rouge') {
    arreter(`Controles automatiques de la demande #${argument} : ROUGE. Detail : ${controles.lien}\nRien n'a ete mis en ligne. Il n'existe pas de moyen de forcer.`);
  } else {
    arreter(`PAS ENCORE FINI : les controles de la demande #${argument} tournent (${controles.etat}). Relancer cette commande dans une minute.`, EN_COURS);
  }
}

// ---------------------------------------------------------------------------------
else if (ordre === 'fusionner') {
  const { demande, action } = lireDemande(argument);
  exigerJeton(action);
  if (demande.state !== 'open') arreter(`La demande #${argument} n'est plus ouverte.`);
  const controles = controlesDuCommit(demande.head.sha);
  if (controles.etat !== 'vert') arreter(`REFUSE : les controles de la demande #${argument} ne sont pas verts (${controles.etat}).`);
  try {
    github(`repos/{depot}/pulls/${argument}/merge`, {
      methode: 'PUT',
      corps: { merge_method: 'squash', sha: demande.head.sha, commit_title: demande.title },
    });
  } catch (erreur) {
    arreter(
      `BLOQUE : GitHub a refuse la fusion de la demande #${argument}.\n` +
        'Cause la plus frequente : la modification touche des fichiers reserves a Nicolas, qui doit donner son accord.\n' +
        `Rien n'a ete mis en ligne. Lancer /alerter-nicolas en citant la demande #${argument}.\n${erreur.message}`,
    );
  }
  consommerJeton();
  if (action === 'retour-en-arriere') {
    try {
      creerAlerte({ urgence: 'info', titre: `[${config.nomSite}] Retour en arriere utilise`, message: `Le client a lance /retour-en-arriere (demande #${argument}). ${demande.body ?? ''}` });
    } catch {
      console.log('(Nicolas n\'a pas pu etre prevenu automatiquement du retour en arriere.)');
    }
  }
  console.log(`Demande #${argument} acceptee a ${heureFr()}. Le site en ligne se met a jour (environ 3 minutes).`);
  console.log('ETAPE SUIVANTE : node scripts/outils/prod.mjs suivre');
}

// ---------------------------------------------------------------------------------
else if (ordre === 'suivre') {
  actualiser();
  const tete = commit(`origin/${PROD}`);
  const deploiement = await sonder(() => passageDuWorkflow('prod.yml', tete));
  if (deploiement.etat === 'vert') {
    console.log(`Le site en ligne est a jour et verifie a ${heureFr(deploiement.date)} : ${config.urlProd}`);
  } else if (deploiement.etat === 'rouge') {
    arreter(
      `ECHEC du deploiement ou de la verification du site en ligne. Detail : ${deploiement.lien}\n` +
        'Nicolas a ete alerte automatiquement. Dire au client d\'ouvrir le site en ligne : s\'il est casse, proposer /retour-en-arriere.',
    );
  } else {
    arreter('PAS ENCORE FINI : le deploiement est en cours. Relancer cette commande dans une minute.', EN_COURS);
  }
}

// ---------------------------------------------------------------------------------
else {
  arreter('Ordres possibles : preparer-mise-en-prod | preparer-retour | attendre <n> | fusionner <n> | suivre');
}
