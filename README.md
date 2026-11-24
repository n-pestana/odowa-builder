# odowa-builder — l'usine à sites clients

Dépôt d'administration de Nicolas. Il contient le gabarit des sites vitrines et les outils qui créent et mettent à jour le dépôt de chaque client. **Aucun client n'y a accès.**

```
odowa-builder/                  ce dépôt (privé, Nicolas seul)
├── gabarit/                    ce que reçoit chaque client : site Astro, CLAUDE.md, commandes, garde-fou, CI
├── outils/
│   ├── nouveau-client.sh       crée le dépôt, les réglages, les secrets et le projet Cloudflare d'un client
│   ├── mettre-a-jour-client.sh pousse une nouvelle version du gabarit chez un client, ou chez tous
│   ├── onboarder.sh            mise en route : invite le client, règle l'adresse du formulaire, affiche favori et mail
│   ├── github.sh               réglages GitHub d'un dépôt client (appelé par nouveau-client.sh)
│   ├── prerequis.sh            vérifie tout ce qui peut l'être avant de créer quoi que ce soit (appelé par nouveau-client.sh)
│   ├── appliquer-gabarit.mjs   recopie le gabarit sans toucher au contenu du client
│   └── test-simulation.sh      teste création et mise à jour sans rien toucher en ligne
├── clients/                    une fiche par client (aucun secret)
├── config.env                  valeurs communes, non versionné
├── secrets.env                 secrets communs, non versionné
├── INSTALLATION.md             mise en place de l'usine, puis d'un client
├── MISE-EN-ROUTE.md            créer et mettre en route un client : A, B, C
├── TESTS-COMPTE-CLIENT.md      tache F : tests en session cloud avec un compte client
└── BRIEF-MAINTENANCE.md        mission de validation, pour Claude Code
```

Chaque client a **son propre dépôt** : `PROPRIETAIRE/site-IDENTIFIANT`. Il ne contient que son site ; les outils de l'usine n'y sont jamais copiés.

## Les trois gestes

```bash
# Créer un client
outils/nouveau-client.sh plomberie-martin "Plomberie Martin" www.plomberie-martin.fr \
  --email-client contact@plomberie-martin.fr

# Mettre le client en route quand son compte GitHub existe (MISE-EN-ROUTE.md, étape B)
bash outils/onboarder.sh plomberie-martin LOGIN-DU-CLIENT contact@plomberie-martin.fr

# Diffuser une amélioration du gabarit
outils/mettre-a-jour-client.sh plomberie-martin      # un client
outils/mettre-a-jour-client.sh --tous                # tous
```

Chaque outil se termine par un bilan : fait, échec, reste à faire à la main.

## Qui possède quoi dans le dépôt d'un client

| Chemin | Propriétaire | Mise à jour du gabarit |
|---|---|---|
| `src/`, `public/` | Le client | Jamais touché |
| `site.config.json` | Le client (valeurs) | Seules les clés nouvelles sont ajoutées |
| `.github/CODEOWNERS` | Rempli à la création | Jamais touché |
| Tout le reste | L'usine | Remplacé, fichiers obsolètes supprimés |

Conséquence : **on ne corrige jamais un fichier du gabarit dans le dépôt d'un client.** La correction serait écrasée à la mise à jour suivante. On corrige dans `gabarit/`, on valide, on diffuse.

## Travailler sur le gabarit

```bash
cd gabarit
nvm use && npm ci
npm run dev              # itérer
npm run build && npm run check && npm run check:envers && npm run check:hook
npm run test:navigateur
cd .. && bash outils/test-simulation.sh
```

Le workflow « Gabarit » rejoue tout cela sur GitHub à chaque push de l'usine, sans secret ni déploiement. **On ne diffuse chez les clients qu'une version de l'usine dont ce workflow est vert.**

Les pièges du gabarit sont documentés dans `gabarit/README.md`, qui est aussi le README que voient les dépôts clients. Les pièges de l'usine sont ci-dessous.

## Mettre à jour les clients

Procédure exécutée sur le pilote (tâche E, gabarit `051a7aa` → `9bc0a37`).

