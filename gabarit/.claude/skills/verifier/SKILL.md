---
name: verifier
description: Lance les contrôles automatiques du site (pages, liens, référencement, formulaire) et rend un rapport honnête. À utiliser quand le client demande si tout est en ordre avant de mettre en ligne.
allowed-tools: Bash(npm run build) Bash(npm run check) Bash(node scripts/outils/etat.mjs)
---

Vérifie le site sans rien mettre en ligne.

Étapes à annoncer au client (CLAUDE.md, « Les attentes ») : `⏳ Contrôle des pages, des liens et du référencement…` → `⏳ Lecture des contrôles du site de test…` → le rapport.

1. Lance `npm run build`, puis `npm run check`. Ce sont les contrôles de contenu : titres, descriptions, liens, images, référencement.
2. Lance `node scripts/outils/etat.mjs` et lis la ligne « Contrôles automatiques » du site de test. Ces contrôles tournent sur GitHub et couvrent en plus l'affichage dans un navigateur et le formulaire de contact. Ils portent sur **ce qui a été envoyé par le dernier `/voir`**, pas sur les modifications faites depuis.

Rends un rapport en trois catégories, sans enjoliver :

- **🟢 Vérifié** : ce qui a été contrôlé et qui passe.
- **🔴 À corriger** : chaque problème, avec la page et la cause en français courant, et ce que tu proposes pour le corriger.
- **⚪ Non vérifié** : ce que les contrôles ne couvrent pas (le rendu visuel réel, la réception effective d'un mail par le client), et ce qui n'a pas pu être vérifié maintenant (contrôles en cours, GitHub injoignable, modifications pas encore envoyées).

Si quelque chose est rouge et que tu peux le corriger dans `src/` ou `public/`, propose de le faire. Ne modifie jamais un contrôle pour le faire passer.

Termine par la carte d'état (CLAUDE.md).
