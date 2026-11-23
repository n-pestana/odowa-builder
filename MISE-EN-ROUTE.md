# Mise en route d'un client Odowa Builder

La liste à suivre avec chaque nouveau client, du jour de la création jusqu'à sa première publication. La partie technique de la création est décrite dans `INSTALLATION.md`, section 2.

> **État** : chaque étape a été faite au moins une fois sur le pilote, **sauf** celles marquées *(non testé)* : la liaison GitHub ↔ Claude n'a été faite qu'avec le compte `n-pestana`, jamais avec le compte d'un client (tâche F du brief).

## Avant le rendez-vous (toi seul)

- [ ] `bash outils/prerequis.sh IDENTIFIANT` → `PREREQUIS VERTS`
- [ ] `outils/nouveau-client.sh IDENTIFIANT "Nom affiché" DOMAINE --email-client … ` → les deux sites verts
- [ ] Commit de `clients/IDENTIFIANT.json` dans l'usine
- [ ] Remplacer le contenu d'exemple : nom, téléphone, adresse, horaires (`src/donnees/entreprise.json`), textes des pages. Puis `/voir` et `/publier` depuis ta propre session
- [ ] Ouvrir le site de test et le site en ligne sur ordinateur et téléphone
- [ ] Envoyer un message depuis le formulaire du site en ligne, vérifier qu'il arrive chez le client *(Turnstile avec un vrai visiteur : non testé)*

## Pendant le rendez-vous (avec le client, 30 minutes)

- [ ] **Compte GitHub** : le créer avec lui, à son nom, avec son e-mail, double authentification sur **son** téléphone
- [ ] `bash outils/github.sh DEPOT LOGIN` : rôle écriture, jamais administrateur. Il accepte l'invitation reçue par mail
- [ ] **Toi** : ajouter son dépôt à l'application GitHub de Claude (github.com/settings/installations → Claude → Configure → Only select repositories)
- [ ] **Abonnement Claude** à son nom, puis connexion de son compte GitHub dans claude.ai/code *(non testé avec un compte client)*
- [ ] Il ouvre une **session cloud** sur son dépôt et écrit « bonjour » : la carte d'accueil ✨ **Odowa Builder** s'affiche
- [ ] **Première modification de bout en bout, c'est lui qui tape** : une demande en français → `/voir` → il regarde sur son téléphone → `/publier` → « oui »
- [ ] Lui montrer `/aide` et lui expliquer les couleurs : 🟢 tout va bien, 🟡 c'est à vous, ⏳ patientez, 🔴 bloqué, ⚪ pas pu vérifier
- [ ] Lui envoyer le mail de bienvenue ci-dessous

## Après (dans la semaine)

- [ ] Brancher le domaine (DNS) sur le projet Pages, puis vérifier le site en ligne sur ce domaine
- [ ] Regarder sa première modification faite seul (`gh api repos/DEPOT/pulls?state=closed`)
- [ ] Vérifier qu'une alerte de test (`/prevenir-nicolas test`) t'arrive bien *(le mail des tickets n'arrive pas encore : réglages de notification GitHub à vérifier)*

## Mail de bienvenue (à adapter)

> **Objet** : Votre site est prêt ✨
>
> Bonjour *Prénom*,
>
> Votre site *Nom du site* est en ligne : *https://www.domaine.fr*
>
> Pour le modifier, ouvrez **claude.ai/code**, choisissez votre site, et écrivez ce que vous voulez changer, en français courant : « change les horaires du samedi », « ajoute une page sur nos tarifs ».
>
> Vos modifications arrivent d'abord sur votre **site de test**, que vos visiteurs ne voient pas. Quand tout vous plaît, tapez **/publier** : le site est vérifié automatiquement, puis mis en ligne.
>
> Trois choses à retenir :
>
> - **/aide** affiche tout ce que vous pouvez faire ;
> - **/annuler-publication** remet la version précédente si quelque chose ne vous plaît pas en ligne ;
> - **/prevenir-nicolas** me prévient si vous êtes bloqué. Vous n'avez rien à expliquer de technique.
>
> Les couleurs vous disent où vous en êtes : 🟢 tout va bien, 🟡 c'est à vous de jouer, ⏳ un instant, 🔴 quelque chose bloque.
>
> Vous ne pouvez rien casser : rien n'est mis en ligne sans votre /publier, et un site qui ne passe pas les contrôles n'est jamais publié.
>
> À bientôt,
> Nicolas PESTANA, Odowa Builder
