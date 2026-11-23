// /apercu : enregistre les modifications et les envoie sur le site de TEST.
// Ne touche jamais le site en ligne.
//   node scripts/outils/apercu.mjs --message "Ce qui a change, en une phrase"
//   node scripts/outils/apercu.mjs suivre      (attend la fin de la publication)

import {
  DEV,
  EN_COURS,
  PROD,
  actualiser,
  arreter,
  commit,
  config,
  controlesDuCommit,
  git,
  gitEssai,
  passageDuWorkflow,
  sonder,
} from './lib.mjs';

const args = process.argv.slice(2);

if (args[0] === 'suivre') {
  actualiser();
  const sha = commit(`origin/${DEV}`);
  const publication = await sonder(() => passageDuWorkflow('dev.yml', sha));
  if (publication.etat === 'en-cours' || publication.etat === 'absent') {
    arreter('PAS ENCORE FINI : la publication sur le site de test est en cours. Relancer cette commande dans une minute.', EN_COURS);
  }
  const controles = controlesDuCommit(sha);
  if (publication.etat === 'rouge') {
    console.log(`Publication et controles : au moins une etape a echoue. Detail : ${publication.lien}`);
    console.log(`Controles automatiques : ${controles.etat === 'vert' ? 'VERT' : 'ROUGE ou incomplets'}`);
    console.log(`Le site de test peut quand meme etre a jour : ${config.urlDev}`);
    process.exit(1);
  }
  console.log(`Le site de test est a jour : ${config.urlDev}`);
  console.log(`Controles automatiques : ${controles.etat === 'vert' ? 'VERT' : controles.etat}`);
  process.exit(0);
}

const iMessage = args.indexOf('--message');
const message = iMessage >= 0 ? args[iMessage + 1] : null;

const branche = git('rev-parse', '--abbrev-ref', 'HEAD');
if (branche === PROD) {
  arreter(`REFUSE : la branche courante est "${PROD}". On ne travaille jamais dessus. Revenir sur "${DEV}" (git switch ${DEV}).`);
}

git('add', '--all');
const aEnregistrer = gitEssai('diff', '--cached', '--quiet') === null;
if (aEnregistrer) {
  if (!message) arreter('Il manque --message "..." : une phrase qui dit ce qui a change.');
  git('commit', '--quiet', '-m', message);
}

actualiser();
if (gitEssai('merge-base', '--is-ancestor', `origin/${DEV}`, 'HEAD') === null) {
  // Quelqu'un d'autre (souvent Nicolas) a modifie le site de test entre-temps.
  if (gitEssai('rebase', `origin/${DEV}`) === null) {
    gitEssai('rebase', '--abort');
    arreter(
      'BLOQUE : le site de test a ete modifie par ailleurs et les deux versions ne se melangent pas toutes seules.\n' +
        'Rien n\'a ete envoye, rien n\'est perdu. Lancer /alerter-nicolas.',
    );
  }
}

if (commit('HEAD') === commit(`origin/${DEV}`)) {
  arreter(`Rien de nouveau a envoyer. Le site de test est deja a jour : ${config.urlDev}`, 0);
}

git('push', '--quiet', 'origin', `HEAD:refs/heads/${DEV}`);
console.log('Modifications envoyees sur le site de TEST (le site en ligne n\'est pas touche).');
console.log(`Il sera a jour dans environ 2 minutes : ${config.urlDev}`);
console.log('ETAPE SUIVANTE : node scripts/outils/apercu.mjs suivre');
