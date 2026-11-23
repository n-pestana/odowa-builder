#!/usr/bin/env bash
# Cree le site d'un nouveau client : depot GitHub, reglages, secrets, projet Cloudflare Pages.
#
#   outils/nouveau-client.sh IDENTIFIANT "Nom affiche" DOMAINE [options]
#
#   IDENTIFIANT          minuscules, chiffres, tirets (ex. : plomberie-martin)
#   DOMAINE              domaine du site en ligne (ex. : www.plomberie-martin.fr)
#
# Options :
#   --email-client ADRESSE   boite qui recevra les messages du formulaire en ligne
#   --client-github LOGIN    compte GitHub du client a inviter en ecriture
#   --sans-cloudflare        ne cree pas le projet Pages (a faire plus tard)
#   --sans-verification      ne lance pas build et controles avant de pousser
#   --simulation DOSSIER     prepare le site dans DOSSIER et s'arrete la : rien sur GitHub ni Cloudflare
#
# Le depot cree s'appelle PROPRIETAIRE/site-IDENTIFIANT, le projet Pages site-IDENTIFIANT.
# Valeurs communes : config.env. Secrets : secrets.env (jamais versionne).

set -uo pipefail
USINE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# Pour les tests : USINE_CONFIG et USINE_SECRETS remplacent config.env et secrets.env.
CONFIG="${USINE_CONFIG:-$USINE/config.env}"
SECRETS="${USINE_SECRETS:-$USINE/secrets.env}"

ID="${1:-}"; NOM="${2:-}"; DOMAINE="${3:-}"
[[ $# -ge 3 ]] && shift 3 || shift $#
EMAIL_CLIENT=""; CLIENT_GITHUB=""; SANS_CF=0; SANS_VERIF=0; SIMULATION=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --email-client) EMAIL_CLIENT="${2:-}"; shift 2 ;;
    --client-github) CLIENT_GITHUB="${2:-}"; shift 2 ;;
    --sans-cloudflare) SANS_CF=1; shift ;;
    --sans-verification) SANS_VERIF=1; shift ;;
    --simulation) SIMULATION="${2:-}"; shift 2 ;;
    *) echo "Option inconnue : $1"; exit 1 ;;
  esac
done

if [[ ! "$ID" =~ ^[a-z0-9]([a-z0-9-]*[a-z0-9])?$ || -z "$NOM" || ! "$DOMAINE" =~ ^[a-z0-9.-]+\.[a-z]{2,}$ ]]; then
  sed -n '2,19p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'
  exit 1
fi

FAITS=(); ECHECS=(); MANUELS=()
etape() { printf '\n== %s\n' "$1"; }
fait() { echo "   FAIT    $1"; FAITS+=("$1"); }
echec() { echo "   ECHEC   $1"; ECHECS+=("$1"); }
manuel() { MANUELS+=("$1"); }
fatal() { echo "   ARRET   $1"; bilan; exit 1; }
bilan() {
  printf '\n================ BILAN : %s ================\n' "$ID"
  printf 'FAIT (%s)\n' "${#FAITS[@]}"; for x in "${FAITS[@]:-}"; do [[ -n "$x" ]] && echo "  - $x"; done
  printf 'ECHEC (%s)\n' "${#ECHECS[@]}"; for x in "${ECHECS[@]:-}"; do [[ -n "$x" ]] && echo "  - $x"; done
  printf 'RESTE A FAIRE A LA MAIN (%s)\n' "${#MANUELS[@]}"; for x in "${MANUELS[@]:-}"; do [[ -n "$x" ]] && echo "  - $x"; done
}

# --- Configuration ---------------------------------------------------------------
etape "Configuration"
[[ -f "$CONFIG" ]] || { echo "   config.env absent : copier config.exemple.env en config.env et le remplir."; exit 1; }
set -a; . "$CONFIG"; set +a
for V in PROPRIETAIRE LOGIN_NICOLAS CONTACT_SECOURS; do
  [[ -n "${!V:-}" ]] || { echo "   $V est vide dans config.env."; exit 1; }
done
DEPOT="$PROPRIETAIRE/site-$ID"
PROJET="site-$ID"
URL_PROD="https://$DOMAINE"
URL_DEV="https://dev.$PROJET.pages.dev"
VERSION_GABARIT="$(git -C "$USINE" rev-parse --short HEAD 2>/dev/null || echo inconnue)"
fait "client $ID -> depot $DEPOT, projet Pages $PROJET, gabarit $VERSION_GABARIT"

