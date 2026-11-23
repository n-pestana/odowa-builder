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
- **Réflexe** : après un changement visuel, regarder la capture (artefact `captures-…` de la CI) ou le site de test, sur ordinateur et sur téléphone.
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

## Les commandes

| Commande client | Script | Touche le site en ligne |
|---|---|---|
| `/aide` | — | Non |
| `/etat` | `scripts/outils/etat.mjs` | Non |
| `/apercu` | `scripts/outils/apercu.mjs` | Non |
| `/verifier` | `npm run check` + `etat.mjs` | Non |
| `/mise-en-prod` | `scripts/outils/prod.mjs` | **Oui** |
| `/retour-en-arriere` | `scripts/outils/prod.mjs` | **Oui** |
| `/annuler-modifs` | `scripts/outils/annuler-modifs.mjs` | Non |
| `/alerter-nicolas` | `scripts/outils/alerter.mjs` | Non |

Les commandes sont des fichiers `SKILL.md` courts dans `.claude/skills/`. La logique est dans les scripts, qui sont déterministes : Claude orchestre, il n'improvise pas les opérations git.

## Les quatre niveaux de protection

| Niveau | Où | Ce qu'il empêche | Contournable par |
|---|---|---|---|
| Règles | `CLAUDE.md` | Les erreurs de comportement | Un modèle qui se trompe |
| Garde-fou | `.claude/hooks/garde.mjs` | Push sur `main`, action GitHub directe, fichiers réservés | Une commande shell tordue |
| Autorisation | jeton créé par `/mise-en-prod` | Une mise en prod que le client n'a pas tapée | Voir l'usine, test pilote n° 2 |
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
npm run check:hook     # le garde-fou refuse et autorise ce qu'il faut
npm run test:navigateur
```

Pour modifier les fichiers réservés et utiliser `gh` avec Claude Code : `GABARIT_MAINTENANCE=1 claude`. Les règles sur `main` restent actives.

## Ce que chaque étape vérifie

| Quand | Quoi |
|---|---|
| Envoi sur `dev` | Publication du site de test (non indexable) ; en parallèle : contrôles, contrôles à l'envers, garde-fou, tests navigateur sur ordinateur et téléphone, formulaire en simulation |
| Demande de mise en prod | Les mêmes contrôles, sur le contenu exact qui partira en ligne. Obligatoires pour fusionner. |
| Après le déploiement en ligne | Version réellement servie, toutes les pages en 200, adresse inconnue en 404, site indexable, envoi réel du formulaire vers la boîte de test. Échec = ticket d'alerte automatique. |
