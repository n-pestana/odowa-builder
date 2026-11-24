# Gabarit de site vitrine piloté par Claude Code

Site Astro statique, déployé sur Cloudflare Pages par GitHub Actions. Le client le modifie en parlant à Claude Code, sur un site de test, puis le met en ligne avec une commande.

- `CLAUDE.md` : les règles que Claude suit avec le client.
- `GUIDE-CLIENT.md` : la page à remettre au client.

Ce dépôt a été créé et est mis à jour depuis le dépôt « usine » de Nicolas. Tout ce qui est hors de `src/` et `public/` vient du gabarit : une modification faite ici directement sera écrasée à la prochaine mise à jour. Elle se fait dans l'usine.

## Avant de toucher au code : les pièges

Cette section est la plus rentable à maintenir. Chaque piège qui a coûté du temps s'ajoute ici : symptôme, cause racine, réflexe.

### 1. `main` et `dev` ne sont jamais fusionnées entre elles

- **Fonctionnement** : chaque mise en prod est un commit sur `main` dont le contenu est la copie exacte de `dev`. Un retour en arrière est un commit dont le contenu est la copie exacte de l'état précédent. Les deux branches n'ont donc pas d'historique commun au-delà du premier commit.
- **Pourquoi** : avec des fusions classiques, annuler une fusion puis refusionner `dev` ne ramène pas les modifications annulées (git les croit déjà intégrées). Ici, la mise en prod suivante reprend tout le contenu de `dev`, sans cas particulier.
- **Réflexe** : ne jamais lancer `git merge dev` sur `main`, ni `git merge main` sur `dev`. Pour comparer les deux sites : `git diff origin/main origin/dev` (comparaison de contenu), jamais `git log main..dev`.
- **Conséquence** : un correctif fait directement sur `main` serait écrasé à la mise en prod suivante. Tout passe par `dev`.

### 2. On ne modifie jamais `dist/`

- `dist/` est produit par `npm run build` et écrasé à chaque fois. La source est dans `src/`.

### 3. Un contrôle vert ne prouve pas que la page est belle

- **Vécu sur ce gabarit** : les contrôles et les tests navigateur étaient verts alors qu'il manquait une espace entre le téléphone et les horaires, et entre le code postal et la ville. Seule la capture d'écran l'a montré.
- **Réflexe (maintenance)** : après un changement visuel, regarder la capture (artefact `captures-…` de la CI) ou le site de test, sur ordinateur et sur téléphone. Dans une session client, Claude ne fait pas de capture : il donne l'adresse et c'est le client qui regarde (`CLAUDE.md`).
- **Cause technique à connaître** : dans un fichier `.astro`, un retour à la ligne entre une balise et une expression `{…}` ne produit pas d'espace. Écrire `{' '}` quand il en faut une.

### 4. Un contrôle non testé à l'envers ne vaut rien

- Tout contrôle ajouté dans `scripts/controles/index.mjs` doit avoir son sabotage dans `test-a-l-envers.mjs` : on injecte la régression, on vérifie que le contrôle échoue en nommant la page.
- Même règle pour le garde-fou : tout cas ajouté dans `.claude/hooks/garde.mjs` a son cas « refusé » **et** son cas « autorisé » dans `test-hook.mjs`. Un garde-fou trop large bloque les commandes légitimes.

### 5. Dans une session cloud, `gh pr` et `gh issue` ne fonctionnent pas

- Le proxy GitHub des sessions cloud refuse l'API GraphQL. Seul `gh api` (REST) passe. Tous les scripts de `scripts/outils/` utilisent donc `gh api`. Ne pas « simplifier » en `gh pr create`.

### 6. Deux demandes de mise en prod dans la même minute

- **Vécu** : le nom de la branche de mise en prod était horodaté à la minute ; une mise en prod suivie d'un retour puis d'une remise en prod dans la même minute échouait au `push`. Le nom porte maintenant les secondes et l'identifiant du commit.

### 7. Le favicon

- **Vécu** : sans `public/favicon.svg` déclaré dans le gabarit, chaque page produisait une erreur 404 dans la console du navigateur, et le test « pas d'erreur JavaScript » échouait sur toutes les pages.

### 8. Pas de fichier `wrangler.toml`

- Pour un projet Pages, un `wrangler.toml` devient la source de vérité de la configuration et prend le pas sur les variables réglées dans le tableau de bord Cloudflare. Les variables du formulaire sont volontairement gérées dans Cloudflare, pas dans le dépôt.

### 9. `nvm use` peut choisir un Node 22 trop ancien

- **Vécu** : `.nvmrc` dit `22`, mais Astro exige au moins 22.23.4. Sur une machine où le Node 22 le plus récent installé était 22.19.0, `nvm use` l'a sélectionné et `npm run build` a échoué : `Node.js v22.19.0 is not supported by Astro! Please upgrade Node.js to a supported version: ">=22.23.4"`. `npm ci`, lui, ne fait qu'avertir.
- **Cause** : `nvm use` prend la plus récente des versions 22 **déjà installées**, sans en télécharger. Sur GitHub, `setup-node` résout `22` vers la dernière 22.x publiée (v22.23.5 constatée), donc le CI n'est pas touché.
- **Réflexe** : en cas d'erreur de version, `nvm install 22` (télécharge la dernière 22.x), puis `nvm use`.