1. **Modifier `gabarit/`**, lancer les contrôles d'avant-push, pousser l'usine, attendre le workflow « Gabarit » vert.
2. **Diffuser** : `outils/mettre-a-jour-client.sh IDENTIFIANT` (ou `--tous`), avec `gh` connecté en `n-pestana` (`gh auth switch -u n-pestana` si besoin). Le script clone `dev`, applique le gabarit sans toucher à `src/`, `public/`, aux valeurs de `site.config.json` ni à `CODEOWNERS`, relance build et contrôles **avec le contenu du client**, et ne pousse sur `dev` que si tout est vert. Il met à jour `versionGabarit` dans `clients/IDENTIFIANT.json` : committer l'usine ensuite.
3. **Vérifier** : run « Site de test » vert (`gh run list --repo n-pestana/site-IDENTIFIANT`), et un coup d'œil au site de test.
4. **Mettre en ligne toi-même, sans attendre** : tant que la mise à jour est sur `dev` sans être en ligne, toute publication du client (`/publier`) est bloquée (elle emporterait des fichiers réservés : `Waiting on code owner review from n-pestana`, HTTP 405). Depuis un clone du dépôt du client, à jour sur `dev` :
   ```bash
   gh repo clone n-pestana/site-IDENTIFIANT && cd site-IDENTIFIANT   # ou : git pull --ff-only origin dev
   nvm use && npm ci
   node scripts/outils/jeton.mjs creer publier      # c'est toi qui tapes : tu es l'auteur de la demande
   node scripts/outils/prod.mjs preparer-publication   # note le numéro N
   node scripts/outils/prod.mjs attendre N              # relancer tant qu'il répond "PAS ENCORE"
   node scripts/outils/prod.mjs fusionner N
   node scripts/outils/prod.mjs suivre                  # relancer tant qu'il répond "PAS ENCORE"
   ```
   **Constaté au pilote** : la demande ouverte par `n-pestana` est `mergeable_state: clean` et la fusion par l'API passe (demande #10). La même demande ouverte par le client était `blocked` et refusée. Tu n'as donc rien à approuver pour tes propres mises à jour. Cause probable, non vérifiée dans la documentation de GitHub : tu es l'unique propriétaire du code, ta propre demande satisfait la règle ; à défaut, ce serait ton droit d'administrateur (`enforce_admins: false`). Dans les deux cas, ne pas passer `enforce_admins` à `true`.
5. **Si un client a lancé `/publier` entre-temps** : sa demande est bloquée et Claude t'alerte. Deux voies : relancer toi-même l'étape 4 (`preparer` ferme sa demande et en ouvre une à ton nom), ou approuver sa demande dans l'interface GitHub (« Review changes » → « Approve »), puis lui faire relancer `/publier`.

## Les pièges de l'usine

### 1. Le dépôt de l'usine n'a pas le garde-fou des clients

Le garde-fou vit dans `gabarit/.claude/` : il s'active dans les dépôts clients, pas ici. Dans l'usine, Claude Code n'a donc aucune restriction, et c'est voulu. À l'inverse, pour intervenir avec Claude Code dans le dépôt d'un client, il faut `GABARIT_MAINTENANCE=1 claude`.

### 2. Les secrets ne passent que par `secrets.env`

Jamais dans `config.env`, jamais dans une fiche de `clients/`, jamais dans `gabarit/`. `nouveau-client.sh` les lit, les envoie à GitHub et Cloudflare, et n'en affiche aucun. Le jeton de test du formulaire est généré à la création et n'est conservé nulle part ailleurs que chez GitHub et Cloudflare : pour le changer, on en régénère un et on le pose aux deux endroits.

### 3. Pas de dépendance à `rsync`

**Vécu** : la première version de la mise à jour utilisait `rsync`, absent de la machine de test. Le script échouait dès le départ. La recopie est maintenant faite par `appliquer-gabarit.mjs`, qui ne demande que Node.

### 4. Les secrets avant le premier push

`nouveau-client.sh` crée le dépôt vide, pose secrets et variables, crée le projet Cloudflare, **puis** pousse. Dans l'autre ordre, les deux premiers déploiements échouent faute de secrets, et le client démarre avec du rouge.

### 5. Une mise à jour peut être refusée par le contenu du client

Si une nouvelle version du gabarit ajoute un contrôle que le contenu d'un client ne respecte pas, `mettre-a-jour-client.sh` s'arrête sans rien pousser et laisse le dossier pour examen. C'est le comportement voulu : on ne casse pas le site de test d'un client pour diffuser un contrôle.

### 6. Le jeton Cloudflare est un jeton de compte

- **Vécu** : `GET /user/tokens/verify` répondait `Invalid API Token` (code 1000) alors que le même jeton listait les projets Pages sans erreur.
- **Cause** : le jeton a été créé comme jeton de compte (« Account API Token »), qui ne se vérifie pas sur l'adresse des jetons utilisateur.
- **Réflexe** : vérifier par `GET /accounts/$CLOUDFLARE_ACCOUNT_ID/tokens/verify`, puis par la liste des projets Pages. Ne jamais conclure qu'il est cassé sur la seule réponse de `/user/tokens/verify`.

