---
name: retour-en-arriere
description: Annule la dernière mise en ligne et remet le site en ligne dans son état précédent. Ne se lance que si le client tape lui-même /retour-en-arriere.
disable-model-invocation: true
allowed-tools: Bash(node scripts/outils/jeton.mjs creer retour-en-arriere) Bash(node scripts/outils/prod.mjs *)
---

!`node scripts/outils/jeton.mjs creer retour-en-arriere`

Le client vient de taper `/retour-en-arriere`. La ligne ci-dessus doit dire « Autorisation du client enregistrée ». Si ce n'est pas le cas, arrête-toi et lance `/alerter-nicolas`.

Cette commande ne remonte que **d'un cran**. Le site de test n'est pas modifié : les changements annulés y restent, pour être corrigés puis remis en ligne.

Suis ces étapes dans l'ordre. Code 1 = arrête-toi et suis le message ; code 3 = relance la même commande une minute plus tard.

1. **Préparer.** Lance `node scripts/outils/prod.mjs preparer-retour`. « REFUSE » : explique et lance `/alerter-nicolas` si le message le demande. Sinon, note le numéro de la demande.
2. **Confirmer.** Dis au client ce qui sera annulé et à quel état le site en ligne reviendra, puis pose exactement cette question : « J'annule la dernière mise en ligne ? Répondez oui ou non. » **Attends sa réponse.**
3. **Attendre les contrôles.** `node scripts/outils/prod.mjs attendre <numéro>` jusqu'à VERT ou ROUGE. Si ROUGE : lance `/alerter-nicolas` avec l'urgence « prod-cassee ».
4. **Revenir en arrière.** `node scripts/outils/prod.mjs fusionner <numéro>`. Nicolas est prévenu automatiquement.
5. **Vérifier le site en ligne.** `node scripts/outils/prod.mjs suivre` jusqu'à un résultat définitif, puis demande au client d'ouvrir le site en ligne.

Phrase d'état finale, par exemple : « Le site en ligne est revenu à sa version du 12 novembre. Vos modifications sont toujours sur le site de test : dites-moi ce qu'il faut corriger. »
