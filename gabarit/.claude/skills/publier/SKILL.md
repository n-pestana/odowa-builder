---
name: publier
description: Met EN LIGNE ce qui est sur le site de test. Ne se lance que si le client tape lui-même /publier.
disable-model-invocation: true
allowed-tools: Bash(node scripts/outils/jeton.mjs creer publier) Bash(node scripts/outils/prod.mjs *)
---

!`node scripts/outils/jeton.mjs creer publier`

Le client vient de taper `/publier`. La ligne ci-dessus doit dire « Autorisation du client enregistrée ». Si ce n'est pas le cas, arrête-toi et lance `/prevenir-nicolas`.

Étapes à annoncer au client (CLAUDE.md, « Les attentes ») :
`⏳ Préparation de la publication…` → `⏳ Contrôles automatiques (1 à 3 minutes)…` → *(question de confirmation)* → `⏳ Publication…` → `⏳ Vérification du site en ligne (1 à 3 minutes)…` → `✅ Votre site est en ligne et vérifié`.

Suis ces étapes dans l'ordre. À chaque étape : code 1 = arrête-toi et suis le message ; code 3 = relance la même commande une minute plus tard.

1. **Préparer.** Lance `node scripts/outils/prod.mjs preparer-publication`.
   - « REFUSE » : explique pourquoi au client en français courant et arrête-toi. Il n'existe aucun moyen de forcer.
   - « Rien à mettre en prod » : dis-le et arrête-toi.
   - Sinon, note le numéro de la demande.
2. **Attendre les contrôles.** Lance `node scripts/outils/prod.mjs attendre <numéro>` jusqu'à obtenir VERT ou ROUGE. Si ROUGE : rien n'est mis en ligne, explique et arrête-toi.
3. **Confirmer.** Montre au client ce qui va partir en ligne, traduit en pages (« la page Prestations », « les horaires »), puis pose exactement cette question : « Je mets en ligne ? Répondez oui ou non. » **Attends sa réponse.** Toute réponse autre qu'un oui clair = on ne met pas en ligne.
4. **Mettre en ligne.** Après le oui : `node scripts/outils/prod.mjs fusionner <numéro>`.
   - « BLOQUE » : la modification touche des fichiers réservés à Nicolas. Lance `/prevenir-nicolas` en citant le numéro de la demande.
5. **Vérifier le site en ligne.** Lance `node scripts/outils/prod.mjs suivre` jusqu'à un résultat définitif.
   - Succès : donne l'adresse du site en ligne et demande au client d'y jeter un œil.
   - Échec : Nicolas est déjà alerté automatiquement. Demande au client d'ouvrir le site en ligne ; s'il est cassé, propose-lui de taper `/annuler-publication`.

Termine par la carte d'état (CLAUDE.md). Par exemple : « ✨ Votre site est en ligne et vérifié à 18 h 42. » ou « Rien n'a été mis en ligne : un lien est cassé sur la page Contact. Je peux le corriger. »
