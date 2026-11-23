---
name: annuler-modifs
description: Jette les modifications du site de TEST qui ne sont pas encore en ligne, pour repartir de l'état du site en ligne. À utiliser quand le client veut tout annuler et recommencer.
allowed-tools: Bash(node scripts/outils/annuler-modifs.mjs) Bash(node scripts/outils/annuler-modifs.mjs --confirmer)
---

Remet le site de test dans l'état du site en ligne. Le site en ligne n'est pas touché.

1. Lance `node scripts/outils/annuler-modifs.mjs` (sans option) : il montre ce qui serait annulé, sans rien faire.
2. Explique au client ce qui va disparaître du site de test, traduit en pages, puis pose exactement cette question : « J'annule ces modifications ? Répondez oui ou non. » **Attends sa réponse.**
3. Après un oui clair : `node scripts/outils/annuler-modifs.mjs --confirmer`.

Si le client ne veut annuler qu'**une partie** des modifications, n'utilise pas cette commande : corrige les fichiers concernés dans `src/`, puis `/apercu`.

Phrase d'état finale, par exemple : « Le site de test est revenu à l'identique du site en ligne. Rien n'a changé en ligne. »
