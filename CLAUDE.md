# odowa-builder — dépôt d'administration

Tu travailles avec **Nicolas**, le développeur qui conçoit et maintient cette usine à sites. Il est technicien : parle-lui directement, avec les termes exacts.

Ce dépôt n'est pas un site client. `gabarit/CLAUDE.md` s'adresse aux sessions des clients, pas à toi : ne l'applique pas ici.

## À lire d'abord

1. `README.md` — structure de l'usine, qui possède quoi, pièges de l'usine.
2. `gabarit/README.md` — architecture et pièges du gabarit.
3. `BRIEF-MAINTENANCE.md` — s'il existe une mission de validation en cours.

## Règles

1. **Honnêteté des états.** Vert, rouge ou non testé. Ce que tu n'as pas vu tourner est non testé.
2. **On ne rend jamais un contrôle vert en l'affaiblissant.** Pas de test supprimé, de tolérance élargie, de `|| true` ou de `continue-on-error` pour passer au vert.
3. **Tout contrôle est testé à l'envers**, tout cas du garde-fou a un cas refusé et un cas autorisé, toute promesse d'un outil a sa vérification dans `outils/test-simulation.sh`.
4. **On corrige dans `gabarit/`, jamais dans le dépôt d'un client.** Puis on diffuse avec `outils/mettre-a-jour-client.sh`.
5. **Aucun secret lu, affiché, ni écrit ailleurs que dans `secrets.env`.** Tu ne fais jamais `cat secrets.env`. Pour saisir un secret, donne à Nicolas la commande à lancer lui-même.
6. **Demande avant** toute action qui crée, modifie ou supprime quelque chose sur GitHub ou Cloudflare hors de ce dépôt, et avant toute dépense.
7. **Chaque piège rencontré est consigné** : dans `README.md` s'il concerne l'usine, dans `gabarit/README.md` s'il concerne le gabarit. Symptôme, cause racine, réflexe.

## Avant chaque push de l'usine

```bash
(cd gabarit && npm run build && npm run check && npm run check:envers && npm run check:hook)
bash outils/test-simulation.sh
```
