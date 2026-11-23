# odowa-builder — l'usine à sites clients

Dépôt d'administration de Nicolas. Il contient le gabarit des sites vitrines et les outils qui créent et mettent à jour le dépôt de chaque client. **Aucun client n'y a accès.**

```
odowa-builder/                  ce dépôt (privé, Nicolas seul)
├── gabarit/                    ce que reçoit chaque client : site Astro, CLAUDE.md, commandes, garde-fou, CI
├── outils/
│   ├── nouveau-client.sh       crée le dépôt, les réglages, les secrets et le projet Cloudflare d'un client
│   ├── mettre-a-jour-client.sh pousse une nouvelle version du gabarit chez un client, ou chez tous
│   ├── github.sh               réglages GitHub d'un dépôt client (appelé par nouveau-client.sh)
│   ├── appliquer-gabarit.mjs   recopie le gabarit sans toucher au contenu du client
│   └── test-simulation.sh      teste création et mise à jour sans rien toucher en ligne
├── clients/                    une fiche par client (aucun secret)
├── config.env                  valeurs communes, non versionné
├── secrets.env                 secrets communs, non versionné
├── INSTALLATION.md             mise en place de l'usine, puis d'un client
└── BRIEF-MAINTENANCE.md        mission de validation, pour Claude Code
```

Chaque client a **son propre dépôt** : `PROPRIETAIRE/site-IDENTIFIANT`. Il ne contient que son site ; les outils de l'usine n'y sont jamais copiés.

## Les trois gestes

```bash
# Créer un client
outils/nouveau-client.sh plomberie-martin "Plomberie Martin" www.plomberie-martin.fr \
  --email-client contact@plomberie-martin.fr

# Inviter le client quand son compte GitHub existe
bash outils/github.sh n-pestana/site-plomberie-martin LOGIN-DU-CLIENT

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

1. Modifier `gabarit/`, pousser l'usine, attendre le workflow « Gabarit » vert.
2. `outils/mettre-a-jour-client.sh IDENTIFIANT` : clone le dépôt du client, applique le gabarit, relance build et contrôles **avec le contenu du client**, et pousse sur son site de test seulement si tout est vert.
3. Regarder le site de test du client.
4. Mettre en ligne, depuis un clone du dépôt du client :
   ```bash
   node scripts/outils/jeton.mjs creer mise-en-prod
   node scripts/outils/prod.mjs preparer-mise-en-prod
   node scripts/outils/prod.mjs attendre N
   node scripts/outils/prod.mjs fusionner N
   node scripts/outils/prod.mjs suivre
   ```
   Une mise à jour touche des fichiers réservés : GitHub attend l'accord du propriétaire du code. Voir INSTALLATION.md, « Limites connues ».

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
