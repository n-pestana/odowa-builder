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
verifier "version du gabarit enregistree" "[[ -s '$SITE/.gabarit-version' ]]"
verifier "aucun outil de l'usine chez le client" "[[ ! -e '$SITE/outils' && ! -e '$SITE/secrets.env' && ! -e '$SITE/BRIEF-MAINTENANCE.md' ]]"
verifier "un identifiant invalide est refuse" "! bash '$USINE/outils/nouveau-client.sh' 'Pas Valide' 'X' www.x.fr --simulation '$ZONE/x' >/dev/null 2>&1"

# Le client modifie son contenu ; pendant ce temps un fichier du gabarit a derive et un autre est obsolete.
echo "Texte du client." >>"$SITE/src/pages/index.md"
echo "photo" >"$SITE/public/photo-du-client.jpg"
node -e "const f='$SITE/site.config.json',fs=require('fs');const c=JSON.parse(fs.readFileSync(f,'utf8'));delete c.formulaireContact;fs.writeFileSync(f,JSON.stringify(c,null,2)+'\n')"
echo "// derive" >>"$SITE/scripts/outils/lib.mjs"
echo "obsolete" >"$SITE/scripts/outils/ancien-script.mjs"
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

echo
if [[ "$RATES" -eq 0 ]]; then echo "VERT - creation et mise a jour en simulation conformes."; else echo "ROUGE - $RATES verification(s) en echec. Journaux : $ZONE"; trap - EXIT; exit 1; fi
