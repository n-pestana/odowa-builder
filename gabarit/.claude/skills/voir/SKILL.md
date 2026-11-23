---
name: voir
description: Envoie les modifications en cours sur le site de TEST et donne l'adresse pour les regarder. Ne touche pas le site en ligne. À utiliser quand le client veut voir le résultat (« montre-moi », « je veux voir ce que ça donne »).
allowed-tools: Bash(npm run build) Bash(npm run check) Bash(node scripts/outils/apercu.mjs *)
---

Envoie les modifications sur le site de test. Le site en ligne n'est pas touché.

Étapes à annoncer au client (CLAUDE.md, « Les attentes ») :
`⏳ Vérification de vos modifications…` → `⏳ Envoi sur le site de test…` → `⏳ Mise à jour du site de test (1 à 3 minutes)…` → `✅ Le site de test est à jour`.

1. Lance `npm run build`, puis `npm run check`.
   - Si le build échoue : corrige, ou explique le problème. N'envoie rien.
   - Si un contrôle est ROUGE : corrige-le à la source si c'est dans `src/` ou `public/`, puis recommence. Si tu ne peux pas le corriger, continue quand même à l'étape 2 (le client a le droit de voir son site de test) mais préviens-le que la mise en ligne sera refusée tant que ce contrôle est rouge.
2. Lance `node scripts/outils/apercu.mjs --message "<une phrase qui dit ce qui a changé, en français>"`.
   - S'il répond « BLOQUE », suis son message.
3. Lance `node scripts/outils/apercu.mjs suivre`. Code 3 = pas encore fini : relance la même commande une minute plus tard.
4. Donne au client **l'adresse du site de test** et la liste des pages à regarder. Pour un changement visuel, demande-lui de regarder aussi sur téléphone.

Termine par la carte d'état (CLAUDE.md). Par exemple : « ✨ C'est prêt sur le site de test. Regardez la page Prestations, sur ordinateur et sur téléphone. » puis la carte, puis « **Prochaine étape** : si tout vous convient, tapez `/publier`. »