### 7. Un domaine d'expédition non validé ne se voit qu'à la première mise en prod

- **Vécu** : `CONTACT_EXPEDITEUR` était sur `odowa.com`, absent du compte Resend. Un envoi de test a répondu `HTTP 403 {"message":"The odowa.com domain is not verified. ...","name":"validation_error"}`. Rien dans la création d'un client ne l'aurait signalé : seuls les formulaires des visiteurs et la vérification après mise en prod auraient échoué.
- **Cause** : Resend n'accepte comme expéditeur qu'une adresse sur un domaine validé du compte, quelle que soit la portée de la clé (« All domains » veut dire tous les domaines validés). L'offre gratuite n'autorise qu'un domaine.
- **Réflexe** : après tout changement de `CONTACT_EXPEDITEUR` ou de clé Resend, faire un envoi de test vers `EMAIL_TEST` par `POST https://api.resend.com/emails` et constater la réception.

### 8. Le premier déploiement juste après la création du projet Pages peut échouer

- **Vécu** (pilote) : le premier déploiement du site de test a échoué sur `A request to the Cloudflare API (/accounts/…/pages/projects/site-pilote) failed. Internal authentication error: internal server error [code: 10500]`, une vingtaine de secondes après la création du projet. Le site en ligne, déployé à la même seconde avec le même jeton, est passé. La relance du job a réussi sans rien changer.
- **Cause** : non établie. Hypothèse : erreur passagère de Cloudflare dans la minute qui suit la création d'un projet. Un seul cas observé.
- **Réflexe** : après une création, vérifier les deux premiers runs (`gh run list --repo DEPOT`). Sur l'erreur 10500, relancer le job : `gh run rerun RUN --repo DEPOT --failed`. Si elle revient sur un autre client, envisager une relance automatique dans `nouveau-client.sh`.

### 9. L'application GitHub de Claude est installée par toi, pas par le client

- **Vécu** (pilote) : `site-pilote` n'apparaissait pas dans l'application Claude. Dans GitHub, Settings → Applications ne montrait Claude que dans « Authorized GitHub Apps » (bouton Revoke, pas de Configure) : le compte avait autorisé Claude, mais l'application n'était installée sur aucun dépôt.
- **Cause** : seul le propriétaire d'un compte installe une application sur ses dépôts. Les dépôts clients sont à toi ; le client, collaborateur en écriture, ne peut pas le faire.
- **Réflexe** : installer une fois l'application Claude sur ton compte en « Only select repositories » (jamais « All repositories » : l'usine serait visible), puis ajouter chaque nouveau dépôt client. `nouveau-client.sh` le rappelle dans son bilan. Ne jamais cliquer « Revoke » sur l'autorisation.

### 10. Les alertes passent par les notifications GitHub, pas par un mail de l'usine

- **Vécu** (pilote) : tickets d'alerte créés et notification reçue, mais aucun mail, même pour le ticket #8 créé par `github-actions[bot]`.
- **Cause** : `alerter.mjs` crée un ticket qui mentionne et assigne `contactNicolas` ; le mail dépend entièrement des réglages de notification de ce compte GitHub. En plus, GitHub n'envoie pas de mail pour ses propres actions : un ticket créé depuis une session reliée à `n-pestana` ne le prévient pas par mail.
- **Réflexe** : github.com/settings/notifications → « Default notification email » et case Email de « Participating, @mentions and custom ». Valider avec un ticket créé par un autre compte. **Non résolu à ce jour.**

### 11. Un faux jeton de test sans captcha enverrait un vrai message au client

- **Constat** (lecture de `gabarit/functions/api/contact.js`, tâche D7) : si `CONTACT_JETON_TEST` diffère entre GitHub et Cloudflare, la requête de test n'est pas reconnue comme un test. Avec Turnstile, elle est refusée (`403 captcha`) : c'est ce qui s'est passé sur le pilote. **Sans** `TURNSTILE_SECRET`, elle partirait comme un vrai message vers `CONTACT_EMAIL`, chez le client.
- **Réflexe** : le jeton se change toujours aux deux endroits à la fois ; il n'est conservé nulle part ailleurs, on en régénère un (`openssl rand -hex 24`). Cloudflare ne l'applique qu'au déploiement suivant : relancer le dernier run « Site en ligne ».

### 12. Une session cloud ne s'ouvre pas : le client doit écrire en premier

