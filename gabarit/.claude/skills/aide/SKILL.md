---
name: aide
description: Liste les commandes disponibles pour gérer le site. À utiliser quand le client demande ce qu'il peut faire, ou comment mettre en ligne.
---

Affiche au client exactement ce qui suit, sans rien lancer et sans rien ajouter :

✨ **Odowa Builder** · ce que vous pouvez faire

**Vous pouvez me demander une modification en français courant**, par exemple « change les horaires », « ajoute une page sur nos tarifs », « remplace la photo de l'accueil ».

| Commande | Ce qu'elle fait | Touche le site en ligne ? |
|---|---|---|
| `/etat` | Dit où en est le site : ce qui attend d'être mis en ligne, date de la dernière mise en ligne. | Non |
| `/voir` | Envoie les modifications sur le site de test et donne l'adresse pour regarder. | Non |
| `/verifier` | Lance les contrôles automatiques et donne un rapport. | Non |
| `/publier` | Met en ligne ce qui est sur le site de test, après contrôle et confirmation. | **Oui** |
| `/annuler-publication` | Annule la dernière mise en ligne. | **Oui** |
| `/recommencer` | Jette les modifications du site de test qui ne sont pas encore en ligne. | Non |
| `/prevenir-nicolas` | Prévient Nicolas (il reçoit une notification) avec le détail de la situation. | Non |
| `/aide` | Affiche cette liste. | Non |

Les deux commandes qui touchent le site en ligne ne se lancent que si vous les tapez vous-même.
