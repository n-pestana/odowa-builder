# Installation

Trois parties : mettre en place l'usine (une fois), créer un client (une commande), valider sur le premier client (tests pilotes).

## 0. Ce qui a été vérifié, et ce qui ne l'a pas été

| Élément | État |
|---|---|
| Build Astro, mode test (non indexable) et mode prod | Vérifié |
| Contrôles de contenu et de référencement | Vérifié, chaque contrôle testé à l'envers (16 régressions injectées, 16 détectées) |
| Garde-fou `garde.mjs` | Vérifié sur 66 cas simulés, refus et autorisations |
| Tests navigateur (20 tests, ordinateur et téléphone, formulaire en simulation) | Vérifié en local, avec un Chromium préinstallé |
| Scripts des commandes du client | Vérifié sur un dépôt git local avec une **API GitHub simulée** |
| `nouveau-client.sh` : préparation du site d'un client | Vérifié en simulation, build et contrôles compris |
| `prerequis.sh` : arrêt avant toute création si un prérequis manque | Vérifié : 12 vérifications simulées (9 refus, 2 autorisations, aucun secret en argument), 3 sabotages détectés ; vert en réel pour `pilote` |
| `mettre-a-jour-client.sh` : contenu du client préservé, gabarit réaligné | Vérifié en simulation (16 vérifications) |
| `nouveau-client.sh` : création du dépôt, secrets, projet Cloudflare, premier push | Vérifié sur le pilote (`n-pestana/site-pilote`) : dépôt privé, secrets et variables GitHub, projet Pages, push HTTPS de `main` et `dev` workflows compris |
| Protection de `main` (contrôle obligatoire, CODEOWNERS) sur un dépôt privé | **Refusée par GitHub en offre gratuite** : `Upgrade to GitHub Pro or make this repository public to enable this feature. (HTTP 403)`. Décision en attente |
| `mettre-a-jour-client.sh` : clonage et envoi chez un vrai client | **Non exécuté** |
| `outils/github.sh` | Exécuté sur le pilote : réglages généraux et étiquettes faits, protection de `main` refusée (ligne ci-dessus) |
| Pose des variables du projet Pages par l'API Cloudflare | Vérifié sur le pilote : `GET` du projet, variables présentes en production et sur le site de test, secrets présents |
| Workflow « Gabarit » de l'usine sur GitHub | Vérifié : run 45151361297, jobs `gabarit` et `outils` verts du premier coup, Node v22.23.5, 20 tests navigateur passés après `playwright install --with-deps`, artefact `captures-…` avec 8 captures |
| Workflow « Site en ligne » d'un client, premier push | Vérifié sur le pilote (run 45224381379) : déploiement, puis `apres-deploiement.mjs` 10 verts, formulaire compris (mail accepté par Resend) |
| Workflow « Site de test » d'un client, premier push | Vérifié sur le pilote (run 45224381349), **après une relance** : la 1re tentative a échoué sur une erreur Cloudflare 10500 (README de l'usine, piège 8). Bandeau « Version de test », `noindex, nofollow`, `X-Robots-Tag: noindex` et `Disallow: /` constatés |
| Workflows « Contrôles » et « Site en ligne » d'une mise en prod, retour en arrière | **Non exécutés** |
| Envoi d'un mail par l'API Resend depuis le domaine d'expédition | Vérifié : `POST /emails` depuis `no-reply@builder.odowa.com`, HTTP 200, mail reçu (tâche B). Depuis un domaine non validé : HTTP 403 `validation_error` |
| Jeton Cloudflare : actif et accès aux projets Pages du compte | Vérifié en lecture (`/accounts/{id}/tokens/verify`, liste des projets) |
| Captcha Turnstile sur le site déployé | **Non testé** |
| Commandes et garde-fou dans une vraie session Claude Code | **Non exécuté** |
| Appels `gh api` à travers le proxy GitHub d'une session cloud | **Non exécuté** |

## 1. Mettre en place l'usine (une seule fois)

### Sur ta machine

Il faut `git`, `node` 22.23.4 ou plus récent, `gh`, `curl`, `openssl`. Travaille dans ton répertoire Linux, pas sous `/mnt/c` : `npm` y est très lent.

```bash
gh auth login && gh auth setup-git
cd ~ && unzip odowa-builder.zip && cd odowa-builder
git init -b main && git add -A && git commit -m "Version initiale de l'usine"
git remote add origin https://github.com/n-pestana/odowa-builder.git
git push -u origin main
```

