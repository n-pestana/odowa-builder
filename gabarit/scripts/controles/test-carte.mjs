// Teste la carte d'etat (scripts/outils/carte.mjs) dans les deux sens :
// chaque situation donne la bonne couleur, et aucune situation douteuse ne donne 🟢.
// Lance par npm run check:hook.

import { carte } from '../outils/carte.mjs';

const BASE = {
  joignable: true, surProd: false, enCoursLocal: 0, publicationTest: 'vert', controlesTest: 'vert',
  differences: 0, deploiementProd: 'vert', dateProd: '23 novembre 2026 à 18:42', urlDev: 'https://dev.x', urlProd: 'https://x',
};
const ligne = (d, site) => carte({ ...BASE, ...d }).split('\n').find((l) => l.includes(`**${site}**`)) ?? '';

const cas = [
  // [nom, situation, site, couleur attendue]
  ['tout est publie et verifie', {}, 'Site en ligne', '🟢'],
  ['site de test identique au site en ligne', {}, 'Site de test', '🟢'],
  ['modifications pretes a publier', { differences: 3 }, 'Site de test', '🟡'],
  ['modifications pas encore envoyees', { enCoursLocal: 2 }, 'Site de test', '🟡'],
  ['publication du site de test en cours', { publicationTest: 'en-cours' }, 'Site de test', '⏳'],
  ['controles en cours', { controlesTest: 'en-cours', differences: 3 }, 'Site de test', '⏳'],
  ['controles pas encore lances', { controlesTest: 'absent' }, 'Site de test', '⏳'],
  ['controle rouge', { controlesTest: 'rouge', differences: 3 }, 'Site de test', '🔴'],
  ['publication du site de test echouee', { publicationTest: 'rouge' }, 'Site de test', '🔴'],
  ['session sur la branche du site en ligne', { surProd: true }, 'Site de test', '🔴'],
  ['publication en ligne en cours', { deploiementProd: 'en-cours' }, 'Site en ligne', '⏳'],
  ['publication en ligne echouee', { deploiementProd: 'rouge' }, 'Site en ligne', '🔴'],
  // les cas douteux ne sont jamais verts
  ['GitHub injoignable : site en ligne', { joignable: false }, 'Site en ligne', '⚪'],
  ['GitHub injoignable : site de test', { joignable: false }, 'Site de test', '⚪'],
  ['etat du deploiement inconnu', { deploiementProd: 'inconnu' }, 'Site en ligne', '⚪'],
  ['etat des controles inconnu', { controlesTest: 'inconnu' }, 'Site de test', '⚪'],
  ['differences inconnues', { differences: null }, 'Site de test', '⚪'],
];

let rates = 0;
for (const [nom, situation, site, attendu] of cas) {
  const l = ligne(situation, site);
  const ok = l.startsWith(attendu);
  if (!ok) rates += 1;
  console.log(`${ok ? 'OK    ' : 'ECHEC '} ${attendu} ${site.padEnd(13)} - ${nom}${ok ? '' : `  -> obtenu : ${l || '(aucune ligne)'}`}`);
}
for (const [nom, situation, site, attendu] of cas) {
  if (attendu !== '🟢' && ligne(situation, site).includes('🟢')) {
    rates += 1;
    console.log(`ECHEC  🟢 affiche alors que la situation est « ${nom} »`);
  }
}

if (rates > 0) {
  console.log(`\nROUGE - ${rates} cas de la carte d'etat non conformes.`);
  process.exit(1);
}
console.log(`\nVERT - carte d'etat : ${cas.length} situations, couleurs conformes, jamais 🟢 sur un etat douteux.`);
