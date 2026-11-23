// Carte d'etat montree au client a la fin de chaque reponse (voir CLAUDE.md, « La carte d'état »).
// Fonction pure : la couleur est decidee ici, a partir de faits mesures, jamais par Claude.
// Testee dans les deux sens par scripts/controles/test-carte.mjs.
//
// Regle des couleurs :
//   🟢 verifie et en ordre    🟡 attend le client    ⏳ en cours    🔴 bloque    ⚪ non verifie
// Une donnee inconnue ou absente donne ⚪, jamais 🟢.

const s = (n, mot) => `${n} ${mot}${n > 1 ? 's' : ''}`;

/**
 * @param {object} d
 * @param {boolean} d.joignable          GitHub a repondu
 * @param {boolean} d.surProd            la session travaille sur la branche du site en ligne
 * @param {number}  d.enCoursLocal       fichiers non enregistres + enregistrements et pas encore envoyees sur le site de test
 * @param {string}  d.publicationTest    vert | rouge | en-cours | absent | inconnu
 * @param {string}  d.controlesTest      vert | rouge | en-cours | absent | inconnu
 * @param {number|null} d.differences    nombre de fichiers differents entre site de test et site en ligne (null = inconnu)
 * @param {string}  d.deploiementProd    vert | rouge | en-cours | absent | inconnu
 * @param {string|null} d.dateProd       date lisible de la derniere mise en ligne
 * @param {string}  d.urlDev
 * @param {string}  d.urlProd
 */
export function carte(d) {
  const lignes = [];

  // --- Site en ligne ---
  const lienProd = `→ [ouvrir le site](${d.urlProd})`;
  if (!d.joignable) lignes.push(`⚪ **Site en ligne** · état non vérifié (connexion impossible pour le moment) ${lienProd}`);
  else if (d.deploiementProd === 'vert') lignes.push(`🟢 **Site en ligne** · à jour et vérifié${d.dateProd ? `, publié le ${d.dateProd}` : ''} ${lienProd}`);
  else if (d.deploiementProd === 'en-cours') lignes.push(`⏳ **Site en ligne** · publication en cours ${lienProd}`);
  else if (d.deploiementProd === 'rouge') lignes.push(`🔴 **Site en ligne** · la dernière publication a un problème ${lienProd}`);
  else lignes.push(`⚪ **Site en ligne** · état non vérifié ${lienProd}`);

  // --- Site de test ---
  const lienTest = `→ [voir le site de test](${d.urlDev})`;
  if (d.surProd) {
    lignes.push('🔴 **Site de test** · la session est mal placée : rien ne doit être modifié, Nicolas doit être prévenu');
  } else if (d.enCoursLocal > 0) {
    lignes.push('🟡 **Site de test** · des modifications sont prêtes ici, pas encore envoyées sur le site de test');
  } else if (!d.joignable) {
    lignes.push(`⚪ **Site de test** · état non vérifié ${lienTest}`);
  } else if (d.publicationTest === 'en-cours' || d.publicationTest === 'absent' || d.controlesTest === 'en-cours' || d.controlesTest === 'absent') {
    lignes.push(`⏳ **Site de test** · mise à jour et contrôles en cours ${lienTest}`);
  } else if (d.publicationTest === 'rouge') {
    lignes.push(`🔴 **Site de test** · la dernière mise à jour du site de test a échoué ${lienTest}`);
  } else if (d.controlesTest === 'rouge') {
    lignes.push(`🔴 **Site de test** · un contrôle automatique bloque la publication ${lienTest}`);
  } else if (d.publicationTest !== 'vert' || d.controlesTest !== 'vert' || d.differences === null) {
    lignes.push(`⚪ **Site de test** · état non vérifié ${lienTest}`);
  } else if (d.differences === 0) {
    lignes.push(`🟢 **Site de test** · identique au site en ligne, rien en attente ${lienTest}`);
  } else {
    lignes.push(`🟡 **Site de test** · contrôles verts, ${s(d.differences, 'fichier')} ${d.differences > 1 ? 'modifiés attendent' : 'modifié attend'} votre publication ${lienTest}`);
  }

  return lignes.join('\n');
}
