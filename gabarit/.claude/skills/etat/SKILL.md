---
name: etat
description: Dit où en est le site - modifications en attente, site de test, dernière mise en ligne, contrôles. À utiliser quand le client demande « où on en est », « qu'est-ce qui est en ligne », « est-ce que c'est publié ».
allowed-tools: Bash(node scripts/outils/etat.mjs) Bash(node scripts/outils/etat.mjs --carte)
---

Lance `node scripts/outils/etat.mjs --carte`, puis `node scripts/outils/etat.mjs`. Ces commandes ne modifient rien.

Affiche la carte telle quelle, puis complète en 2 à 4 lignes, en français courant :

1. Y a-t-il des modifications en cours pas encore envoyées sur le site de test ?
2. Qu'est-ce qui est sur le site de test et pas encore en ligne ? Traduis les noms de fichiers en pages (« la page Prestations », « les coordonnées »).
3. Quand a eu lieu la dernière mise en ligne, et s'est-elle bien passée ?
4. Les contrôles automatiques sont-ils verts ?

Si la sortie contient « ANORMAL », « ROUGE » ou « injoignable », dis-le clairement et propose la suite (corriger, ou `/prevenir-nicolas`).

Ne recopie pas le rapport détaillé, sauf si le client le demande. Termine par **Prochaine étape**.
