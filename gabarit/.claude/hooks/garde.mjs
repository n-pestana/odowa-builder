#!/usr/bin/env node
// Garde-fou local (hook PreToolUse de Claude Code).
// Refuse AVANT execution ce qui mettrait le site en ligne en danger ou contournerait
// les commandes prevues. Un refus = code de sortie 2 + explication pour Claude.
//
// Ce garde-fou est un CONFORT, pas le verrou. Le vrai verrou est sur GitHub :
// branche main protegee + controle obligatoire + CODEOWNERS (voir INSTALLATION.md du depot usine).
//
// Maintenance par Nicolas : lancer Claude Code avec GABARIT_MAINTENANCE=1 pour
// pouvoir modifier les fichiers reserves et utiliser gh. Restent actifs : les regles
// sur "main", le refus des push forces, du jeton et des deploiements wrangler manuels.

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const RACINE = resolve(fileURLToPath(new URL('../../', import.meta.url)));
const MAINTENANCE = process.env.GABARIT_MAINTENANCE === '1';

let PROD = 'main';
try {
  PROD = JSON.parse(readFileSync(join(RACINE, 'site.config.json'), 'utf8')).brancheProd ?? 'main';
} catch {
  /* valeur par defaut */
}

// Le client ne modifie que le contenu et la presentation du site.
const DOSSIERS_LIBRES = ['src/', 'public/'];
const RESERVES = ['.claude/', '.github/', 'scripts/', 'tests/', 'functions/', 'site.config.json', 'CLAUDE.md', 'playwright.config.js', 'astro.config.mjs', 'package.json', 'package-lock.json', '.dev.vars', '.nvmrc'];

function refuser(raison) {
  console.error(`REFUSE par le garde-fou du site : ${raison}`);
  process.exit(2);
}

let entree;
try {
  entree = JSON.parse(readFileSync(0, 'utf8'));
} catch {
  process.exit(0); // entree illisible : on ne bloque pas, le verrou GitHub reste en place
}

const outil = entree.tool_name ?? '';
const parametres = entree.tool_input ?? {};

// --- Fichiers : Edit, Write, MultiEdit, NotebookEdit ---------------------------------
if (['Edit', 'Write', 'MultiEdit', 'NotebookEdit'].includes(outil)) {
  const brut = parametres.file_path ?? parametres.notebook_path ?? '';
  const absolu = isAbsolute(brut) ? resolve(brut) : resolve(entree.cwd ?? RACINE, brut);
  const rel = relative(RACINE, absolu).split(sep).join('/');
  const dansLeProjet = rel !== '' && !rel.startsWith('..') && !isAbsolute(rel);

  if (dansLeProjet) {
    if (rel.startsWith('dist/') || rel.startsWith('.astro/')) {
      refuser(`"${rel}" est un fichier genere, il serait ecrase au prochain build. Modifier la source dans src/ puis relancer "npm run build".`);
    }
    if (rel.startsWith('.git/')) refuser('on ne modifie jamais le dossier .git a la main.');
    if (!MAINTENANCE && !DOSSIERS_LIBRES.some((d) => rel.startsWith(d))) {
      refuser(`"${rel}" fait partie des fichiers reserves a Nicolas (garde-fous, tests, configuration). Seuls src/ et public/ sont modifiables. Si la demande du client l'exige, lancer /alerter-nicolas.`);
    }
  }
  process.exit(0);
}

// --- Commandes : Bash ---------------------------------------------------------------
if (outil !== 'Bash') process.exit(0);

const commande = String(parametres.command ?? '');
const morceaux = commande.split(/&&|\|\||[;\n|]/).map((m) => m.trim()).filter(Boolean);

