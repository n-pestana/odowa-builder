---
name: mise-en-prod
description: Met EN LIGNE ce qui est sur le site de test. Ne se lance que si le client tape lui-même /mise-en-prod.
disable-model-invocation: true
allowed-tools: Bash(node scripts/outils/jeton.mjs creer mise-en-prod) Bash(node scripts/outils/prod.mjs *)
---

!`node scripts/outils/jeton.mjs creer mise-en-prod`

Le client vient de taper `/mise-en-prod`. La ligne ci-dessus doit dire « Autorisation du client enregistrée ». Si ce n'est pas le cas, arrête-toi et lance `/alerter-nicolas`.

Suis ces étapes dans l'ordre. À chaque étape : code 1 = arrête-toi et suis le message ; code 3 = relance la même commande une minute plus tard.

1. **Préparer.** Lance `node scripts/outils/prod.mjs preparer-mise-en-prod`.
   - « REFUSE » : explique pourquoi au client en français courant et arrête-toi. Il n'existe aucun moyen de forcer.
   - « Rien à mettre en prod » : dis-le et arrête-toi.
   - Sinon, note le numéro de la demande.
2. **Attendre les contrôles.** Lance `node scripts/outils/prod.mjs attendre <numéro>` jusqu'à obtenir VERT ou ROUGE. Si ROUGE : rien n'est mis en ligne, explique et arrête-toi.
3. **Confirmer.** Montre au client ce qui va partir en ligne, traduit en pages (« la page Prestations », « les horaires »), puis pose exactement cette question : « Je mets en ligne ? Répondez oui ou non. » **Attends sa réponse.** Toute réponse autre qu'un oui clair = on ne met pas en ligne.
4. **Mettre en ligne.** Après le oui : `node scripts/outils/prod.mjs fusionner <numéro>`.
   - « BLOQUE » : la modification touche des fichiers réservés à Nicolas. Lance `/alerter-nicolas` en citant le numéro de la demande.
5. **Vérifier le site en ligne.** Lance `node scripts/outils/prod.mjs suivre` jusqu'à un résultat définitif.
   - Succès : donne l'adresse du site en ligne et demande au client d'y jeter un œil.
   - Échec : Nicolas est déjà alerté automatiquement. Demande au client d'ouvrir le site en ligne ; s'il est cassé, propose-lui de taper `/retour-en-arriere`.

Phrase d'état finale, par exemple : « Le site en ligne est à jour et vérifié à 18 h 42. » ou « Rien n'a été mis en ligne : le contrôle des liens est rouge sur la page Contact. »
