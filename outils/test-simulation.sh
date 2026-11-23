#!/usr/bin/env bash
# Teste nouveau-client.sh et mettre-a-jour-client.sh en simulation : rien sur GitHub ni Cloudflare.
# Verifie surtout la promesse centrale de la mise a jour : le contenu du client n'est jamais touche.
#   bash outils/test-simulation.sh

set -uo pipefail
USINE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ZONE="$(mktemp -d)"; SITE="$ZONE/site-essai"; RATES=0
verifier() { if eval "$2"; then echo "OK     $1"; else echo "ECHEC  $1"; RATES=$((RATES + 1)); fi; }

# config.env jetable si l'usine n'en a pas (cas de la CI)
CREE=0
if [[ ! -f "$USINE/config.env" ]]; then
  printf 'PROPRIETAIRE=essai\nLOGIN_NICOLAS=nicolas-essai\nCONTACT_SECOURS="Nicolas - essai"\n' >"$USINE/config.env"; CREE=1
fi
trap '[[ "$CREE" -eq 1 ]] && rm -f "$USINE/config.env"; rm -rf "$ZONE"' EXIT
. "$USINE/config.env"

bash "$USINE/outils/nouveau-client.sh" essai "Boulangerie Essai" www.boulangerie-essai.fr --simulation "$SITE" --sans-verification >"$ZONE/creation.log" 2>&1
verifier "creation en simulation" "[[ \$? -eq 0 && -f '$SITE/site.config.json' ]]"
verifier "nom du site rempli" "grep -q '\"nomSite\": \"Boulangerie Essai\"' '$SITE/site.config.json'"
verifier "adresse du site en ligne remplie" "grep -q 'https://www.boulangerie-essai.fr' '$SITE/site.config.json'"
verifier "depot rempli" "grep -q '\"depot\": \"$PROPRIETAIRE/site-essai\"' '$SITE/site.config.json'"
verifier "CODEOWNERS rempli" "grep -q '@$LOGIN_NICOLAS' '$SITE/.github/CODEOWNERS' && ! grep -q 'LOGIN-GITHUB-DE-NICOLAS' '$SITE/.github/CODEOWNERS'"
verifier "nom de l'entreprise rempli" "grep -q 'Boulangerie Essai' '$SITE/src/donnees/entreprise.json'"
verifier "favori du client : depot choisi et Bonjour pre-rempli" "grep -qF 'Favori du client : https://claude.ai/code?repositories=$PROPRIETAIRE/site-essai&prompt=Bonjour' '$ZONE/creation.log'"
verifier "version du gabarit enregistree" "[[ -s '$SITE/.gabarit-version' ]]"
verifier "aucun outil de l'usine chez le client" "[[ ! -e '$SITE/outils' && ! -e '$SITE/secrets.env' && ! -e '$SITE/BRIEF-MAINTENANCE.md' ]]"
verifier "un identifiant invalide est refuse" "! bash '$USINE/outils/nouveau-client.sh' 'Pas Valide' 'X' www.x.fr --simulation '$ZONE/x' >/dev/null 2>&1"

# Le client modifie son contenu ; pendant ce temps un fichier du gabarit a derive et un autre est obsolete.
echo "Texte du client." >>"$SITE/src/pages/index.md"
echo "photo" >"$SITE/public/photo-du-client.jpg"
node -e "const f='$SITE/site.config.json',fs=require('fs');const c=JSON.parse(fs.readFileSync(f,'utf8'));delete c.formulaireContact;fs.writeFileSync(f,JSON.stringify(c,null,2)+'\n')"
echo "// derive" >>"$SITE/scripts/outils/lib.mjs"
echo "obsolete" >"$SITE/scripts/outils/ancien-script.mjs"
mkdir -p "$SITE/.claude/skills/ancienne-commande" && echo "obsolete" >"$SITE/.claude/skills/ancienne-commande/SKILL.md"
SOMME_CONTENU="$(cd "$SITE" && find src public -type f -exec sha256sum {} + | sort | sha256sum)"
SOMME_PROPRIETAIRES="$(sha256sum <"$SITE/.github/CODEOWNERS")"

