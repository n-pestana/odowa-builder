# Brief de maintenance — valider l'usine et créer le premier client

Ce document s'adresse à Claude Code lancé **par Nicolas dans ce dépôt** (`n-pestana/odowa-builder`). Lis d'abord `CLAUDE.md`, `README.md` et `gabarit/README.md`.

## 1. Le but

Nicolas veut vendre à ses clients, non techniciens, un site vitrine qu'ils modifient eux-mêmes en parlant à Claude Code dans une session cloud (claude.ai/code) : modifications sur un site de test, puis mise en ligne par une commande, avec des contrôles automatiques qui bloquent toute régression.

Ce dépôt est l'usine : le gabarit des sites et les outils qui créent et mettent à jour le dépôt de chaque client. Tout a été écrit et testé hors ligne. **La mission est de prouver que cela fonctionne réellement sur GitHub et Cloudflare**, en créant un client pilote.

## 2. Ce qui est prouvé et ce qui ne l'est pas

Le tableau de référence est la section 0 d'`INSTALLATION.md`. En résumé : tout ce qui tourne en local est vert (build, contrôles, garde-fou, tests navigateur, scripts contre une API simulée, création et mise à jour en simulation). Rien de ce qui touche GitHub ou Cloudflare n'a jamais été exécuté.

**Tiens ce tableau à jour à chaque tâche terminée.** C'est le livrable principal de la mission.

## 3. Choix de conception à NE PAS défaire

Chacun a une raison. Si tu penses qu'un de ces choix est la cause d'un problème, **arrête-toi et explique** au lieu de le changer.

1. **Un dépôt usine, un dépôt par client.** Les outils de l'usine ne sont jamais copiés chez un client. On ne corrige jamais le gabarit dans le dépôt d'un client.
2. **Dans un dépôt client, `main` et `dev` ne sont jamais fusionnées.** Une mise en prod est un commit sur `main` dont l'arbre est la copie exacte de celui de `dev` (`git commit-tree`). Raison : avec des fusions classiques, annuler une fusion puis refusionner ne ramène pas les modifications. Ne remplace jamais ce mécanisme par `git merge`, `git revert` ou une PR `dev → main`.
3. **Les scripts du gabarit n'utilisent que `gh api` (REST).** `gh pr` et `gh issue` passent par GraphQL, que le proxy GitHub des sessions cloud refuse. Les outils de l'usine, eux, tournent sur la machine de Nicolas et peuvent utiliser tout `gh`.
4. **Le déploiement est fait par GitHub Actions avec `wrangler pages deploy`**, pas par l'intégration Git de Cloudflare. Raison : imposer l'ordre contrôles → déploiement → vérification du site réel → alerte.
5. **Pas de `wrangler.toml` dans le gabarit.** Pour un projet Pages, il prendrait le pas sur les variables posées dans Cloudflare.
6. **Le client ne modifie que `src/` et `public/`.** Le reste est protégé par le garde-fou (local) et `CODEOWNERS` (GitHub), et c'est exactement ce que la mise à jour du gabarit remplace.
7. **Le contrôle obligatoire s'appelle `controles`**, à l'identique dans `dev.yml`, `controles.yml`, `outils/github.sh` et `gabarit/scripts/outils/lib.mjs`.
8. **Les commandes sont des `SKILL.md` courts ; la logique est dans des scripts déterministes.**
9. **L'autorisation de mise en prod (le jeton)** est créée par la ligne d'injection en tête de `mise-en-prod/SKILL.md` et vérifiée par `prod.mjs`. Dans un dépôt client, le garde-fou t'interdit de la créer toi-même, y compris en maintenance : quand une étape demande une mise en prod, **demande à Nicolas de taper la commande**.
10. **Secrets posés avant le premier push** dans `nouveau-client.sh`, pour que les premiers déploiements d'un client soient verts.

## 4. Règles propres à cette mission

En plus de celles de `CLAUDE.md` :

1. **Ne lance jamais `outils/nouveau-client.sh` sans `--simulation` sans l'accord explicite de Nicolas** sur l'identifiant, le nom et le domaine. La commande crée un dépôt et un projet Cloudflare.
2. **Ne supprime aucun dépôt ni projet Cloudflare toi-même.** Si un essai laisse un dépôt à moitié créé, donne à Nicolas la commande de nettoyage.
3. **Même étape en échec trois fois malgré trois corrections différentes : arrête-toi** et rends compte.
4. **Si GitHub ou Cloudflare se comporte autrement que ce que dit ce document, la réalité l'emporte.** Signale l'écart et corrige le document.

## 5. Les tâches, dans l'ordre

Ne passe à la suivante que si le critère de fin est atteint, ou si Nicolas te le dit.

### A. Le workflow « Gabarit » vert sur GitHub

- Vérifie en local : `(cd gabarit && npm ci && npm run build && npm run check && npm run check:envers && npm run check:hook)` puis `bash outils/test-simulation.sh`.
- Lis le résultat du workflow sur GitHub : `gh run list --limit 5`, `gh run view --log-failed`.
- C'est la première exécution réelle. Suspects les plus probables, à confirmer dans les journaux plutôt qu'à supposer :
  - `npx playwright install --with-deps chromium` (jamais exécuté) ;
  - le serveur `wrangler pages dev` lancé par Playwright : délai de démarrage, accès réseau, date de compatibilité ;
  - la version de Node : Astro 7 exige au moins 22.23.4, `.nvmrc` dit `22` ;
  - `npm ci` face au `package-lock.json` ;
  - `check:hook`, qui crée des dépôts git temporaires ;
  - les versions des actions (`checkout@v4`, `setup-node@v4`, `upload-artifact@v4`).