### 10. Une session cloud travaille sur une branche `claude/…`, pas sur `dev`

- **Vécu** (pilote, session cloud) : la session démarre sur `claude/zen-planck-tlrxet`, avec la consigne de l'environnement cloud d'y travailler. L'ancienne règle « toujours sur `dev` » la contredisait ; Claude l'a signalé au lieu d'agir.
- **Pourquoi ça marche quand même** : `apercu.mjs` enregistre sur la branche courante, se recale sur `origin/dev` et pousse `HEAD:refs/heads/dev`. `prod.mjs` ne regarde que `origin/dev`. La branche `claude/…` n'a pas été poussée sur GitHub.
- **Réflexe** : ne pas forcer un passage sur `dev` au démarrage (ce serait contredire l'environnement cloud). `CLAUDE.md` dit de rester sur la branche de départ, `dev` ou `claude/…`, et seule `main` est refusée.

### 11. Un contrôle rouge ne doit pas empêcher de publier le site de test

- **Vécu** (pilote, test 7) : un lien cassé faisait échouer l'étape « Vérifier que le site de test n'est pas indexable » de `dev.yml`, qui lançait tous les contrôles. La publication était sautée : le client était envoyé voir un site de test qui n'avait pas changé.
- **Cause** : l'étape lançait `npm run check -- --mode=dev` au complet.
- **Réflexe** : elle lance `--seulement=indexation,robots`. Les autres contrôles tournent dans le job `controles` et bloquent la mise en prod. `check:envers` le vérifie dans les deux sens (lien cassé : publication autorisée ; `noindex` ou `robots.txt` manquant : refusée).

### 12. Un fichier renommé apparaissait en code brut dans la liste de ce qui part en ligne

- **Vécu** (pilote, mise à jour 9cf9f23) : `preparer-publication` a listé `R073	.claude/skills/apercu/SKILL.md	.claude/skills/voir/SKILL.md` au lieu de « supprime » et « ajoute ».
- **Cause** : `git diff --name-status` détecte les renommages (`R` + taux de ressemblance), que la traduction ne connaissait pas.
- **Réflexe** : `--no-renames` dans `prod.mjs`, `etat.mjs` et `annuler-modifs.mjs`. Un renommage s'affiche comme une suppression plus un ajout.

### 13. L'outil ne vit pas dans `src/`

- **Vécu** : `src/layouts/Base.astro` contenait à la fois l'habillage du client et l'outil (balises pour Google, `noindex` du site de test, données structurées, bandeau du site de test). S'y ajoutaient `src/pages/robots.txt.js` et le script du formulaire dans `contact.astro`. Comme `src/` appartient au client et n'est jamais mis à jour, aucune correction de ces éléments n'atteignait les clients existants : le nouveau bandeau n'est jamais arrivé chez le pilote.
- **Cause** : la convention d'Astro range les gabarits de page dans `src/layouts/`.
- **Réflexe** : tout ce dont dépendent le référencement, l'indexation, le site de test ou le formulaire va dans `noyau/` (réservé, mis à jour) :
  - `noyau/Page.astro`, que `Base.astro` appelle ;
  - `noyau/Formulaire.astro`, placé par `<Formulaire />` ;
  - `noyau/robots.txt.js`, déclaré par `astro.config.mjs`.

  Le contrôle `[noyau]` refuse une page qui n'y passe pas. `src/` ne garde que ce que le client peut changer sans risque.

### 14. Les tests à l'envers ne doivent pas dépendre du site d'exemple

- **Vécu** (pilote, refonte Tymea faite en session cloud) : le client a supprimé `/prestations/`. `check:envers` sabotait des pages nommées en dur (`prestations`, `contact`, `mentions-legales`) et plantait : 10 erreurs. Comme il tourne dans le job `controles`, toute publication du client aurait été bloquée.
- **Cause** : les sabotages visaient les pages du gabarit, pas celles du site construit.
- **Réflexe** : les pages sabotées sont choisies dans `dist/` (une page ordinaire, une deuxième page, la page qui porte `<Formulaire />`). Un cas qui n'a pas de page applicable s'affiche « NON APPLICABLE », jamais vert en silence. Le workflow de l'usine rejoue les contrôles après avoir supprimé une page d'exemple.

### 15. Un refus que le visiteur peut corriger ne doit pas dire « réessayez plus tard »

- **Vécu** (pilote, ticket #15) : un message « test » (4 caractères) a été refusé par le serveur (422, minimum 5 caractères). La page affichait « Le message n'a pas pu être envoyé… réessayer plus tard », ce qui a fait croire à une panne. Le renvoi avec un vrai message est passé (200, constaté dans le journal en direct).
- **Cause** : la page n'appliquait pas les règles du serveur, et toutes les erreurs donnaient le même texte.
- **Réflexe** : la page applique les mêmes limites que `functions/api/contact.js` (`minlength`, `maxlength`). Les refus corrigeables (`champs-invalides`, `captcha`) disent quoi corriger. Seules les vraies pannes disent « plus tard ». Les tests navigateur vérifient les trois cas.
- **Pour diagnostiquer** : `npx wrangler pages deployment tail ID --project-name site-ID --format json` (ID par l'API des déploiements) donne le code de chaque réponse de `/api/contact`, sans rien envoyer.

## Les commandes

| Commande client | Script | Touche le site en ligne |
|---|---|---|
| `/aide` | — | Non |
| `/etat` | `scripts/outils/etat.mjs` | Non |
| `/voir` | `scripts/outils/apercu.mjs` | Non |
| `/verifier` | `npm run check` + `etat.mjs` | Non |
| `/publier` | `scripts/outils/prod.mjs` | **Oui** |
| `/annuler-publication` | `scripts/outils/prod.mjs` | **Oui** |
| `/recommencer` | `scripts/outils/annuler-modifs.mjs` | Non |
| `/prevenir-nicolas` | `scripts/outils/alerter.mjs` | Non |

Les commandes sont des fichiers `SKILL.md` courts dans `.claude/skills/`. La logique est dans les scripts, qui sont déterministes : Claude orchestre, il n'improvise pas les opérations git.

**Les contrôles de construction.** En plus du référencement, `npm run check` vérifie les bonnes méthodes listées dans `CLAUDE.md`, « Comment on construit » :
- `ssot` et `couleurs` (sur `src/`) ;
- `scripts`, `ressources-externes`, `adresses`, `niveaux-titres`, `orphelines`, `redirections` (comparaison avec `origin/main`, « non vérifié » si la branche est absente) ;
- `formulaire-libelles`, `liens-texte`, `liens-externes`, `images-dimensions`, `images-format`, `poids-page`, `typographie`, `en-tetes`, `secrets`.

Chacun a son sabotage, et les bonnes méthodes ont leur cas autorisé dans `check:envers`. Les en-têtes de sécurité (CSP, etc.) sont produits par `astro.config.mjs` dans `dist/_headers`, pas dans `public/` : ainsi, ils sont mis à jour chez les clients.

**La carte d'état.** Chaque réponse utile au client se termine par la sortie de `node scripts/outils/etat.mjs --carte`, recopiée telle quelle (`CLAUDE.md`). Les couleurs (🟢 🟡 ⏳ 🔴 ⚪) sont décidées par `scripts/outils/carte.mjs`, une fonction pure, jamais par Claude. Règle : une donnée inconnue donne ⚪, jamais 🟢. `scripts/controles/test-carte.mjs` le vérifie sur 17 situations, lancé par `npm run check:hook`.

**Renommer une commande.** Le nom apparaît dans le dossier du `SKILL.md`, son `name:`, l'autorisation (`jeton.mjs`, `PREFIXES` de `prod.mjs`) pour les deux commandes qui touchent le site en ligne, et la documentation. `npm run check:hook` refuse toute commande citée sans `SKILL.md` et toute autorisation incohérente. L'ancien dossier disparaît chez le client à la mise à jour suivante.

## Les quatre niveaux de protection

| Niveau | Où | Ce qu'il empêche | Contournable par |
|---|---|---|---|
| Règles | `CLAUDE.md` | Les erreurs de comportement | Un modèle qui se trompe |
| Garde-fou | `.claude/hooks/garde.mjs` | Push sur `main`, action GitHub directe, fichiers réservés | Une commande shell tordue |
| Autorisation | jeton créé par `/publier` | Une mise en prod que le client n'a pas tapée | Voir l'usine, test pilote n° 2 |
| **Verrou** | GitHub : `main` protégée, contrôle obligatoire, CODEOWNERS | Tout ce qui précède | Un administrateur du dépôt uniquement |

Seul le dernier niveau est une garantie. Les trois premiers évitent d'y arriver.

## Boucle de travail (pour Nicolas)

```bash
nvm use
npm ci
npm run dev            # itérer en local
npm run build          # produit dist/
npm run check          # contrôles de contenu et de référencement
npm run check:envers   # chaque contrôle détecte bien sa régression
npm run check:hook     # garde-fou, noms des commandes, carte d'état
npm run test:navigateur
```

Pour modifier les fichiers réservés et utiliser `gh` avec Claude Code : `GABARIT_MAINTENANCE=1 claude`. Les règles sur `main` restent actives.

## Ce que chaque étape vérifie

| Quand | Quoi |
|---|---|
| Envoi sur `dev` | Publication du site de test (non indexable) ; en parallèle : contrôles, contrôles à l'envers, garde-fou, tests navigateur sur ordinateur et téléphone, formulaire en simulation |
| Demande de mise en prod | Les mêmes contrôles, sur le contenu exact qui partira en ligne. Obligatoires pour fusionner. |
| Après le déploiement en ligne | Version réellement servie, toutes les pages en 200, adresse inconnue en 404, site indexable, envoi réel du formulaire vers la boîte de test. Échec = ticket d'alerte automatique. |