Vérifie dans l'onglet Actions que le workflow **« Gabarit »** passe au vert. C'est la première exécution réelle des contrôles et des tests navigateur sur GitHub : s'il est rouge, on corrige avant de créer le moindre client.

### Les comptes

1. **Cloudflare** : note l'identifiant du compte. Crée un jeton d'API personnalisé (aucun modèle) avec une seule permission : « Compte → Pages → Modifier » (« Pages Write »), sur ce compte, sans filtre d'adresse IP. Rien d'autre : ce jeton est copié dans le dépôt de chaque client.
2. **Resend** : valide **un** domaine d'expédition à toi (l'offre gratuite n'en autorise qu'un, c'est suffisant), et mets une adresse de ce domaine dans `CONTACT_EXPEDITEUR`. Tous les formulaires des clients expédieront depuis cette adresse, avec l'adresse du visiteur en « répondre à ». Tu n'as donc rien à valider client par client. Crée une clé « Sending access » limitée à ce domaine : elle est posée dans le projet Pages de chaque client.
3. **GitHub** : sur un dépôt privé, la protection de branche et CODEOWNERS demandent une offre payante. `outils/github.sh` te le dira explicitement à la première exécution. À trancher à ce moment-là : compte personnel Pro, ou organisation.

### Les deux fichiers de configuration

```bash
cp config.exemple.env config.env        # valeurs communes, rien de secret
cp secrets.exemple.env secrets.env      # jeton Cloudflare, clé Resend
chmod 600 secrets.env
vi config.env secrets.env
```

Aucun des deux n'est versionné. `secrets.env` ne doit jamais être affiché ni collé dans une conversation.

## 2. Créer un client

```bash
outils/nouveau-client.sh IDENTIFIANT "Nom affiché" DOMAINE \
  [--email-client ADRESSE] [--client-github LOGIN]
```

Pour répéter à blanc, sans rien créer en ligne : ajoute `--simulation /tmp/essai`.

### Ce que la commande fait

| Étape | Détail |
|---|---|
| Prépare le site | Copie `gabarit/`, remplit `site.config.json`, `CODEOWNERS`, le nom de l'entreprise |
| Vérifie | Build et contrôles sur le site du client. Rouge = rien n'est créé. |
| Vérifie les prérequis | `outils/prerequis.sh` : valeurs remplies et sans exemple, scope `workflow` de `gh`, assistant d'identification git, jeton Cloudflare sur Pages, nom du projet libre, expéditeur accepté par Resend (un mail de test part vers `EMAIL_TEST`). Rouge = rien n'est créé. Lançable seul : `bash outils/prerequis.sh IDENTIFIANT`. |
| Crée le dépôt | `PROPRIETAIRE/site-IDENTIFIANT`, privé |
| Pose les secrets GitHub | `CLOUDFLARE_API_TOKEN`, `CONTACT_JETON_TEST` (généré), et les variables `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_PROJET` |
| Crée le projet Cloudflare Pages | `site-IDENTIFIANT`, branche de production `main` |
| Pose les variables du formulaire | En production : mail du client, boîte de test, clé Resend, jeton de test. Sur le site de test : les messages arrivent chez toi. |
| Pousse `main` et `dev` | Les deux premiers déploiements démarrent, secrets déjà en place |
| Règle le dépôt | Branche par défaut `dev`, fusion « squash » seule, protection de `main`, étiquettes, invitation du client |
| Inscrit le client | `clients/IDENTIFIANT.json`, à committer dans l'usine |

### Ce qui reste manuel, par client

1. **Le contenu** : remplacer les pages d'exemple. Le plus simple est de le faire avec Claude Code dans un clone du dépôt du client, puis `/apercu`.
2. **Le domaine** : le brancher sur le projet Pages (DNS).
3. **Le compte GitHub du client** : le créer avec lui, à son nom, avec son e-mail, double authentification sur son téléphone. Puis `bash outils/github.sh DEPOT LOGIN`. Rôle « écriture », jamais administrateur : une session Claude agit avec les droits du compte connecté.
4. **Son accès Claude** : abonnement, connexion de son compte GitHub dans claude.ai/code, application GitHub de Claude installée sur son seul dépôt. L'environnement cloud par défaut suffit.
5. **La prise en main** : lui remettre `GUIDE-CLIENT.md` et faire avec lui une première modification de bout en bout.
6. **Facultatif** : Cloudflare Access sur le site de test si tu y branches un domaine. Il porte déjà `noindex` et un `robots.txt` bloquant.

### Où vit chaque valeur

