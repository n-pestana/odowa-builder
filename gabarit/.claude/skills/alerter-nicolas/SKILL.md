---
name: alerter-nicolas
description: Prévient Nicolas par une notification, avec le détail de la situation. À utiliser quand le client demande de l'aide humaine, quand le site en ligne a un problème, quand le client est bloqué, ou quand une demande touche un fichier réservé.
argument-hint: [message pour Nicolas]
allowed-tools: Bash(node scripts/outils/alerter.mjs *)
---

Préviens Nicolas. Message du client, s'il en a donné un : $ARGUMENTS

1. Choisis l'urgence :
   - `prod-cassee` : le site en ligne est cassé, inaccessible, ou affiche quelque chose de faux.
   - `bloque` : le client ne peut pas avancer (contrôle rouge qu'on ne sait pas corriger, fichier réservé, erreur d'un script).
   - `question` : tout le reste.
2. Rédige un message court et factuel pour Nicolas, qui est développeur : ce que le client voulait faire (avec ses mots), ce qui s'est passé, le message d'erreur exact s'il y en a un, ce que tu as déjà essayé. Pas de supposition présentée comme un fait.
3. Lance `node scripts/outils/alerter.mjs --urgence <urgence> --message "<message>"`. L'état du site est joint automatiquement.

Dis ensuite au client que Nicolas est prévenu et donne le numéro du ticket. Si l'envoi a **échoué**, dis-le clairement et donne les coordonnées de secours affichées par le script : ne laisse jamais le client croire que Nicolas est prévenu s'il ne l'est pas.

Si l'urgence est `prod-cassee` et que la dernière mise en ligne est récente, rappelle au client qu'il peut taper `/retour-en-arriere`.
