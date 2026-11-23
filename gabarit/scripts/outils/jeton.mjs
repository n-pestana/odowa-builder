// Enregistre l'autorisation du client pour une action sur le site en ligne.
// Appele UNIQUEMENT par les commandes /mise-en-prod et /retour-en-arriere au moment
// ou le client les tape. Claude ne doit jamais lancer ce script lui-meme
// (le garde-fou .claude/hooks/garde.mjs le refuse).

import { creerJeton, heureFr } from './lib.mjs';

const [, , ordre, action] = process.argv;
const ACTIONS = ['mise-en-prod', 'retour-en-arriere'];

if (ordre !== 'creer' || !ACTIONS.includes(action)) {
  console.log(`Usage : node scripts/outils/jeton.mjs creer <${ACTIONS.join('|')}>`);
  process.exit(1);
}

creerJeton(action);
console.log(`Autorisation du client enregistree a ${heureFr()} pour "${action}" (valable 20 minutes).`);