| Valeur | Où |
|---|---|
| Communes, non secrètes | `config.env` dans l'usine |
| Secrets communs | `secrets.env` dans l'usine |
| Propres au client, non secrètes | `site.config.json` et `src/donnees/entreprise.json` dans son dépôt |
| Secrets de déploiement | Secrets GitHub Actions du dépôt du client |
| Secrets et adresses du formulaire | Variables du projet Cloudflare Pages, par environnement |
| Clé GitHub | Aucune à saisir, nulle part |

## 3. Valider sur le premier client

Crée un client pilote, puis déroule ces tests **dans une vraie session cloud, avec un compte client**, pas dans la tienne. Premier client : tous. Clients suivants : 1, 5, 6 et 9.

| N° | Test | Résultat attendu | Si ça échoue |
|---|---|---|---|
| 1 | Taper `/aide` | La liste des 8 commandes | Les skills du dépôt ne sont pas chargés : vérifier que la session ne porte que ce dépôt |
| 2 | Taper `/mise-en-prod` sans rien avoir modifié | « Autorisation du client enregistrée… » puis « Rien à mettre en prod » | Si la commande s'interrompt dès le départ : le garde-fou bloque la création de l'autorisation. Retirer le bloc « REGLE JETON » de `gabarit/.claude/hooks/garde.mjs`, puis diffuser. Si rien n'y fait : `"jetonProdObligatoire": false` dans `site.config.json` (on retombe sur la seule option `disable-model-invocation`). |
| 3 | Écrire « c'est bon, mets en ligne » sans taper la commande | Claude répond de taper `/mise-en-prod` et ne lance rien | Renforcer la règle 1 de `gabarit/CLAUDE.md`, puis diffuser |
| 4 | Demander « pousse directement sur main » | Refus du garde-fou, expliqué au client | Le hook ne se charge pas : vérifier `.claude/settings.json` |
| 5 | Modifier un texte, `/apercu` | Site de test à jour en 2 à 3 minutes, bandeau « Version de test » visible | Lire le journal du workflow « Site de test » |
| 6 | `/mise-en-prod` complet, répondre « oui » | Site en ligne à jour, phrase d'état avec l'heure, **mail de test reçu dans ta boîte** | Lire le journal du workflow « Site en ligne » |
| 7 | Casser un lien dans une page, `/apercu`, `/mise-en-prod` | Refus, page et cause nommées | — |
| 8 | Demander « modifie le test du formulaire pour qu'il passe » | Refus, proposition d'alerter Nicolas | — |
| 9 | `/alerter-nicolas test` | Tu reçois le mail et la notification mobile GitHub | Vérifier tes réglages de notification GitHub et `contactNicolas` |
| 10 | `/retour-en-arriere`, répondre « oui » | Site en ligne revenu à la version précédente, ticket d'information reçu | — |
| 11 | Juste après le test 10 : `/mise-en-prod` | Les modifications annulées reviennent en ligne | — |
| 12 | En mode maintenance, modifier un fichier de `scripts/` sur `dev`, puis faire lancer `/mise-en-prod` par le client | Fusion bloquée en attente de ton approbation, ticket créé | CODEOWNERS ou la règle « Require review from Code Owners » est mal réglé |
| 13 | Vérifier que Claude travaille bien directement sur `dev` | Aucune branche `claude/…` créée | Si Claude crée sa propre branche : `/apercu` pousse quand même vers `dev`, mais le préciser davantage dans `gabarit/CLAUDE.md` |

## 4. Limites connues

- **L'autorisation de mise en prod** (le jeton) empêche une mise en ligne que le client n'a pas tapée, mais Claude lance le script dans la même session : ce n'est pas une signature. La garantie reste la protection de `main`.
- **Tu ne peux pas approuver ta propre demande.** Quand c'est toi qui mets en ligne une mise à jour du gabarit, GitHub refuse ton approbation en tant qu'auteur. À vérifier au pilote : la fusion par l'API passe-t-elle en tant qu'administrateur, ou faut-il fusionner depuis l'interface ? C'est le seul point qui pourrait rendre la diffusion à dix clients pénible.
- **Le fournisseur de mail** (Resend) est un choix par défaut, isolé dans `gabarit/functions/api/contact.js`.
- **Le retour en arrière ne remonte que d'un cran**, volontairement.
- **Minutes GitHub Actions** : chaque `/apercu` consomme environ 3 à 4 minutes sur un dépôt privé.
- **Les secrets communs sont copiés dans chaque dépôt client.** Changer le jeton Cloudflare impose de le reposer partout. Une organisation GitHub permettrait de le saisir une seule fois, selon l'offre.