# --- 1. Preparer le site ---------------------------------------------------------
etape "Preparation du site a partir du gabarit"
if [[ -n "$SIMULATION" ]]; then
  [[ -e "$SIMULATION" ]] && { echo "   $SIMULATION existe deja."; exit 1; }
  TRAVAIL="$SIMULATION"; mkdir -p "$TRAVAIL"
else
  TRAVAIL="$(mktemp -d)/site-$ID"; mkdir -p "$TRAVAIL"
fi
cp -R "$USINE/gabarit/." "$TRAVAIL/"
rm -rf "$TRAVAIL/node_modules" "$TRAVAIL/dist" "$TRAVAIL/.astro" "$TRAVAIL/.wrangler" "$TRAVAIL/.rapports" "$TRAVAIL/test-results"

NOM="$NOM" URL_PROD="$URL_PROD" URL_DEV="$URL_DEV" DEPOT="$DEPOT" VERSION_GABARIT="$VERSION_GABARIT" node - "$TRAVAIL" <<'JS' || fatal "remplissage des fichiers du client"
const fs = require('fs'), path = require('path');
const dossier = process.argv[2], e = process.env;
const ecrire = (f, o) => fs.writeFileSync(path.join(dossier, f), JSON.stringify(o, null, 2) + '\n');
const lire = (f) => JSON.parse(fs.readFileSync(path.join(dossier, f), 'utf8'));

const config = lire('site.config.json');
Object.assign(config, { nomSite: e.NOM, urlProd: e.URL_PROD, urlDev: e.URL_DEV, depot: e.DEPOT, contactNicolas: e.LOGIN_NICOLAS, contactSecours: e.CONTACT_SECOURS });
ecrire('site.config.json', config);

const entreprise = lire('src/donnees/entreprise.json');
entreprise.nom = e.NOM;
ecrire('src/donnees/entreprise.json', entreprise);

const proprietaires = path.join(dossier, '.github/CODEOWNERS');
fs.writeFileSync(proprietaires, fs.readFileSync(proprietaires, 'utf8').replaceAll('@LOGIN-GITHUB-DE-NICOLAS', '@' + e.LOGIN_NICOLAS));
fs.writeFileSync(path.join(dossier, '.gabarit-version'), e.VERSION_GABARIT + '\n');
JS
if grep -rq 'LOGIN-GITHUB-DE-NICOLAS\|PROPRIETAIRE/NOM-DU-DEPOT' "$TRAVAIL/site.config.json" "$TRAVAIL/.github/CODEOWNERS"; then
  fatal "il reste des valeurs non remplies dans site.config.json ou CODEOWNERS"
fi
fait "fichiers du client remplis (site.config.json, CODEOWNERS, nom de l'entreprise)"
manuel "Remplacer le contenu d'exemple : src/pages/, src/donnees/entreprise.json, public/favicon.svg"

# --- 2. Verifier avant de pousser -------------------------------------------------
if [[ "$SANS_VERIF" -eq 0 ]]; then
  etape "Build et controles (quelques minutes)"
  if (cd "$TRAVAIL" && npm ci --no-audit --no-fund >/dev/null 2>&1 && npm run -s build >/dev/null 2>&1 \
      && npm run -s check && npm run -s check:envers | tail -1 && npm run -s check:hook | tail -1); then
    fait "build et controles verts sur le site du client"
  else
    fatal "build ou controles rouges : rien n'a ete cree. Corriger le gabarit d'abord."
  fi
fi

# Favori du client : ouvre claude.ai/code sur son depot, « Bonjour » pre-rempli (il appuie sur Entree).
# Parametres NON documentes par Anthropic, constates le 23/11/2026 (README de l'usine, piege 12).
FAVORI="https://claude.ai/code?repositories=$DEPOT&prompt=Bonjour"

if [[ -n "$SIMULATION" ]]; then
  echo; echo "SIMULATION : site prepare dans $TRAVAIL. Rien n'a ete cree sur GitHub ni Cloudflare."
  echo "Favori du client : $FAVORI"
  bilan; exit 0
fi

# --- 3. Prerequis : rien n'est cree tant qu'ils ne sont pas tous verts ------------
etape "Prerequis (rien n'est encore cree)"
OPTION_CF=(); [[ "$SANS_CF" -eq 1 ]] && OPTION_CF=(--sans-cloudflare)
bash "$USINE/outils/prerequis.sh" "$ID" "${OPTION_CF[@]}" || fatal "prerequis rouges : rien n'a ete cree sur GitHub ni Cloudflare."
fait "prerequis verts"