bash "$USINE/outils/mettre-a-jour-client.sh" --simulation "$SITE" >"$ZONE/maj.log" 2>&1
verifier "mise a jour en simulation" "[[ \$? -eq 0 ]]"
verifier "contenu du client intact (src/ et public/)" "[[ \"\$(cd '$SITE' && find src public -type f -exec sha256sum {} + | sort | sha256sum)\" == '$SOMME_CONTENU' ]]"
verifier "CODEOWNERS du client intact" "[[ \"\$(sha256sum <'$SITE/.github/CODEOWNERS')\" == '$SOMME_PROPRIETAIRES' ]]"
verifier "valeurs du client conservees dans site.config.json" "grep -q 'Boulangerie Essai' '$SITE/site.config.json' && grep -q 'boulangerie-essai.fr' '$SITE/site.config.json'"
verifier "cle nouvelle ajoutee a site.config.json" "grep -q 'formulaireContact' '$SITE/site.config.json'"
verifier "fichier du gabarit remis a sa version" "cmp -s '$USINE/gabarit/scripts/outils/lib.mjs' '$SITE/scripts/outils/lib.mjs'"
verifier "fichier obsolete du gabarit supprime" "[[ ! -e '$SITE/scripts/outils/ancien-script.mjs' ]]"
verifier "commande renommee : l'ancienne disparait chez le client" "[[ ! -e '$SITE/.claude/skills/ancienne-commande/SKILL.md' && -f '$SITE/.claude/skills/publier/SKILL.md' ]]"

# --- Prerequis de la creation reelle : chaque verification refusee ET autorisee -----
# gh et curl sont remplaces par des faux qui notent leurs appels : rien ne sort sur le reseau.
FAUX="$ZONE/faux-bin"; JOURNAL="$ZONE/appels.log"; mkdir -p "$FAUX"
cat >"$FAUX/gh" <<'SH'
#!/usr/bin/env bash
echo "gh $*" >>"$FAUX_JOURNAL"
if [[ "$1 ${2:-}" == "auth status" ]]; then
  [[ "${FAUX_GH_CONNECTE:-1}" == 1 ]] || { echo "You are not logged into any GitHub hosts."; exit 1; }
  echo "  ✓ Logged in to github.com account essai"; echo "  - Token scopes: ${FAUX_GH_SCOPES:-'repo', 'workflow'}"; exit 0
