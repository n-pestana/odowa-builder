---
name: etat
description: Dit où en est le site - modifications en attente, site de test, dernière mise en ligne, contrôles. À utiliser quand le client demande « où on en est », « qu'est-ce qui est en ligne », « est-ce que c'est publié ».
allowed-tools: Bash(node scripts/outils/etat.mjs)
---

Lance `node scripts/outils/etat.mjs`. Cette commande ne modifie rien.

Résume ensuite le résultat au client en 3 à 6 lignes, en français courant :

1. Y a-t-il des modifications en cours pas encore envoyées sur le site de test ?
2. Qu'est-ce qui est sur le site de test et pas encore en ligne ? Traduis les noms de fichiers en pages (« la page Prestations », « les coordonnées »).
3. Quand a eu lieu la dernière mise en ligne, et s'est-elle bien passée ?
4. Les contrôles automatiques sont-ils verts ?

Si la sortie contient « ANORMAL », « ROUGE » ou « injoignable », dis-le clairement et propose la suite (corriger, ou `/alerter-nicolas`).

Ne recopie pas la sortie brute, sauf si le client la demande.