function brancheCourante() {
  try {
    return execFileSync('git', ['symbolic-ref', '--short', 'HEAD'], { cwd: entree.cwd ?? RACINE, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return '';
  }
}

// REGLE JETON (voir INSTALLATION.md du depot usine, test pilote n° 2) : l'autorisation de mise en prod
// ne peut etre creee que par le client qui tape la commande, jamais par Claude.
if (/jeton\.mjs|jeton-site\.json/.test(commande)) {
  refuser('l\'autorisation de mise en prod ne se cree pas a la main. Elle est creee quand le client tape lui-meme /mise-en-prod ou /retour-en-arriere.');
}

for (const morceau of morceaux) {
  const mots = morceau.split(/\s+/);

  if (/\bgit\b/.test(morceau)) {
    const iPush = mots.indexOf('push');
    if (iPush > 0) {
      const options = mots.slice(iPush + 1).filter((m) => m.startsWith('-'));
      const cibles = mots.slice(iPush + 1).filter((m) => !m.startsWith('-'));
      const refspecs = cibles.slice(1);
      if (options.some((o) => /^(-f|--force|--force-with-lease.*|--force-if-includes|-[a-zA-Z]*f[a-zA-Z]*)$/.test(o)) || refspecs.some((r) => r.startsWith('+'))) {
        refuser('pas de "push" force : cela reecrit l\'historique. Pour repartir de l\'etat du site en ligne, utiliser /annuler-modifs.');
      }
      if (options.some((o) => /^(--all|--mirror|--delete|-d|--tags|--prune)$/.test(o)) || refspecs.some((r) => r.startsWith(':'))) {
        refuser('cette forme de "push" (toutes les branches, suppression, etiquettes) n\'est pas utilisee ici. Utiliser /apercu.');
      }
      const destinations = refspecs.map((r) => (r.includes(':') ? r.split(':')[1] : r).replace(/^refs\/heads\//, ''));
      const implicite = refspecs.length === 0 || destinations.some((d) => d === 'HEAD' || d === '@');
      if (destinations.includes(PROD) || (implicite && brancheCourante() === PROD)) {
        refuser(`on ne pousse jamais sur "${PROD}" : c'est le site en ligne. La seule voie est la commande /mise-en-prod, tapee par le client.`);
      }
    }
    if (/\bgit\b.*\b(switch|checkout)\b/.test(morceau) && mots.includes(PROD) && !mots.includes('--')) {
      refuser(`on ne travaille jamais sur la branche "${PROD}". Rester sur la branche de travail. (Pour reprendre un fichier du site en ligne : git checkout ${PROD} -- chemin/du/fichier)`);
    }
    if (/\breset\b.*--hard|\bclean\b.*\s-[a-zA-Z]*f|\bbranch\b.*\s-D\b|\bfilter-branch\b|\bupdate-ref\b|\bcommit-tree\b|\bcommit\b.*--amend|\brebase\b/.test(morceau)) {
      refuser('commande git destructive ou qui reecrit l\'historique. Pour jeter les modifications en cours, utiliser /annuler-modifs ; en cas de doute, /alerter-nicolas.');
    }
  }

  // En maintenance, Nicolas a besoin de gh (journaux, secrets, reglages du depot).
  if (!MAINTENANCE && /(^|\s)gh(\s|$)/.test(morceau)) {
    const ecriture =
      /\bgh\s+(pr|issue|release|repo|workflow|run|secret|variable|auth|ruleset|label)\b/.test(morceau) ||
      (/\bgh\s+api\b/.test(morceau) && /(\s-X\s*(?!GET)[A-Za-z]|--method[=\s]+(?!GET)[A-Za-z]|\s-[fF]\b|--field|--raw-field|--input)/.test(morceau));
    if (ecriture) {
      refuser('pas d\'action directe sur GitHub. Passer par les commandes du site : /apercu, /mise-en-prod, /retour-en-arriere, /alerter-nicolas. (La lecture avec "gh api" en GET reste permise.)');
    }
  }

  if (/\bwrangler\b.*\b(deploy|publish|delete|rollback|secret)\b/.test(morceau)) {
    refuser('on ne deploie jamais a la main sur Cloudflare. Le deploiement est fait automatiquement apres /apercu et /mise-en-prod.');
  }

  if (!MAINTENANCE) {
    const chemin = `(\\./)?(${RESERVES.map((r) => r.replace(/[.\/]/g, '\\$&')).join('|')})`;
    const ecritFichierReserve =
      new RegExp(`>>?\\s*["']?${chemin}`).test(morceau) ||
      new RegExp(`(^|\\s)(rm|mv|cp|chmod|truncate|tee|touch|ln)\\s+([^#]*\\s)?["']?${chemin}`).test(morceau) ||
      new RegExp(`(sed|perl)\\s+[^#]*(-i|--in-place)[^#]*\\s["']?${chemin}`).test(morceau) ||
      new RegExp(`\\bgit\\s+(rm|mv)\\s[^#]*${chemin}`).test(morceau);
    if (ecritFichierReserve) {
      refuser('cette commande modifie un fichier reserve a Nicolas (garde-fous, tests, configuration). Seuls src/ et public/ sont modifiables. Si la demande du client l\'exige, lancer /alerter-nicolas.');
    }
  }
}

process.exit(0);
