#!/usr/bin/env bash
# Mise en route d'un client deja cree, en une commande (etape B de MISE-EN-ROUTE.md).
#
#   bash outils/onboarder.sh IDENTIFIANT LOGIN-GITHUB-DU-CLIENT EMAIL-DU-CLIENT
#
# 1. Verifie tout avant de toucher a quoi que ce soit : fiche du client, adresse, compte GitHub
#    existant, projet Cloudflare joignable.
# 2. Invite le compte GitHub du client sur son depot, role ecriture.
# 3. Regle l'adresse de reception du formulaire en production (CONTACT_EMAIL), verifie que les
#    autres variables sont intactes, puis redeploie le site en ligne pour qu'elle prenne effet.
# 4. Inscrit le login et l'adresse dans clients/IDENTIFIANT.json.
# 5. Affiche le favori et le mail de bienvenue, remplis.
#
# Aucun secret n'est affiche ; le jeton Cloudflare passe a curl par l'entree standard.
# Pour les tests : USINE_CONFIG, USINE_SECRETS et USINE_CLIENTS remplacent config.env,
# secrets.env et clients/.

set -uo pipefail
USINE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CONFIG="${USINE_CONFIG:-$USINE/config.env}"
SECRETS="${USINE_SECRETS:-$USINE/secrets.env}"
CLIENTS="${USINE_CLIENTS:-$USINE/clients}"

ID="${1:-}"; LOGIN="${2:-}"; EMAIL="${3:-}"
[[ -n "$ID" && -n "$LOGIN" && -n "$EMAIL" ]] || { echo "Usage : bash outils/onboarder.sh IDENTIFIANT LOGIN-GITHUB EMAIL-DU-CLIENT"; exit 1; }

refuser() { echo "   REFUS   $1"; echo; echo "RIEN N'A ETE MODIFIE."; exit 1; }
fait() { echo "   FAIT    $1"; }
ECHECS=0
echec() { echo "   ECHEC   $1"; ECHECS=$((ECHECS + 1)); }

# --- 1. Verifications (aucune modification) ----------------------------------------
echo "== Verifications"
FICHE="$CLIENTS/$ID.json"
[[ -f "$FICHE" ]] || refuser "client inconnu : pas de fiche $FICHE (le creer avec nouveau-client.sh)"
[[ -f "$CONFIG" && -f "$SECRETS" ]] || refuser "config.env ou secrets.env absent"
set -a; . "$CONFIG"; . "$SECRETS"; set +a
lire() { node -e "const v=JSON.parse(require('fs').readFileSync(process.argv[1],'utf8'))[process.argv[2]];console.log(v??'')" "$FICHE" "$1"; }
DEPOT="$(lire depot)"; PROJET="$(lire projetCloudflare)"; NOM="$(lire nom)"; DOMAINE="$(lire domaine)"

[[ "$EMAIL" =~ ^[^@[:space:]]+@[^@[:space:]]+\.[A-Za-z]{2,}$ ]] || refuser "adresse e-mail invalide : $EMAIL"
[[ "$LOGIN" =~ ^[A-Za-z0-9]([A-Za-z0-9-]{0,38})$ ]] || refuser "login GitHub invalide : $LOGIN"
gh api "users/$LOGIN" --jq .login >/dev/null 2>&1 || refuser "le compte GitHub $LOGIN n'existe pas (le client doit d'abord le creer)"
gh api "repos/$DEPOT" --jq .full_name >/dev/null 2>&1 || refuser "depot $DEPOT introuvable, ou gh non connecte"

http() { # http METHODE URL [FICHIER-CORPS] [FICHIER-SORTIE] -> code HTTP ; jeton par l'entree standard
  local extra=()
  [[ -n "${3:-}" ]] && extra+=(-H 'Content-Type: application/json' --data "@$3")
  printf 'header = "Authorization: Bearer %s"\n' "$CLOUDFLARE_API_TOKEN" \
    | curl -sS -K - -X "$1" -o "${4:-/dev/null}" -w '%{http_code}' "${extra[@]}" "$2" 2>/dev/null || true
}
URL_PROJET="https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID:-}/pages/projects/$PROJET"
TRAVAIL="$(mktemp -d)"; chmod 700 "$TRAVAIL"; trap 'rm -rf "$TRAVAIL"' EXIT
[[ "$(http GET "$URL_PROJET" "" "$TRAVAIL/avant.json")" == 200 ]] || refuser "projet Cloudflare $PROJET injoignable (jeton, compte ou nom)"
echo "   OK      fiche $ID, adresse, compte GitHub $LOGIN, depot $DEPOT, projet Cloudflare $PROJET"

# --- 2. Acces GitHub -----------------------------------------------------------------
echo "== Acces du client"
if gh api -X PUT "repos/$DEPOT/collaborators/$LOGIN" -f permission=push >/dev/null 2>"$TRAVAIL/gh.err"; then
  fait "$LOGIN invite sur $DEPOT, role ecriture (il accepte l'invitation recue par mail)"
