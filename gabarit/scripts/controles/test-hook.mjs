// Teste le garde-fou .claude/hooks/garde.mjs dans les deux sens :
// ce qui doit etre refuse l'est, ce qui doit passer passe.
// Usage : npm run check:hook

import { execFileSync, spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const RACINE = fileURLToPath(new URL('../../', import.meta.url));
const HOOK = join(RACINE, '.claude', 'hooks', 'garde.mjs');

// Deux depots jetables pour tester le "git push" sans destination explicite.
const fabriquer = (branche) => {
  const dossier = mkdtempSync(join(tmpdir(), 'hook-'));
  execFileSync('git', ['init', '-q', '-b', branche], { cwd: dossier });
  return dossier;
};
const surMain = fabriquer('main');
const surDev = fabriquer('dev');

const bash = (command, cwd = surDev) => ({ tool_name: 'Bash', tool_input: { command }, cwd });
const fichier = (outil, file_path) => ({ tool_name: outil, tool_input: { file_path }, cwd: RACINE });

const cas = [
  // --- doit etre REFUSE ---
  ['push explicite sur main', bash('git push origin main'), 'refuse'],
  ['push HEAD:main', bash('git push origin HEAD:main'), 'refuse'],
  ['push refs/heads/main', bash('git push origin dev:refs/heads/main'), 'refuse'],
  ['push nu depuis main', bash('git push', surMain), 'refuse'],
  ['push -u origin HEAD depuis main', bash('git push -u origin HEAD', surMain), 'refuse'],
  ['push force', bash('git push --force origin dev'), 'refuse'],
  ['push -f', bash('git push -f origin dev'), 'refuse'],
  ['push +refspec', bash('git push origin +dev'), 'refuse'],
  ['push --all', bash('git push --all origin'), 'refuse'],
  ['suppression de branche', bash('git push origin :dev'), 'refuse'],
  ['push sur main cache dans une chaine', bash('npm run build && git push origin main'), 'refuse'],
  ['push sur main sur plusieurs lignes', bash('git add -A\ngit commit -m x\ngit push origin main'), 'refuse'],
  ['git -C puis push main', bash('git -C . push origin main'), 'refuse'],
  ['switch main', bash('git switch main'), 'refuse'],
  ['checkout main', bash('git checkout main'), 'refuse'],
  ['reset --hard', bash('git reset --hard HEAD~1'), 'refuse'],
  ['clean -fd', bash('git clean -fd'), 'refuse'],
  ['commit --amend', bash('git commit --amend -m x'), 'refuse'],
  ['gh pr merge', bash('gh pr merge 12 --squash'), 'refuse'],
  ['gh api PUT merge', bash('gh api repos/a/b/pulls/3/merge -X PUT'), 'refuse'],
  ['gh api --method POST', bash('gh api repos/a/b/issues --method POST -f title=x'), 'refuse'],
  ['gh api avec champ', bash('gh api repos/a/b/issues -f title=x'), 'refuse'],
  ['gh workflow run', bash('gh workflow run prod.yml'), 'refuse'],
  ['wrangler deploy', bash('npx wrangler pages deploy dist --branch=main'), 'refuse'],
  ['creation de jeton par Claude', bash('node scripts/outils/jeton.mjs creer publier'), 'refuse'],
  ['ecriture directe du jeton', bash('echo x > .git/jeton-site.json'), 'refuse'],
  ['sed -i sur un test', bash("sed -i 's/a/b/' tests/navigateur.spec.js"), 'refuse'],
  ['rm d\'un workflow', bash('rm .github/workflows/prod.yml'), 'refuse'],
  ['redirection vers la config', bash('echo {} > site.config.json'), 'refuse'],
  ['Edit d\'un workflow', fichier('Edit', join(RACINE, '.github/workflows/prod.yml')), 'refuse'],
  ['Write du hook', fichier('Write', '.claude/hooks/garde.mjs'), 'refuse'],
  ['Edit des controles', fichier('Edit', 'scripts/controles/index.mjs'), 'refuse'],
  ['Edit de CLAUDE.md', fichier('Edit', 'CLAUDE.md'), 'refuse'],
  ['Edit du formulaire serveur', fichier('Edit', 'functions/api/contact.js'), 'refuse'],
  ['Edit du noyau', fichier('Edit', 'noyau/Page.astro'), 'refuse'],
  ['sed -i sur le noyau', bash("sed -i 's/a/b/' noyau/Formulaire.astro"), 'refuse'],
  ['Edit d\'un fichier genere', fichier('Edit', 'dist/index.html'), 'refuse'],
  ['Edit d\'un fichier genere en maintenance', fichier('Edit', 'dist/index.html'), 'refuse', { GABARIT_MAINTENANCE: '1' }],
  ['push sur main en maintenance', bash('git push origin main'), 'refuse', { GABARIT_MAINTENANCE: '1' }],
  ['lecture des journaux gh hors maintenance', bash('gh run view 123 --log-failed'), 'refuse'],
  ['gh secret set hors maintenance', bash('gh secret set CLOUDFLARE_API_TOKEN'), 'refuse'],
  ['jeton en maintenance', bash('node scripts/outils/jeton.mjs creer publier'), 'refuse', { GABARIT_MAINTENANCE: '1' }],
  ['wrangler deploy en maintenance', bash('npx wrangler pages deploy dist --branch=main'), 'refuse', { GABARIT_MAINTENANCE: '1' }],
  ['push force en maintenance', bash('git push --force origin dev'), 'refuse', { GABARIT_MAINTENANCE: '1' }],

  // --- doit etre AUTORISE ---
  ['push sur dev', bash('git push origin dev'), 'autorise'],
  ['push HEAD:dev', bash('git push origin HEAD:dev'), 'autorise'],
  ['push nu depuis dev', bash('git push', surDev), 'autorise'],
  ['commit dont le message parle de main', bash('git commit -m "corrige le menu main"'), 'autorise'],
  ['reprendre un fichier du site en ligne', bash('git checkout main -- src/pages/index.md'), 'autorise'],
  ['git diff avec main', bash('git diff origin/main origin/dev'), 'autorise'],
  ['git status', bash('git status'), 'autorise'],
  ['build et controles', bash('npm run build && npm run check'), 'autorise'],
  ['commande /etat', bash('node scripts/outils/etat.mjs'), 'autorise'],
  ['carte d\'etat', bash('node scripts/outils/etat.mjs --carte'), 'autorise'],
  ['commande /voir', bash('node scripts/outils/apercu.mjs --message "Nouveaux horaires"'), 'autorise'],
  ['commande prod (le script verifie le jeton)', bash('node scripts/outils/prod.mjs attendre 12'), 'autorise'],
  ['sortie d\'un script vers /tmp', bash('node scripts/outils/etat.mjs > /tmp/etat.txt'), 'autorise'],
  ['gh api en lecture', bash('gh api repos/a/b/pulls/3'), 'autorise'],
  ['lecture d\'un fichier reserve', bash('cat scripts/controles/index.mjs'), 'autorise'],
  ['rm dans src', bash('rm src/pages/ancienne-page.md'), 'autorise'],
  ['Edit d\'une page', fichier('Edit', join(RACINE, 'src/pages/index.md')), 'autorise'],
  ['Edit de l\'habillage (Base.astro)', fichier('Edit', 'src/layouts/Base.astro'), 'autorise'],
  ['lecture du noyau', bash('cat noyau/Page.astro'), 'autorise'],
  ['Write d\'une image', fichier('Write', 'public/images/equipe.jpg'), 'autorise'],
  ['Write hors du projet', fichier('Write', '/tmp/brouillon.txt'), 'autorise'],
  ['Edit des controles en maintenance', fichier('Edit', 'scripts/controles/index.mjs'), 'autorise', { GABARIT_MAINTENANCE: '1' }],
  ['lecture des journaux gh en maintenance', bash('gh run view 123 --log-failed'), 'autorise', { GABARIT_MAINTENANCE: '1' }],
  ['gh secret set en maintenance', bash('gh secret set CLOUDFLARE_API_TOKEN'), 'autorise', { GABARIT_MAINTENANCE: '1' }],
  ['gh api d\'ecriture en maintenance', bash('gh api -X PATCH repos/a/b -f default_branch=dev'), 'autorise', { GABARIT_MAINTENANCE: '1' }],
  ['script d\'installation', bash('bash scripts/installation/github.sh a/b'), 'autorise', { GABARIT_MAINTENANCE: '1' }],
  ['Read (outil non surveille)', { tool_name: 'Read', tool_input: { file_path: 'CLAUDE.md' }, cwd: RACINE }, 'autorise'],
];

let rates = 0;
for (const [nom, entree, attendu, env = {}] of cas) {
  const environnement = { ...process.env, ...env };
  if (!('GABARIT_MAINTENANCE' in env)) delete environnement.GABARIT_MAINTENANCE;
  const r = spawnSync('node', [HOOK], { input: JSON.stringify(entree), encoding: 'utf8', env: environnement });
  const obtenu = r.status === 2 ? 'refuse' : r.status === 0 ? 'autorise' : `erreur (code ${r.status})`;
  const ok = obtenu === attendu;
  if (!ok) rates += 1;
  console.log(`${ok ? 'OK    ' : 'ECHEC '} ${attendu.padEnd(8)} - ${nom}${ok ? '' : `  -> obtenu : ${obtenu} ${r.stderr.trim()}`}`);
}

rmSync(surMain, { recursive: true, force: true });
rmSync(surDev, { recursive: true, force: true });

// --- Coherence des noms de commandes ------------------------------------------------
// Une commande citee sans SKILL.md, ou un nom d'autorisation different entre le SKILL.md,
// jeton.mjs et prod.mjs, ne se voit qu'au moment ou le client tape la commande.
// Exportee pour etre testee a l'envers (voir plus bas).
export function incoherencesCommandes(racine) {
  const lire = (f) => readFileSync(join(racine, f), 'utf8');
  const dossierSkills = join(racine, '.claude', 'skills');
  const commandes = readdirSync(dossierSkills).filter((d) => existsSync(join(dossierSkills, d, 'SKILL.md')));
  const problemes = [];
  const actionsJeton = (lire('scripts/outils/jeton.mjs').match(/const ACTIONS = \[([^\]]*)\]/)?.[1] ?? '').match(/[\w-]+/g) ?? [];
  const actionsProd = (lire('scripts/outils/prod.mjs').match(/const PREFIXES = \{([^}]*)\}/)?.[1] ?? '').match(/: '([\w-]+)'/g)?.map((m) => m.slice(3, -1)) ?? [];
  for (const c of commandes) {
    const texte = lire(`.claude/skills/${c}/SKILL.md`);
    if (!new RegExp(`^name: ${c}$`, 'm').test(texte)) problemes.push(`${c}/SKILL.md : "name:" differe du dossier`);
    const creations = [...texte.matchAll(/jeton\.mjs creer ([\w-]+)/g)].map((m) => m[1]);
    for (const a of creations) {
      if (a !== c) problemes.push(`${c}/SKILL.md cree l'autorisation "${a}" au lieu de "${c}"`);
      if (!actionsJeton.includes(a)) problemes.push(`autorisation "${a}" inconnue de jeton.mjs`);
      if (!actionsProd.includes(a)) problemes.push(`autorisation "${a}" inconnue de prod.mjs`);
    }
  }
  for (const a of new Set([...actionsJeton, ...actionsProd])) {
    if (!commandes.includes(a)) problemes.push(`autorisation "${a}" sans commande /${a}`);
  }
  const sources = ['CLAUDE.md', 'GUIDE-CLIENT.md', 'README.md', '.claude/hooks/garde.mjs',
    ...commandes.map((c) => `.claude/skills/${c}/SKILL.md`),
    ...readdirSync(join(racine, 'scripts/outils')).filter((f) => f.endsWith('.mjs')).map((f) => `scripts/outils/${f}`)];
  for (const f of sources) {
    for (const m of lire(f).matchAll(/(?<=^|[\s`«(])\/([a-z][a-z-]*[a-z])(?=$|[\s`».,;:)'"])/gm)) {
      if (!commandes.includes(m[1])) problemes.push(`${f} cite /${m[1]}, qui n'existe pas`);
    }
  }
  return problemes;
}

const incoherences = incoherencesCommandes(RACINE);
for (const p of incoherences) console.log(`ECHEC  commandes - ${p}`);
if (incoherences.length === 0) console.log('OK     commandes - noms coherents entre SKILL.md, jeton.mjs, prod.mjs et la documentation');
rates += incoherences.length;

// A l'envers : sur une copie, chaque sabotage doit etre detecte.
const sabotages = [
  ['commande citee qui n\'existe pas', 'CLAUDE.md', (t) => t + '\nTapez `/mise-en-prod`.\n', '/mise-en-prod'],
  ['autorisation differente du nom de la commande', '.claude/skills/publier/SKILL.md', (t) => t.replaceAll('creer publier', 'creer mise-en-prod'), 'au lieu de'],
  ['autorisation inconnue de prod.mjs', 'scripts/outils/prod.mjs', (t) => t.replace("'prod/': 'publier'", "'prod/': 'mise-en-prod'"), 'inconnue de prod.mjs'],
];
for (const [nom, fichierSabote, saboter, attendu] of sabotages) {
  const copie = mkdtempSync(join(tmpdir(), 'commandes-'));
  cpSync(RACINE, copie, { recursive: true, filter: (s) => !/node_modules|[\\/]dist$|[\\/]\.git$/.test(s) });
  const cible = join(copie, fichierSabote);
  writeFileSync(cible, saboter(readFileSync(cible, 'utf8')));
  const detecte = incoherencesCommandes(copie).some((p) => p.includes(attendu));
  rmSync(copie, { recursive: true, force: true });
  if (!detecte) rates += 1;
  console.log(`${detecte ? 'OK    ' : 'ECHEC '} sabotage - ${nom}${detecte ? '' : ' : NON detecte'}`);
}

if (rates > 0) {
  console.log(`\nROUGE - ${rates} cas sur ${cas.length} ne se comportent pas comme prevu.`);
  process.exit(1);
}
console.log(`\nVERT - ${cas.length} cas du garde-fou conformes ; noms de commandes coherents ; 3 sabotages detectes.`);
