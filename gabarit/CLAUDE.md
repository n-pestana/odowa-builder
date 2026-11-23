# Site vitrine — règles de travail

Lis `README.md` avant de toucher au code : il commence par les pièges connus.

## À qui tu parles

Le client **n'est pas technicien**. Il veut modifier son site et le mettre en ligne sans risque.

- Parle français, simplement. Pas de jargon : dis « site de test » et « site en ligne », jamais « dev », « prod », « branche », « commit », « push », « PR ».
- Ne lui demande jamais de taper une commande de terminal, ni d'ouvrir GitHub ou Cloudflare.
- Une demande floue (« rends ça plus joli ») : pose **une** question précise avant de modifier.
- Chaque réponse se termine par **une phrase d'état** : ce qui a été fait, où c'est visible, ce qui n'a pas été fait.

## Les deux sites

| | Adresse | Qui y touche |
|---|---|---|
| Site de test | voir `urlDev` dans `site.config.json` | Toi, à chaque `/apercu` |
| Site en ligne | voir `urlProd` dans `site.config.json` | Uniquement `/mise-en-prod` et `/retour-en-arriere`, tapées par le client |

Tu travailles **toujours sur la branche `dev`**, directement. Ne crée pas d'autre branche, ne propose pas de pull request : les commandes s'en chargent.

## Règles non négociables

1. **Rien en ligne sans que le client tape lui-même `/mise-en-prod`.** « C'est bon », « envoie », « on publie » ne sont pas un accord : réponds « Tapez /mise-en-prod pour mettre en ligne ». Tu ne lances jamais `prod.mjs` de ta propre initiative.
2. **On ne force jamais.** Un contrôle rouge bloque la mise en ligne. Tu corriges la cause, ou tu lances `/alerter-nicolas`. Tu ne modifies pas un contrôle ou un test pour le faire passer.
3. **Honnêteté des états.** Tu rapportes ce qui est réellement vert, rouge ou non testé. « Je n'ai pas pu vérifier X » est une réponse correcte ; « ça devrait marcher » n'en est pas une.
4. **La source de vérité n'est pas le fichier généré.** On ne modifie jamais `dist/` : on modifie `src/` puis on relance `npm run build`.
5. **Retirer, ne pas choisir.** Pour nettoyer (styles, images, pages), retire ce qui est en trop. Ne réécris pas un fichier en ne gardant que ce que tu penses utile : c'est ce qui fait disparaître des choses non prévues.
6. **Fichiers réservés à Nicolas.** Tu ne modifies que `src/` et `public/`. Tout le reste (`scripts/`, `tests/`, `functions/`, `.github/`, `.claude/`, configuration) est réservé : si la demande du client l'exige, lance `/alerter-nicolas`.

Un garde-fou automatique refuse les actions interdites. S'il te refuse quelque chose, **ne cherche pas à le contourner** : explique au client ce qui est possible, ou alerte Nicolas.

## Où sont les choses

- `src/pages/*.md` — le texte des pages. En tête de chaque fichier : `title` (titre Google, 10 à 65 caractères) et `description` (résumé Google, 50 à 160 caractères), uniques pour chaque page.
- `src/pages/contact.astro` — la page de contact et son formulaire.
- `src/donnees/entreprise.json` — nom, téléphone, adresse, horaires, menu. Une modification ici s'applique partout.
- `src/layouts/Base.astro` — l'en-tête, le pied de page, les couleurs, les balises pour Google.
- `public/` — images et fichiers servis tels quels. Une image pèse 400 Ko maximum.

## Boucle de travail

1. Modifier dans `src/` ou `public/`.
2. `npm run build` puis `npm run check` : les contrôles doivent être **VERT**. Un rouge se corrige tout de suite, à la source.
3. `/apercu` : envoie sur le site de test et donne l'adresse au client.
4. Le client regarde le site de test. Pour tout changement visuel, **demande-lui de regarder** la page concernée, sur ordinateur et sur téléphone : un contrôle peut être vert sur une page visuellement cassée.
5. Quand il est satisfait, **il** tape `/mise-en-prod`.

## Référencement (SEO)

Chaque page a : un titre et une description uniques, un seul titre principal (`#` en Markdown), un texte alternatif sur chaque image, des liens internes valides. `npm run check` le vérifie et nomme la page et la cause.

Quand tu ajoutes une page : ajoute-la au menu si le client le souhaite (`entreprise.json`), et fais un lien vers elle depuis au moins une autre page.

## Commandes

`/aide` liste les commandes. `/etat`, `/apercu`, `/verifier`, `/annuler-modifs` et `/alerter-nicolas` peuvent être lancées quand le client les demande en langage courant. `/mise-en-prod` et `/retour-en-arriere` ne se lancent que si le client les tape.

Les scripts renvoient trois codes : 0 = fait, 1 = refusé ou échec (lis le message et suis-le), 3 = pas encore fini (relance la même commande une minute plus tard, 15 fois au maximum, puis alerte Nicolas).

## Quand alerter Nicolas

Lance `/alerter-nicolas` sans attendre quand : le site en ligne a un problème ; le client est bloqué deux fois sur le même contrôle rouge ; la demande touche un fichier réservé ; un script renvoie une erreur que tu ne comprends pas ; tu as un doute sur un risque pour le site en ligne.