fi
[[ "$1" == api && "${2:-}" == repos/* ]] && exit 1   # le depot n'existe pas
exit 0
SH
cat >"$FAUX/curl" <<'SH'
#!/usr/bin/env bash
cat >/dev/null   # le jeton arrive par l'entree standard
URL=""; for a in "$@"; do [[ "$a" == https://* ]] && URL="$a"; done
echo "curl $*" >>"$FAUX_JOURNAL"
case "$URL" in
  */pages/projects)   printf '%s' "${FAUX_CF_LISTE:-200}" ;;
  */pages/projects/*) printf '%s' "${FAUX_CF_PROJET:-404}" ;;
  *api.resend.com/*)  printf '%s' "${FAUX_RESEND:-200}" ;;
  *)                  printf '000'; exit 7 ;;
esac
SH
chmod +x "$FAUX/gh" "$FAUX/curl"
CONF="$ZONE/config-essai.env"; SECR="$ZONE/secrets-essai.env"
GIT_AVEC="$ZONE/git-avec"; GIT_SANS="$ZONE/git-sans"; : >"$GIT_SANS"
printf '[credential "https://github.com"]\n\thelper = !faux\n' >"$GIT_AVEC"
ecrire_config() { # remet la configuration valide, puis applique les remplacements KEY=valeur donnes
  printf '%s\n' PROPRIETAIRE=essai LOGIN_NICOLAS=nicolas-essai 'CONTACT_SECOURS="Nicolas - nicolas@essai.test"' \
    CLOUDFLARE_ACCOUNT_ID=compte-essai EMAIL_TEST=boite@essai.test 'CONTACT_EXPEDITEUR="Essai <no-reply@essai.test>"' >"$CONF"
  printf '%s\n' CLOUDFLARE_API_TOKEN=SECRET-CF-ESSAI RESEND_API_KEY=SECRET-RESEND-ESSAI >"$SECR"
  for r in "$@"; do sed -i "s|^${r%%=*}=.*|$r|" "$CONF"; done
}
lancer() { # lancer [VAR=valeur...] -- COMMANDE... : environnement simule, depuis un dossier hors depot git
  local vars=(); while [[ "$1" != -- ]]; do vars+=("$1"); shift; done; shift
  (cd "$ZONE" && env PATH="$FAUX:$PATH" TMPDIR="$ZONE" GIT_CONFIG_GLOBAL="$GIT_AVEC" GIT_CONFIG_NOSYSTEM=1 \
    USINE_CONFIG="$CONF" USINE_SECRETS="$SECR" FAUX_JOURNAL="$JOURNAL" "${vars[@]}" "$@")
}
prerequis() { lancer "$@" -- bash "$USINE/outils/prerequis.sh" essai >"$ZONE/prerequis.log" 2>&1; }
refuse() { ! prerequis "${@:2}" && grep -q "REFUS   $1" "$ZONE/prerequis.log"; }

ecrire_config; : >"$JOURNAL"
verifier "prerequis : tout est en place -> autorise" "prerequis && grep -q 'PREREQUIS VERTS' '$ZONE/prerequis.log'"
verifier "prerequis : aucun secret affiche ni passe en argument a curl" "! grep -q 'SECRET-' '$ZONE/prerequis.log' '$JOURNAL'"
ecrire_config EMAIL_TEST=
verifier "prerequis : valeur obligatoire vide -> refuse" "refuse 'valeurs vides : EMAIL_TEST'"
ecrire_config 'CONTACT_SECOURS="Nicolas - nicolas@exemple.fr - 06 00 00 00 00"'
verifier "prerequis : valeur d'exemple -> refuse" "refuse \"valeurs d'exemple dans config.env : CONTACT_SECOURS\""
ecrire_config
verifier "prerequis : gh non connecte -> refuse" "refuse \"gh n'est pas connecte\" FAUX_GH_CONNECTE=0"
verifier "prerequis : scope workflow absent -> refuse" "refuse \"le jeton gh n'a pas le scope workflow\" \"FAUX_GH_SCOPES='repo', 'gist'\""
verifier "prerequis : pas d'assistant d'identification git -> refuse" "refuse \"aucun assistant d'identification git\" GIT_CONFIG_GLOBAL='$GIT_SANS'"
verifier "prerequis : jeton Cloudflare refuse -> refuse" "refuse 'jeton Cloudflare refuse' FAUX_CF_LISTE=403"
verifier "prerequis : projet Pages deja existant -> refuse" "refuse 'le projet Pages site-essai existe deja' FAUX_CF_PROJET=200"
verifier "prerequis : expediteur refuse par Resend -> refuse" "refuse 'Resend refuse' FAUX_RESEND=403"
ecrire_config CLOUDFLARE_ACCOUNT_ID=
verifier "prerequis : --sans-cloudflare sans compte Cloudflare -> autorise" \
  "lancer FAUX_CF_LISTE=403 -- bash '$USINE/outils/prerequis.sh' essai --sans-cloudflare >'$ZONE/prerequis.log' 2>&1"
ecrire_config; : >"$JOURNAL"
lancer FAUX_RESEND=403 -- bash "$USINE/outils/nouveau-client.sh" essai "Boulangerie Essai" www.boulangerie-essai.fr --sans-verification >"$ZONE/creation-reelle.log" 2>&1
verifier "creation reelle : prerequis rouges -> arret avant toute creation" \
  "[[ \$? -ne 0 ]] && grep -q 'prerequis rouges' '$ZONE/creation-reelle.log' && ! grep -qE 'gh (repo create|secret set|variable set)' '$JOURNAL'"

echo
if [[ "$RATES" -eq 0 ]]; then echo "VERT - creation et mise a jour en simulation conformes."; else echo "ROUGE - $RATES verification(s) en echec. Journaux : $ZONE"; trap - EXIT; exit 1; fi