etape "Secrets"
[[ -f "$SECRETS" ]] || fatal "secrets.env absent : copier secrets.exemple.env en secrets.env et le remplir."
set -a; . "$SECRETS"; set +a
[[ -n "${CLOUDFLARE_API_TOKEN:-}" ]] || fatal "CLOUDFLARE_API_TOKEN est vide dans secrets.env."
JETON_TEST="$(openssl rand -hex 24)"
fait "secrets charges (aucune valeur n'est affichee)"

# --- 4. Depot GitHub -------------------------------------------------------------
etape "Depot GitHub"
gh auth status >/dev/null 2>&1 || fatal "gh n'est pas connecte : gh auth login"
gh api "repos/$DEPOT" >/dev/null 2>&1 && fatal "le depot $DEPOT existe deja. Pour le mettre a jour : outils/mettre-a-jour-client.sh $ID"
gh repo create "$DEPOT" --private --description "Site de $NOM" >/dev/null 2>/tmp/nouveau-client.err || fatal "creation du depot : $(cat /tmp/nouveau-client.err)"
fait "depot prive $DEPOT cree"

# Secrets et variables AVANT le premier push, pour que les premiers deploiements passent.
definir_secret() { printf '%s' "$2" | gh secret set "$1" --repo "$DEPOT" >/dev/null 2>/tmp/nouveau-client.err && fait "secret GitHub $1" || echec "secret GitHub $1 : $(cat /tmp/nouveau-client.err)"; }
definir_variable() { gh variable set "$1" --repo "$DEPOT" --body "$2" >/dev/null 2>/tmp/nouveau-client.err && fait "variable GitHub $1" || echec "variable GitHub $1 : $(cat /tmp/nouveau-client.err)"; }
definir_secret CLOUDFLARE_API_TOKEN "$CLOUDFLARE_API_TOKEN"
definir_secret CONTACT_JETON_TEST "$JETON_TEST"
definir_variable CLOUDFLARE_ACCOUNT_ID "${CLOUDFLARE_ACCOUNT_ID:-}"
definir_variable CLOUDFLARE_PROJET "$PROJET"
[[ -n "${TURNSTILE_SITEKEY:-}" ]] && definir_variable TURNSTILE_SITEKEY "$TURNSTILE_SITEKEY"

# --- 5. Cloudflare Pages ---------------------------------------------------------
if [[ "$SANS_CF" -eq 1 ]]; then
  manuel "Creer le projet Cloudflare Pages $PROJET et ses variables (option --sans-cloudflare utilisee)"
else
  etape "Cloudflare Pages"
  [[ -n "${CLOUDFLARE_ACCOUNT_ID:-}" ]] || fatal "CLOUDFLARE_ACCOUNT_ID est vide dans config.env."
  if (cd "$TRAVAIL" && npx --yes wrangler pages project create "$PROJET" --production-branch=main >/dev/null 2>/tmp/nouveau-client.err); then
    fait "projet Pages $PROJET cree (branche de production : main)"
  else
    echec "creation du projet Pages : $(tail -3 /tmp/nouveau-client.err)"
  fi

  # Variables du formulaire, par environnement. Sur le site de test, les messages vont a Nicolas.
  CORPS="$(mktemp)"; chmod 600 "$CORPS"
  EMAIL_CLIENT="${EMAIL_CLIENT:-${EMAIL_TEST:-}}" JETON_TEST="$JETON_TEST" node - >"$CORPS" <<'JS'