else
  echec "invitation de $LOGIN : $(cat "$TRAVAIL/gh.err")"
fi

# --- 3. Adresse du formulaire --------------------------------------------------------
echo "== Formulaire du site en ligne"
EMAIL="$EMAIL" node -e 'console.log(JSON.stringify({deployment_configs:{production:{env_vars:{CONTACT_EMAIL:{type:"plain_text",value:process.env.EMAIL}}}}}))' >"$TRAVAIL/corps.json"
if [[ "$(http PATCH "$URL_PROJET" "$TRAVAIL/corps.json")" == 200 && "$(http GET "$URL_PROJET" "" "$TRAVAIL/apres.json")" == 200 ]]; then
  # Les autres variables doivent etre intactes : un PATCH mal forme pourrait les effacer.
  VERIF="$(EMAIL="$EMAIL" node -e '
    const v = JSON.parse(require("fs").readFileSync(process.argv[1], "utf8")).result.deployment_configs.production.env_vars ?? {};
    const attendues = ["CONTACT_EXPEDITEUR", "RESEND_API_KEY", "TURNSTILE_SECRET", "CONTACT_JETON_TEST", "CONTACT_EMAIL_TEST"];
    const manquantes = attendues.filter((k) => !v[k]);
    if (v.CONTACT_EMAIL?.value !== process.env.EMAIL) console.log("CONTACT_EMAIL n'\''a pas la nouvelle valeur");
    else if (manquantes.length) console.log("variables disparues : " + manquantes.join(", "));
    else console.log("OK");' "$TRAVAIL/apres.json")"
  if [[ "$VERIF" == OK ]]; then
    fait "messages du formulaire en ligne -> $EMAIL (autres variables intactes)"
    RUN="$(gh run list -R "$DEPOT" --workflow prod.yml --branch main --limit 1 --json databaseId --jq '.[0].databaseId' 2>/dev/null)"
    if [[ -n "$RUN" ]] && gh run rerun "$RUN" -R "$DEPOT" >/dev/null 2>"$TRAVAIL/gh.err"; then
      fait "site en ligne redeploye pour appliquer l'adresse (run $RUN, environ 3 minutes ; suivre : gh run watch $RUN -R $DEPOT)"
    else
      echec "redeploiement du site en ligne : l'adresse ne s'appliquera qu'a la prochaine publication. $(cat "$TRAVAIL/gh.err" 2>/dev/null)"
    fi
  else
    echec "verification Cloudflare apres reglage : $VERIF"
  fi
else
  echec "reglage de CONTACT_EMAIL sur le projet Cloudflare $PROJET"
fi

# --- 4. Fiche du client ----------------------------------------------------------------
node -e "const f=process.argv[1],fs=require('fs');const c=JSON.parse(fs.readFileSync(f,'utf8'));c.clientGithub=process.argv[2];c.emailClient=process.argv[3];fs.writeFileSync(f,JSON.stringify(c,null,2)+'\n')" "$FICHE" "$LOGIN" "$EMAIL" \
  && fait "fiche clients/$ID.json mise a jour (a committer dans l'usine)"

# --- 5. Favori et mail de bienvenue -----------------------------------------------------
FAVORI="https://claude.ai/code?repositories=$DEPOT&prompt=Bonjour"
cat <<TEXTE

== A copier
Favori « ✨ Mon site » (ordinateur et telephone) :
$FAVORI

Mail de bienvenue (a $EMAIL) :
-------------------------------------------------------------------
Objet : Votre site est prêt ✨

Bonjour,

Votre site $NOM est en ligne : https://$DOMAINE

Pour le modifier, cliquez sur votre favori « ✨ Mon site » ($FAVORI) et appuyez sur Entrée. Ensuite, écrivez ce que vous voulez changer, en français courant : « change les horaires du samedi », « ajoute une page sur nos tarifs ».

Vos modifications arrivent d'abord sur votre site de test, que vos visiteurs ne voient pas. Quand tout vous plaît, tapez /publier : le site est vérifié automatiquement, puis mis en ligne.

Trois choses à retenir :
- /aide affiche tout ce que vous pouvez faire ;
- /annuler-publication remet la version précédente si quelque chose ne vous plaît pas en ligne ;
- /prevenir-nicolas me prévient si vous êtes bloqué.

Les couleurs vous disent où vous en êtes : 🟢 tout va bien, 🟡 c'est à vous de jouer, ⏳ un instant, 🔴 quelque chose bloque.

Vous ne pouvez rien casser : rien n'est mis en ligne sans votre /publier, et un site qui ne passe pas les contrôles n'est jamais publié.

À bientôt,
Nicolas PESTANA, Odowa Builder
-------------------------------------------------------------------
TEXTE

echo
if [[ "$ECHECS" -eq 0 ]]; then
  echo "ONBOARDING TERMINE - reste au client : accepter l'invitation GitHub, relier GitHub dans claude.ai/code."
else
  echo "ONBOARDING INCOMPLET - $ECHECS etape(s) en echec, voir ci-dessus. Relancable sans risque."
  exit 1
fi