- **Vécu** (pilote) : rien ne s'affiche tant que le client n'a pas envoyé un message. La sortie du hook `SessionStart` va dans le contexte de Claude, pas à l'écran.
- **Cause** : aucun mécanisme documenté ne fait parler Claude en premier dans une session cloud ([hooks](https://code.claude.com/docs/en/hooks.md), [sessions cloud](https://code.claude.com/docs/en/claude-code-on-the-web.md)).
- **Contournement** : un favori `https://claude.ai/code?repositories=PROPRIETAIRE/site-ID&prompt=Bonjour`. Constaté le 23/11/2026 : le dépôt est choisi et « Bonjour » est pré-rempli, **sans envoi** ; le client appuie sur Entrée et l'accueil s'affiche. Ces paramètres **ne sont pas documentés** par Anthropic : ils peuvent cesser de marcher sans prévenir. `nouveau-client.sh` affiche le lien.
- **Réflexe** : si un client dit « le lien n'ouvre plus mon site », vérifier le favori soi-même. En repli, il ouvre claude.ai/code, choisit son site et écrit directement ce qu'il veut changer : l'accueil arrive en tête de la réponse.

### 13. Un nouveau contrôle peut bloquer la mise à jour d'un client existant

- **Vécu** (simulation sur une copie du pilote, contrôles « bonnes méthodes ») : le gabarit corrigé était vert, mais le contenu du pilote, copié de l'ancien gabarit, était rouge. Il contenait `en panne :` avec une espace ordinaire, et l'adresse écrite en dur dans `mentions-legales.md`. `mettre-a-jour-client.sh` refuse alors de pousser (« contenu non compatible »), comme prévu.
- **Cause** : `src/` appartient au client. La mise à jour ne le touche jamais, donc un contrôle plus strict s'applique à un contenu ancien.
- **Réflexe** : avant de diffuser un nouveau contrôle, simuler sur une copie de chaque client (`cp -r` d'un clone, puis `mettre-a-jour-client.sh --simulation`, `npm run build`, `npm run check`). Corriger d'abord le **contenu** chez le client, de préférence depuis sa session (« corrige ce que les contrôles signalent »), publier, puis diffuser. Ne jamais assouplir le contrôle pour faire passer un client.

### 14. Une partie de l'outil vivait dans `src/`, chez le client

- **Vécu** : la mise à jour n'atteignait ni le bandeau du site de test, ni les balises pour Google, ni `robots.txt`, ni le script du formulaire, tous rangés dans `src/`.
- **Correction** : le noyau `gabarit/noyau/` (voir `gabarit/README.md`, piège 13). Chaque client existant a besoin d'une **migration unique** de son `src/` :
  - `Base.astro` devient l'habillage qui appelle `<Page>` du noyau ;
  - `contact.astro` utilise `<Formulaire />` ;
  - `src/pages/robots.txt.js` est supprimé (sinon deux routes `/robots.txt`).

  Faite sur le pilote depuis un clone le 24/11/2026.
- **Prochaine étape** : quand il y aura plusieurs clients, des migrations numérotées appliquées par `mettre-a-jour-client.sh` au contenu d'un client resté sur une version ancienne. Elles serviront aussi au piège 13.

### 15. Une migration de `src/` entre en collision avec une session client ouverte

- **Vécu** (pilote, 24/11/2026) : une session cloud faisait la refonte complète du site (Tymea Formation) pendant la migration vers le noyau, qui réécrivait `Base.astro` et `contact.astro`. `/voir` a refusé de mélanger (« BLOQUE »), rien n'a été perdu (branche `claude/…` poussée), et la session a ouvert le ticket #14.
- **Cause** : une mise à jour normale ne touche pas `src/`, mais une migration, si. Une session ouverte travaille sur l'ancienne version.
- **Réflexe** :
  - avant une migration, chercher les branches `claude/…` récentes et les sessions en cours (tickets, `gh api repos/DEPOT/branches`) ;
  - en cas de collision, rejouer la branche de la session sur `dev` dans une copie de travail (`git worktree`), adapter, contrôler, pousser en avance rapide ;
  - puis faire **ouvrir une nouvelle session** au client : l'ancienne garde la version d'avant et rebuterait sur le même conflit.

### 16. Le site de test d'un nouveau client ne répond pas tout de suite

- **Vécu** (numa-academy, 24/11/2026) : les deux premiers déploiements étaient verts et le site en ligne répondait, mais `https://dev.site-numa-academy.pages.dev` ne répondait pas du tout (curl : code 000). Après environ 1 minute, il a répondu 200.
- **Cause probable, non vérifiée** : l'adresse `dev.` (alias de branche Cloudflare Pages) d'un projet neuf met un moment à exister.
- **Réflexe** : attendre quelques minutes avant de conclure à un échec ou de donner l'adresse au client.
