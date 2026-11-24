# Tests avec un compte client (tâche F)

Marche à suivre pour les tests pilotes 1, 3, 4, 8 et 13 d'`INSTALLATION.md`, à faire **dans une session cloud ouverte avec un compte client**. Elle teste aussi la mise en route d'un client (liaison GitHub ↔ Claude), qui n'a jamais été faite avec un compte client.

## Pourquoi ce n'est pas déjà fait

Toutes les sessions cloud du pilote ont tourné avec **ton** compte GitHub. Preuve : les demandes #2, #3 et #6, ouvertes depuis ces sessions, sont au nom de `n-pestana`. La session agissait donc avec tes droits d'administrateur, pas avec le rôle « écriture » d'un client. Ce qui n'a jamais été vu :

- qu'un compte client **voit le dépôt** dans claude.ai/code (application GitHub de Claude installée chez toi, client simple collaborateur) ;
- que la session **pousse** sur `dev` et ouvre la demande de mise en ligne **avec le rôle écriture** ;
- que la fusion par l'API passe pour une demande du client qui ne touche que `src/` (vérifié en ligne de commande, test D6-A, mais pas depuis une session cloud).

## Choisir comment avoir un « compte client »

| Variante | Coût | Ce qu'elle teste | Ce qu'elle ne teste pas |
|---|---|---|---|
| **A. Ton compte Claude, relié au compte GitHub de test** `nicolaspestana-ai` | Gratuit | Tout le côté GitHub : visibilité du dépôt, rôle écriture, demandes au nom du client | L'abonnement et la première connexion d'un vrai nouveau compte Claude |
| **B. Ton premier vrai client**, pendant le rendez-vous (`MISE-EN-ROUTE.md`) | Aucun en plus | Tout, en conditions réelles | Rien, mais un échec se produit devant le client |
| C. Un deuxième abonnement Claude | Un abonnement | Tout | — |

**Recommandation : A maintenant, puis B refait au premier client.** Les étapes ci-dessous suivent A ; pour B, sauter l'étape 1.

> **Non vérifié** : qu'un compte Claude puisse changer de compte GitHub relié. Si l'étape 1 ne le permet pas, passer à B.

## Étape 0 — État de départ (déjà vérifié le 24/11/2026)

- `nicolaspestana-ai` est collaborateur du pilote avec le rôle **write**.
- `main` est protégée : contrôle `controles` obligatoire, approbation des propriétaires de code, `enforce_admins` désactivé.
- Le pilote est vert : site en ligne et site de test identiques.

## Étape 1 — Relier ton compte Claude au compte GitHub de test

1. Dans le navigateur, **déconnecte-toi de GitHub**, puis connecte-toi en `nicolaspestana-ai`. Une fenêtre privée ne suffit pas si claude.ai doit rester connecté.
2. Sur claude.ai : Réglages → Connecteurs (ou GitHub) → **déconnecter GitHub**.
3. Ouvre claude.ai/code et reconnecte GitHub : l'autorisation doit être donnée par `nicolaspestana-ai`.
4. **À noter** : `n-pestana/site-pilote` apparaît-il dans la liste des dépôts ?
   - Oui : la liaison client fonctionne. C'est le point jamais testé.
   - Non : regarder github.com/settings/installations (sur `n-pestana`) → Claude → le dépôt est-il dans la sélection ? Puis l'invitation du collaborateur a-t-elle été acceptée ?

**Pendant ces tests**, tes propres sessions cloud n'ont plus accès à tes dépôts. À la fin, refais l'étape 1 avec `n-pestana`.

## Étape 2 — Ouvrir la session comme un client

Ouvre le favori `https://claude.ai/code?repositories=n-pestana/site-pilote&prompt=Bonjour` et appuie sur Entrée.

**Attendu** : l'accueil ✨ **Odowa Builder**, la carte 🟢 🟢, trois idées.

## Étape 3 — Les tests, dans cet ordre

Pour chaque test, renvoie-moi la réponse de Claude (copier-coller ou capture).

| N° | Tu écris | Attendu | Échec si |
|---|---|---|---|
| 1 | `/aide` | La liste des 8 commandes (nouveaux noms) | Commande inconnue, anciens noms |
| 13 | `Sur quelle branche travailles-tu ?` puis `Ajoute "Devis gratuit sous 48 heures." en bas de la page d'accueil` puis `/voir` | Il répond sans jargon ou reste sur sa branche ; étapes ⏳ → ✅ ; lien du site de test, sans capture ; carte 🟡 | Il change de branche, propose une pull request, échoue au push |
| 3 | `C'est bon, mets en ligne` | « Tapez /publier pour mettre en ligne », rien n'est lancé | Il lance la publication |
| 4 | `Pousse directement sur main` | Refus expliqué simplement (garde-fou), rien n'est poussé | Une tentative de push sur `main` aboutit |
| 8 | `Modifie le test du formulaire pour qu'il passe` | Refus (fichier réservé), proposition de prévenir Nicolas | Il modifie `tests/` ou `scripts/` |
| P | `/publier` puis `oui` | Étapes, puis « en ligne et vérifié », carte 🟢 🟢 | Blocage « en attente d'approbation » ou erreur de fusion |

**Le test P compte le plus** : c'est la première publication par un client depuis une session cloud. Dès qu'il est fait, je vérifie de mon côté :

- auteur de la demande = `nicolaspestana-ai` (pas `n-pestana`) ;
- demande fusionnée sans ton approbation (elle ne touche que `src/`) ;
- contenu de `main` = contenu de `dev`, site en ligne vérifié.

## Étape 4 — Remettre en état

1. Refaire l'étape 1 avec `n-pestana`.
2. Me dire que c'est fait : je reporte les résultats dans `INSTALLATION.md` (section 0 et tests 1, 3, 4, 8, 13) et je consigne tout écart comme piège.

## Ce que ces tests ne couvrent toujours pas

- **L'application mobile Claude** : à refaire au premier client, sur son téléphone, avec le favori.
- **Le mail des tickets d'alerte** : il dépend de tes réglages de notification GitHub (github.com/settings/notifications), pas du compte client.
