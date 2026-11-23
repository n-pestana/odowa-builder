// Lance au debut de chaque session Claude (hook SessionStart).
// Ne doit jamais faire echouer la session : on sort toujours avec le code 0.

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const RACINE = fileURLToPath(new URL('../../', import.meta.url));
const lancer = (commande, args) => execFileSync(commande, args, { cwd: RACINE, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();

try {
  const config = JSON.parse(readFileSync(join(RACINE, 'site.config.json'), 'utf8'));

  // Dans une session cloud, la machine est neuve : il faut installer les dependances.
  if (process.env.CLAUDE_CODE_REMOTE === 'true' && !existsSync(join(RACINE, 'node_modules'))) {
    try {
      lancer('npm', ['ci', '--no-audit', '--no-fund']);
    } catch {
      console.log('ATTENTION : l\'installation des dependances a echoue. Lancer "npm ci" avant tout build.');
    }
  }

  let branche = lancer('git', ['rev-parse', '--abbrev-ref', 'HEAD']);
  if (branche === config.brancheProd) {
    try {
      lancer('git', ['switch', config.brancheDev]);
      branche = config.brancheDev;
    } catch {
      /* signale ci-dessous */
    }
  }

  console.log(`Site : ${config.nomSite}. Branche courante : ${branche}.`);
  if (branche === config.brancheProd) console.log(`ANORMAL : la session est sur "${config.brancheProd}". Passer sur "${config.brancheDev}" avant toute modification.`);
  console.log('Le client n\'est pas technicien. Suivre CLAUDE.md. Commandes disponibles : /aide.');
} catch {
  /* ne jamais bloquer la session */
}
process.exit(0);
