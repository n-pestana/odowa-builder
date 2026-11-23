// /annuler-modifs : remet le site de TEST dans l'etat du site en ligne.
// Rien n'est efface de l'historique : Nicolas peut retrouver ce qui a ete annule.
//   node scripts/outils/annuler-modifs.mjs              (montre ce qui serait annule)
//   node scripts/outils/annuler-modifs.mjs --confirmer  (le fait)

import { DEV, PROD, actualiser, arbre, arreter, commit, config, court, dateFr, git } from './lib.mjs';

actualiser();
const dev = commit(`origin/${DEV}`);
const prod = commit(`origin/${PROD}`);
const local = git('status', '--porcelain').split('\n').filter(Boolean);
const nonEnvoyes = Number(git('rev-list', '--count', `origin/${DEV}..HEAD`));
const fichiers = git('diff', '--name-status', prod, dev).split('\n').filter(Boolean);

if (fichiers.length === 0 && local.length === 0 && nonEnvoyes === 0) {
  arreter('Rien a annuler : le site de test est deja identique au site en ligne.', 0);
}

if (!process.argv.includes('--confirmer')) {
  console.log('Voici ce qui serait annule (rien n\'est fait pour l\'instant) :');
  console.log(`  ${local.length} fichier(s) modifie(s) pas encore enregistre(s)`);
  console.log(`  ${nonEnvoyes} modification(s) enregistree(s) pas encore envoyee(s)`);
  console.log(`  ${fichiers.length} fichier(s) different(s) entre le site de test et le site en ligne :`);
  for (const f of fichiers.slice(0, 30)) console.log(`    ${f}`);
  console.log('Demander au client de confirmer, puis relancer avec --confirmer.');
  process.exit(0);
}

if (git('rev-parse', '--abbrev-ref', 'HEAD') === PROD) arreter(`REFUSE : la branche courante est "${PROD}".`);

if (arbre(dev) !== arbre(prod)) {
  const nouveau = git('commit-tree', arbre(prod), '-p', dev, '-m', `Annulation des modifications non mises en prod (${dateFr()})\n\nEtat annule : ${DEV}@${court(dev)}`);
  git('push', '--quiet', 'origin', `${nouveau}:refs/heads/${DEV}`);
  actualiser();
}
git('reset', '--quiet', '--hard', `origin/${DEV}`);
git('clean', '--quiet', '-fd');

console.log('Fait : le site de test repart de l\'etat du site en ligne. Le site en ligne n\'a pas ete touche.');
console.log(`Il sera a jour dans environ 2 minutes : ${config.urlDev}`);
console.log(`(Pour Nicolas : l'etat annule reste recuperable, ${DEV}@${court(dev)}.)`);