const e = process.env;
const texte = (value) => ({ type: 'plain_text', value });
const secret = (value) => ({ type: 'secret_text', value });
const communs = {};
if (e.CONTACT_EXPEDITEUR) communs.CONTACT_EXPEDITEUR = texte(e.CONTACT_EXPEDITEUR);
if (e.RESEND_API_KEY) communs.RESEND_API_KEY = secret(e.RESEND_API_KEY);
if (e.TURNSTILE_SECRET) communs.TURNSTILE_SECRET = secret(e.TURNSTILE_SECRET);
const production = { ...communs, CONTACT_JETON_TEST: secret(e.JETON_TEST) };
if (e.EMAIL_CLIENT) production.CONTACT_EMAIL = texte(e.EMAIL_CLIENT);
if (e.EMAIL_TEST) production.CONTACT_EMAIL_TEST = texte(e.EMAIL_TEST);
const preview = { ...communs };
if (e.EMAIL_TEST) preview.CONTACT_EMAIL = texte(e.EMAIL_TEST);
console.log(JSON.stringify({ deployment_configs: { production: { env_vars: production }, preview: { env_vars: preview } } }));
JS
  if curl -fsS -X PATCH "https://api.cloudflare.com/client/v4/accounts/$CLOUDFLARE_ACCOUNT_ID/pages/projects/$PROJET" \
      -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" -H "Content-Type: application/json" --data @"$CORPS" >/dev/null 2>/tmp/nouveau-client.err; then
    fait "variables du formulaire posees sur le projet Pages (production et site de test)"
  else
    echec "variables du projet Pages : $(cat /tmp/nouveau-client.err)"
  fi
  rm -f "$CORPS"
  [[ -z "${RESEND_API_KEY:-}" ]] && manuel "RESEND_API_KEY est vide dans secrets.env : le formulaire ne pourra pas envoyer de mail"
  [[ -z "${CONTACT_EXPEDITEUR:-}" ]] && manuel "CONTACT_EXPEDITEUR est vide dans config.env : le formulaire ne pourra pas envoyer de mail"
  [[ "$DOMAINE" == *.pages.dev ]] || manuel "Brancher le domaine $DOMAINE sur le projet Pages $PROJET (DNS)"
fi
[[ -z "$EMAIL_CLIENT" ]] && manuel "Aucun --email-client : les messages du formulaire en ligne arrivent chez toi. Mettre CONTACT_EMAIL a l'adresse du client dans Cloudflare (Production)"

# --- 6. Premier envoi ------------------------------------------------------------
etape "Premier envoi du site"
if (cd "$TRAVAIL" && git init -q -b main && git add -A \
    && git -c user.name="${GIT_NOM:-$LOGIN_NICOLAS}" -c user.email="${GIT_EMAIL:-$LOGIN_NICOLAS@users.noreply.github.com}" commit -q -m "Version initiale (gabarit $VERSION_GABARIT)" \
    && git remote add origin "https://github.com/$DEPOT.git" && git push -q -u origin main \
    && git switch -q -c dev && git push -q -u origin dev) 2>/tmp/nouveau-client.err; then
  fait "branches main et dev poussees (les deploiements demarrent)"
else
  fatal "premier envoi : $(tail -5 /tmp/nouveau-client.err)"
fi

# --- 7. Reglages du depot --------------------------------------------------------
etape "Reglages du depot"
if bash "$USINE/outils/github.sh" "$DEPOT" $CLIENT_GITHUB | sed 's/^/   /'; [[ "${PIPESTATUS[0]}" -eq 0 ]]; then
  fait "branche par defaut, fusion squash, protection de main, etiquettes"
else
  echec "reglages du depot incomplets (voir le detail ci-dessus)"
fi
[[ -z "$CLIENT_GITHUB" ]] && manuel "Inviter le client quand son compte GitHub existe : bash outils/github.sh $DEPOT LOGIN-DU-CLIENT"

# --- 8. Registre -----------------------------------------------------------------
mkdir -p "$USINE/clients"
ID="$ID" NOM="$NOM" DOMAINE="$DOMAINE" DEPOT="$DEPOT" PROJET="$PROJET" URL_DEV="$URL_DEV" VERSION_GABARIT="$VERSION_GABARIT" CLIENT_GITHUB="$CLIENT_GITHUB" node - >"$USINE/clients/$ID.json" <<'JS'
const e = process.env;
console.log(JSON.stringify({ identifiant: e.ID, nom: e.NOM, domaine: e.DOMAINE, depot: e.DEPOT, projetCloudflare: e.PROJET, urlDev: e.URL_DEV, clientGithub: e.CLIENT_GITHUB || null, creeLe: new Date().toISOString().slice(0, 10), versionGabarit: e.VERSION_GABARIT }, null, 2));
JS
fait "client inscrit dans clients/$ID.json (a committer dans l'usine)"

manuel "Suivre les premiers deploiements : gh run list --repo $DEPOT"
manuel "Proteger le site de test par Cloudflare Access si tu y branches un domaine"
manuel "Ajouter $DEPOT a l'application GitHub de Claude : github.com/settings/installations -> Claude -> Configure (le client ne peut pas le faire)"
manuel "Cote client : abonnement Claude, connexion de son compte GitHub dans claude.ai/code, remise de GUIDE-CLIENT.md"

bilan
echo; echo "Site de test : $URL_DEV"; echo "Depot        : https://github.com/$DEPOT"
echo "Favori du client (MISE-EN-ROUTE.md) : $FAVORI"
[[ "${#ECHECS[@]}" -eq 0 ]] || exit 1
