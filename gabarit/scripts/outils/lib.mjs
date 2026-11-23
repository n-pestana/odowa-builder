// Fonctions communes aux commandes du site. Aucune dependance npm : seulement git et gh.

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const RACINE = fileURLToPath(new URL('../../', import.meta.url));
export const config = JSON.parse(readFileSync(join(RACINE, 'site.config.json'), 'utf8'));
export const DEV = config.brancheDev;
export const PROD = config.brancheProd;

// Codes de sortie communs : 0 = fait, 1 = refuse ou echec, 3 = pas encore fini (relancer).
export const EN_COURS = 3;

// Une erreur imprevue ne doit jamais laisser Claude deviner : message clair, code 1.
process.on('uncaughtException', (erreur) => {
  console.log('ERREUR INATTENDUE : la commande s\'est arretee avant la fin. Ne pas reessayer en boucle.');
  console.log('Verifier l\'etat avec "node scripts/outils/etat.mjs", puis lancer /alerter-nicolas avec le message ci-dessous.');
  console.log(String(erreur?.stderr || erreur?.message || erreur).trim().split('\n').slice(0, 8).join('\n'));
  process.exit(1);
});

export function arreter(message, code = 1) {
  console.log(message);
  process.exit(code);
}

export function git(...args) {
  return execFileSync('git', args, {
    cwd: RACINE,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    env: {
      ...process.env,
      GIT_AUTHOR_NAME: process.env.GIT_AUTHOR_NAME ?? gitIdentite('user.name', 'Site'),
      GIT_AUTHOR_EMAIL: process.env.GIT_AUTHOR_EMAIL ?? gitIdentite('user.email', 'site@localhost'),
      GIT_COMMITTER_NAME: process.env.GIT_COMMITTER_NAME ?? gitIdentite('user.name', 'Site'),
      GIT_COMMITTER_EMAIL: process.env.GIT_COMMITTER_EMAIL ?? gitIdentite('user.email', 'site@localhost'),
    },
  }).trim();
}

const identites = {};
function gitIdentite(cle, defaut) {
  if (!(cle in identites)) {
    try {
      identites[cle] = execFileSync('git', ['config', cle], { cwd: RACINE, encoding: 'utf8' }).trim() || defaut;
    } catch {
      identites[cle] = defaut;
    }
  }
  return identites[cle];
}

export function gitEssai(...args) {
  try {
    return git(...args);
  } catch {
    return null;
  }
}

export function actualiser() {
  if (gitEssai('fetch', '--quiet', '--prune', 'origin') === null) {
    arreter('Impossible de joindre GitHub pour le moment. Reessayer dans une minute, ou /alerter-nicolas si cela dure.');
  }
}

export const arbre = (ref) => git('rev-parse', `${ref}^{tree}`);
export const commit = (ref) => git('rev-parse', ref);
export const court = (sha) => sha.slice(0, 7);

export function depot() {
  if (config.depot && !config.depot.includes('PROPRIETAIRE')) return config.depot;
  const url = gitEssai('remote', 'get-url', 'origin') ?? '';
  const trouve = url.match(/[:/]([^/:]+\/[^/]+?)(?:\.git)?\/?$/);
  if (!trouve) arreter('Depot GitHub introuvable : renseigner "depot" dans site.config.json.');
  return trouve[1];
}

// Appel a l'API REST de GitHub via gh. (gh pr / gh issue passent par GraphQL,
// refuse dans les sessions cloud : on n'utilise donc que "gh api".)
export function github(chemin, { methode = 'GET', corps } = {}) {
  const args = ['api', chemin.replace('{depot}', depot()), '--method', methode];
  if (corps) args.push('--input', '-');
  try {
    const sortie = execFileSync('gh', args, {
      cwd: RACINE,
      encoding: 'utf8',
      input: corps ? JSON.stringify(corps) : undefined,
      stdio: ['pipe', 'pipe', 'pipe'],
      maxBuffer: 20 * 1024 * 1024,
    });
    return sortie.trim() ? JSON.parse(sortie) : {};
  } catch (erreur) {
    const detail = `${erreur.stdout ?? ''} ${erreur.stderr ?? ''}`.trim() || erreur.message;
    throw new Error(`GitHub a refuse (${methode} ${chemin}) : ${detail}`);
  }
}

