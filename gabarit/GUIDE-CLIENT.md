# Modifier votre site

Vous modifiez votre site en écrivant à Claude, en français courant. Vous n'avez rien à installer.

## Le principe

Vous avez **deux sites** :

- le **site de test**, où vous voyez vos modifications sans risque ;
- le **site en ligne**, celui que voient vos clients.

Rien n'arrive sur le site en ligne tant que vous n'avez pas tapé `/mise-en-prod`.

## En pratique

1. **Demandez.** « Change les horaires du samedi », « ajoute une page sur nos tarifs », « remplace la photo de l'accueil par celle-ci ».
2. **Regardez.** Claude vous donne l'adresse du site de test. Ouvrez-la sur votre ordinateur et sur votre téléphone.
3. **Corrigez** autant de fois que nécessaire : « le titre est trop long », « remets l'ancienne photo ».
4. **Mettez en ligne** en tapant `/mise-en-prod`. Claude vérifie le site, vous montre ce qui va partir et vous demande de confirmer.

## Les commandes

| Vous tapez | Ce qui se passe |
|---|---|
| `/etat` | Claude vous dit où vous en êtes. |
| `/apercu` | Vos modifications partent sur le site de test. |
| `/verifier` | Claude contrôle le site et vous donne un rapport. |
| `/mise-en-prod` | Le site de test devient le site en ligne. |
| `/retour-en-arriere` | La dernière mise en ligne est annulée. |
| `/annuler-modifs` | Le site de test repart de l'état du site en ligne. |
| `/alerter-nicolas` | Nicolas est prévenu et reçoit le détail de la situation. |
| `/aide` | Affiche cette liste. |

## Bon à savoir

- **Vous ne pouvez rien casser en ligne par accident.** Si un contrôle détecte un problème (lien cassé, page sans titre, formulaire en panne), la mise en ligne est refusée et Claude vous explique pourquoi.
- **Si le site en ligne a un problème** juste après une mise en ligne : tapez `/retour-en-arriere`. Il revient à sa version précédente en quelques minutes.
- **Si vous êtes bloqué** : tapez `/alerter-nicolas`. Vous n'avez pas besoin d'expliquer la technique, Claude s'en charge.
- Certaines modifications (le fonctionnement du formulaire, la structure technique du site) sont réservées à Nicolas. Claude vous le dira et le préviendra.
