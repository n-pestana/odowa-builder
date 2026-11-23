#!/usr/bin/env bash
# Verifie, AVANT de creer quoi que ce soit, que la creation d'un client peut aller au bout.
#
#   bash outils/prerequis.sh IDENTIFIANT [--sans-cloudflare]
#
# Appele par nouveau-client.sh juste avant la premiere creation (depot GitHub).
# Raison : la creation n'est pas relancable une fois le depot cree. Tout ce qui
# peut se verifier avant doit l'etre ici.
#
# Ne cree rien. Un seul effet visible : un mail de test vers EMAIL_TEST, qui prouve
# que le domaine de CONTACT_EXPEDITEUR est accepte par Resend.
# Aucun secret n'est affiche ; ils sont passes a curl par l'entree standard.
#
# Pour les tests : USINE_CONFIG et USINE_SECRETS remplacent config.env et secrets.env.

set -uo pipefail
USINE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CONFIG="${USINE_CONFIG:-$USINE/config.env}"
SECRETS="${USINE_SECRETS:-$USINE/secrets.env}"

ID="${1:-}"; SANS_CF=0
[[ "${2:-}" == "--sans-cloudflare" ]] && SANS_CF=1
[[ -n "$ID" ]] || { echo "Usage : bash outils/prerequis.sh IDENTIFIANT [--sans-cloudflare]"; exit 1; }
PROJET="site-$ID"

REFUS=0
ok() { echo "   OK      $1"; }
refus() { echo "   REFUS   $1"; REFUS=$((REFUS + 1)); }

[[ -f "$CONFIG" ]] || { echo "   REFUS   config.env absent"; exit 1; }
[[ -f "$SECRETS" ]] || { echo "   REFUS   secrets.env absent"; exit 1; }
set -a; . "$CONFIG"; . "$SECRETS"; set +a

# --- 1. Valeurs presentes ----------------------------------------------------------
OBLIGATOIRES=(PROPRIETAIRE LOGIN_NICOLAS CONTACT_SECOURS EMAIL_TEST CONTACT_EXPEDITEUR CLOUDFLARE_API_TOKEN RESEND_API_KEY)
[[ "$SANS_CF" -eq 0 ]] && OBLIGATOIRES+=(CLOUDFLARE_ACCOUNT_ID)
VIDES=()
for V in "${OBLIGATOIRES[@]}"; do [[ -n "${!V:-}" ]] || VIDES+=("$V"); done
if [[ "${#VIDES[@]}" -eq 0 ]]; then ok "valeurs obligatoires remplies"; else refus "valeurs vides : ${VIDES[*]}"; fi

# --- 2. Pas de valeur d'exemple (config.env seulement : pas de secret affiche) -----
EXEMPLES="$(grep -nE 'exemple\.fr|ton-domaine\.fr|06 00 00 00 00' "$CONFIG" | grep -v '^[0-9]*:#' | cut -d= -f1 | cut -d: -f2 | tr '\n' ' ')"
if [[ -z "$EXEMPLES" ]]; then ok "aucune valeur d'exemple dans config.env"; else refus "valeurs d'exemple dans config.env : $EXEMPLES"; fi

# --- 3. GitHub : connexion et droit de pousser des workflows ---------------------
ETAT_GH="$(gh auth status 2>&1)"
if ! grep -q 'Logged in' <<<"$ETAT_GH"; then
  refus "gh n'est pas connecte : gh auth login"
elif grep -qi "scopes:.*'workflow'" <<<"$ETAT_GH"; then
  ok "gh connecte, scope workflow present"
else
  refus "le jeton gh n'a pas le scope workflow (le premier push serait refuse) : gh auth refresh -h github.com -s workflow"
fi

# --- 4. Git : identification HTTPS par gh ----------------------------------------
if [[ -n "$(git config --get-urlmatch credential.helper https://github.com 2>/dev/null)" ]]; then
  ok "assistant d'identification git configure pour https://github.com"
else
  refus "aucun assistant d'identification git pour https://github.com (le push HTTPS echouerait) : gh auth setup-git"
fi

# --- Appel HTTP : jeton par l'entree standard, code HTTP en sortie ------------------
http() { # http JETON METHODE URL [CORPS] -> affiche le code HTTP
  local corps=()
  [[ -n "${4:-}" ]] && corps=(-H 'Content-Type: application/json' --data "$4")
  printf 'header = "Authorization: Bearer %s"\n' "$1" \
    | curl -sS -K - -X "$2" -o /dev/null -w '%{http_code}' "${corps[@]}" "$3" 2>/dev/null || true
}

# --- 5. Cloudflare : jeton valide sur Pages, nom du projet libre -----------------
if [[ "$SANS_CF" -eq 1 ]]; then
  ok "Cloudflare non verifie (--sans-cloudflare)"
elif [[ -n "${CLOUDFLARE_API_TOKEN:-}" && -n "${CLOUDFLARE_ACCOUNT_ID:-}" ]]; then
  BASE="https://api.cloudflare.com/client/v4/accounts/$CLOUDFLARE_ACCOUNT_ID/pages/projects"
  CODE="$(http "$CLOUDFLARE_API_TOKEN" GET "$BASE")"
  if [[ "$CODE" == 200 ]]; then
    ok "jeton Cloudflare accepte sur les projets Pages du compte"
    CODE="$(http "$CLOUDFLARE_API_TOKEN" GET "$BASE/$PROJET")"
    case "$CODE" in
      404) ok "nom de projet Pages $PROJET libre" ;;
      200) refus "le projet Pages $PROJET existe deja sur le compte" ;;
      *)   refus "existence du projet Pages $PROJET : reponse HTTP $CODE" ;;
    esac
  else
    refus "jeton Cloudflare refuse sur les projets Pages (HTTP $CODE) : verifier CLOUDFLARE_ACCOUNT_ID et la permission Pages Write"
  fi
fi

# --- 6. Resend : le domaine d'expedition est accepte ------------------------------
if [[ -n "${RESEND_API_KEY:-}" && -n "${CONTACT_EXPEDITEUR:-}" && -n "${EMAIL_TEST:-}" ]]; then
  CORPS="$(ID="$ID" node -e 'const e=process.env;console.log(JSON.stringify({from:e.CONTACT_EXPEDITEUR,to:[e.EMAIL_TEST],subject:`Usine : verification avant creation de ${e.ID}`,text:`Mail de test envoye par outils/prerequis.sh avant la creation du client ${e.ID}. Aucune action requise.`}))')"
  CODE="$(http "$RESEND_API_KEY" POST https://api.resend.com/emails "$CORPS")"
  if [[ "$CODE" == 200 ]]; then
    ok "Resend accepte l'expediteur (mail de test envoye a $EMAIL_TEST)"
  else
    refus "Resend refuse l'envoi depuis l'expediteur (HTTP $CODE) : domaine non valide, ou cle invalide"
  fi
fi

echo
if [[ "$REFUS" -eq 0 ]]; then
  echo "PREREQUIS VERTS - la creation peut commencer."
else
  echo "PREREQUIS ROUGES - $REFUS point(s) a corriger. Rien n'a ete cree."
  exit 1
fi