export function githubEssai(chemin, options) {
  try {
    return github(chemin, options);
  } catch {
    return null;
  }
}

const FUSEAU = 'Europe/Paris';
export const dateFr = (date = new Date()) =>
  new Intl.DateTimeFormat('fr-FR', { timeZone: FUSEAU, dateStyle: 'long', timeStyle: 'short' }).format(new Date(date));
export const heureFr = (date = new Date()) =>
  new Intl.DateTimeFormat('fr-FR', { timeZone: FUSEAU, timeStyle: 'short' }).format(new Date(date));
export function horodatage(date = new Date()) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('fr-FR', {
      timeZone: FUSEAU,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
      .formatToParts(date)
      .map((x) => [x.type, x.value]),
  );
  return `${p.year}${p.month}${p.day}-${p.hour}${p.minute}${p.second}`;
}

export const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Resultat du controle automatique "controles" pour un commit donne.
export function controlesDuCommit(sha) {
  const reponse = github(`repos/{depot}/commits/${sha}/check-runs?check_name=controles&per_page=20`);
  const essais = reponse.check_runs ?? [];
  if (essais.length === 0) return { etat: 'absent', essais };
  if (essais.some((e) => e.status !== 'completed')) return { etat: 'en-cours', essais };
  const dernier = essais.sort((a, b) => new Date(b.started_at) - new Date(a.started_at))[0];
  return { etat: dernier.conclusion === 'success' ? 'vert' : 'rouge', essais, lien: dernier.html_url };
}

// Dernier passage d'un workflow GitHub Actions pour un commit donne.
export function passageDuWorkflow(fichier, sha) {
  const reponse = github(`repos/{depot}/actions/workflows/${fichier}/runs?head_sha=${sha}&per_page=5`);
  const passage = (reponse.workflow_runs ?? [])[0];
  if (!passage) return { etat: 'absent' };
  if (passage.status !== 'completed') return { etat: 'en-cours', lien: passage.html_url };
  return { etat: passage.conclusion === 'success' ? 'vert' : 'rouge', lien: passage.html_url, date: passage.updated_at };
}

// Repete une verification jusqu'a un resultat definitif, sans depasser ~100 s
// (une commande lancee par Claude est limitee a 2 minutes par defaut).
export async function sonder(verification, { dureeMax = 100_000, intervalle = 10_000 } = {}) {
  const fin = Date.now() + dureeMax;
  for (;;) {
    const resultat = verification();
    if (resultat.etat === 'vert' || resultat.etat === 'rouge') return resultat;
    if (Date.now() + intervalle > fin) return resultat;
    await pause(intervalle);
  }
}

// --- Autorisation de mise en prod ---------------------------------------------
// Le jeton est cree uniquement quand le client tape lui-meme /mise-en-prod ou
// /retour-en-arriere (voir les SKILL.md). Il vit dans .git/ : jamais versionne.
const DUREE_JETON = 20 * 60 * 1000;
const fichierJeton = () => join(git('rev-parse', '--absolute-git-dir'), 'jeton-site.json');

export function creerJeton(action) {
  writeFileSync(fichierJeton(), JSON.stringify({ action, expire: Date.now() + DUREE_JETON }));
}

export function exigerJeton(action) {
  if (config.jetonProdObligatoire === false) return;
  let jeton = null;
  try {
    jeton = JSON.parse(readFileSync(fichierJeton(), 'utf8'));
  } catch {
    /* pas de jeton */
  }
  if (!jeton || jeton.action !== action || jeton.expire < Date.now()) {
    arreter(
      `REFUSE : pas d'autorisation valide pour "${action}".\n` +
        `Cette action touche le site en ligne : elle ne demarre que si le client tape lui-meme /${action}.\n` +
        'Ne pas contourner. Dire au client de taper la commande.',
    );
  }
}

export function consommerJeton() {
  if (existsSync(fichierJeton())) rmSync(fichierJeton());
}

export function lienSession() {
  const id = process.env.CLAUDE_CODE_REMOTE_SESSION_ID;
  return id ? `https://claude.ai/code/${id.replace(/^cse_/, 'session_')}` : null;
}
