# Créer et mettre en route un client

Trois temps. La technique est dans deux commandes ; le reste se fait avec le client.

## A. Créer (toi seul, 5 minutes)

```bash
outils/nouveau-client.sh ID "Nom affiché" site-ID.pages.dev --simulation /tmp/essai-ID   # répétition, rien en ligne
outils/nouveau-client.sh ID "Nom affiché" site-ID.pages.dev                              # création
git add clients/ID.json && git commit -m "Client ID" && git push
```

- Résultat : une **page d'attente au nom du client**, en ligne et sur le site de test (accueil, contact, mentions légales). Aucun contenu fictif.
- Puis : github.com/settings/installations → Claude → Configure → ajouter `site-ID`.
- Le site de test peut mettre une minute à répondre (README, piège 16).

## B. Rendez-vous avec le client (30 minutes, ensemble)

1. **Son compte GitHub** : il le crée avec son e-mail, double authentification sur **son** téléphone. Il ne verra jamais GitHub ensuite, mais Claude agit avec ce compte (rôle écriture, jamais le tien : tu es administrateur).
2. **Une commande, par toi** :
   ```bash
   bash outils/onboarder.sh ID LOGIN-GITHUB adresse@client.fr
   ```
   Elle vérifie tout avant d'agir, invite son compte, règle l'adresse de réception du formulaire, redéploie le site en ligne et **affiche le favori et le mail de bienvenue remplis**. Il accepte l'invitation reçue par mail.
3. **Son abonnement Claude**, puis il relie son GitHub dans claude.ai/code *(jamais fait avec un compte client : TESTS-COMPTE-CLIENT.md)*.
4. **Le favori « ✨ Mon site »** sur son ordinateur et son téléphone (lien affiché à l'étape 2). Il clique, appuie sur Entrée : l'accueil s'affiche.
5. **Sa première demande, c'est lui qui écrit** : « Crée mon site à partir de… » (son ancien site, une plaquette, ses textes). Puis `/voir`, il regarde sur son téléphone, `/publier`, « oui ».
6. **Tu lui envoies le mail de bienvenue** (affiché à l'étape 2).

## C. Après

- **Le domaine**, quand il en a un : le brancher sur le projet Pages (DNS), puis changer `urlProd` dans `site.config.json`.
- **Sa première modification faite seul** : y jeter un œil (`gh api repos/n-pestana/site-ID/pulls?state=closed`).
- **Une alerte de test** (`/prevenir-nicolas test`) doit t'arriver *(mail des tickets pas encore reçu : réglages de notification GitHub à vérifier)*.

## Ce qui est vérifié, et ce qui ne l'est pas

| Étape | État |
|---|---|
| A : création, page d'attente, premiers déploiements | Vérifié (numa-academy, 24/11/2026) |
| B2 : `onboarder.sh` | Vérifié **en simulation** (refus et cas autorisé, sabotages détectés). **Jamais lancé sur un vrai client** |
| B3 : liaison GitHub ↔ Claude d'un compte client | **Non testé** |
| B4 : favori | Vérifié sur ordinateur ; téléphone non testé |
| B5 : session cloud, `/voir`, `/publier` | Vérifié avec le compte `n-pestana` ; pas avec un compte client |
| Formulaire avec un vrai visiteur | Vérifié sur le pilote |