- **Toute correction du job `gabarit` doit être reportée dans `gabarit/.github/actions/controles/action.yml`**, qui fait la même chose chez les clients.
- **Fin** : les deux jobs `gabarit` et `outils` verts, et l'artefact `captures-…` contient 8 captures. Regarde-en au moins une.

### B. Préparer la configuration

- Vérifie que `config.env` et `secrets.env` existent et que `git status` ne les montre pas. Ne les affiche pas.
- Vérifie les variables de `config.env` (ce fichier-là, tu peux le lire). Pour `secrets.env`, vérifie seulement que les clés attendues sont non vides, sans afficher les valeurs : `grep -c '^CLOUDFLARE_API_TOKEN=.\+' secrets.env`.
- **Fin** : `outils/nouveau-client.sh pilote "Site Pilote" DOMAINE --simulation /tmp/pilote` se termine sans échec.

### C. Créer le client pilote

- Propose à Nicolas l'identifiant, le nom et le domaine. Sans domaine réel, utilise `site-pilote.pages.dev` comme domaine : c'est l'adresse que Cloudflare donnera au projet `site-pilote`.
- Après son accord, lance la commande réelle. Elle n'a jamais tourné : lis chaque ligne du bilan.
- Points à trancher et à rapporter précisément :
  - **GitHub accepte-t-il de protéger `main` sur un dépôt privé avec l'offre actuelle ?** Si une offre payante est exigée, arrête-toi : décision de Nicolas.
  - **La pose des variables du projet Pages par l'API Cloudflare fonctionne-t-elle ?** C'est l'appel le plus incertain. Vérifie le résultat avec un `GET` sur le projet (les valeurs secrètes ne sont pas renvoyées, leur présence suffit).
  - Les deux premiers déploiements du client (`Site en ligne`, `Site de test`) sont-ils verts dès le premier push ?
- Si la commande échoue en cours de route, elle n'est pas relançable telle quelle (le dépôt existe). Dis à Nicolas ce qui a été créé et propose soit de finir les étapes à la main, soit de supprimer et recommencer.
- **Fin** : bilan sans échec, site de test en ligne avec le bandeau « Version de test » et `noindex`, site en ligne servi, `clients/pilote.json` commité.

### D. Le cycle complet sur le pilote

Dans un clone du dépôt du pilote, lancé avec `GABARIT_MAINTENANCE=1 claude`, avec Nicolas qui tape les commandes réservées :

1. Une modification dans `src/`, puis `/apercu`.
2. `/mise-en-prod` : préparation, contrôles, confirmation, fusion, vérification du site réel.
3. Dans le journal de `prod.yml`, `apres-deploiement.mjs` est vert, formulaire compris, et le mail de test arrive.
4. `/retour-en-arriere`, puis de nouveau `/mise-en-prod` : les modifications reviennent en ligne.
5. `/alerter-nicolas` : le ticket est créé et Nicolas est notifié.
6. Une PR qui ne touche que `src/` est fusionnable sans approbation ; une PR qui touche `scripts/` attend celle de Nicolas.
7. Avec l'accord de Nicolas, provoque un échec de la vérification après déploiement (jeton de test volontairement faux) : le ticket d'alerte automatique doit être créé. Remets la bonne valeur.

- **Fin** : tests pilotes 2, 5, 6, 7, 9, 10, 11 et 12 d'`INSTALLATION.md` passés.

### E. La diffusion d'une mise à jour

1. Fais une modification anodine et visible dans `gabarit/` (par exemple une phrase dans `gabarit/GUIDE-CLIENT.md`), pousse l'usine, attends le workflow vert.
2. `outils/mettre-a-jour-client.sh pilote`.
3. Vérifie dans le dépôt du pilote : le fichier est à jour, `src/` n'a pas bougé, `.gabarit-version` a changé.
4. Mets en ligne cette mise à jour. **Question à trancher** : Nicolas étant l'auteur de la demande, il ne peut pas l'approuver. La fusion par l'API passe-t-elle parce qu'il est administrateur, ou est-elle refusée ? Rapporte la réponse exacte de GitHub. Si elle est refusée, propose une solution qui ne retire pas la protection aux clients.

- **Fin** : la mise à jour est en ligne chez le pilote, et la procédure réelle est écrite dans `README.md`, section « Mettre à jour les clients ».

### F. Ce que tu ne peux pas valider d'ici

Les tests pilotes 1, 3, 4, 8 et 13 se font dans une **session cloud avec un compte client**. Ne les déclare pas validés. Rédige pour Nicolas la marche à suivre, pas à pas.

## 6. Comment rendre compte

À la fin de chaque tâche, et à chaque arrêt :

- **Vert** : ce qui a été exécuté et constaté, avec la preuve (numéro du run, sortie de la commande).
- **Rouge** : ce qui échoue, la cause si elle est établie, sinon tes hypothèses présentées comme telles.
- **Non testé** : ce que tu n'as pas pu vérifier, et pourquoi.
- **Modifié** : les fichiers changés et la raison de chaque changement.
- **Décision attendue** : ce que Nicolas doit trancher.

« Ça devrait marcher » n'est pas un état.
