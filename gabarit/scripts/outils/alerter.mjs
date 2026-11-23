// /alerter-nicolas : cree un ticket GitHub, Nicolas recoit un mail et une notification.
//   node scripts/outils/alerter.mjs --urgence <prod-cassee|bloque|question> --message "..."

import { fileURLToPath } from 'node:url';
import { config, github, lienSession } from './lib.mjs';
import { collecterEtat } from './etat.mjs';

const URGENCES = {
  'prod-cassee': 'URGENT - le site en ligne a un probleme',
  bloque: 'Client bloque',
  question: 'Question',
  info: 'Information',
};

export function creerAlerte({ urgence, message, titre }) {
  let etat = '(etat indisponible)';
  try {
    etat = collecterEtat();
  } catch {
    /* on alerte quand meme */
  }
  const session = lienSession();
  const corps = [
    `@${config.contactNicolas}`,
    '',
    '## Message',
    message,
    '',
    session ? `Session Claude du client : ${session}` : 'Session Claude : locale (pas de lien)',
    '',
    '## Etat du site au moment de l\'alerte',
    '```',
    etat,
    '```',
  ].join('\n');
  const demande = {
    title: titre ?? `[${config.nomSite}] ${URGENCES[urgence]} : ${message.slice(0, 70)}`,
    body: corps,
    labels: ['alerte', urgence],
    assignees: [config.contactNicolas],
  };
  try {
    return github('repos/{depot}/issues', { methode: 'POST', corps: demande });
  } catch {
    // Etiquette ou destinataire refuse : le ticket seul suffit, la mention @ notifie.
    return github('repos/{depot}/issues', { methode: 'POST', corps: { title: demande.title, body: corps } });
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const lire = (nom) => (args.includes(nom) ? args[args.indexOf(nom) + 1] : null);
  const urgence = lire('--urgence') ?? 'question';
  const message = lire('--message');
  if (!message || !URGENCES[urgence] || urgence === 'info') {
    console.log('Usage : node scripts/outils/alerter.mjs --urgence <prod-cassee|bloque|question> --message "..."');
    process.exit(1);
  }
  try {
    const ticket = creerAlerte({ urgence, message });
    console.log(`Nicolas est prevenu (ticket #${ticket.number}) : ${ticket.html_url}`);
    if (urgence === 'prod-cassee') console.log(`En cas d'urgence, le joindre aussi directement : ${config.contactSecours ?? '(coordonnees non renseignees)'}`);
  } catch (erreur) {
    console.log('ECHEC : l\'alerte n\'a PAS pu etre envoyee.');
    console.log(`Le client doit joindre Nicolas directement : ${config.contactSecours ?? '(coordonnees non renseignees)'}`);
    console.log(erreur.message);
    process.exit(1);
  }
}
