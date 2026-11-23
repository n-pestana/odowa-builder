#!/usr/bin/env bash
# Met a jour le gabarit dans le depot d'un client, sans toucher a son contenu.
#
#   outils/mettre-a-jour-client.sh IDENTIFIANT            (un client inscrit dans clients/)
#   outils/mettre-a-jour-client.sh --tous                 (tous les clients, l'un apres l'autre)
#   outils/mettre-a-jour-client.sh --simulation DOSSIER   (un dossier local, rien n'est pousse)
#
# Ce qui appartient au client et n'est JAMAIS touche :
#   src/   public/   site.config.json (seules les cles nouvelles y sont ajoutees)   .github/CODEOWNERS
# Tout le reste est remplace par la version du gabarit, fichiers supprimes compris.
#
# La mise a jour arrive sur le site de TEST du client (branche dev). Elle n'est pas mise en ligne :
# c'est une decision a part, prise apres avoir regarde le site de test.

set -uo pipefail
USINE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VERSION_GABARIT="$(git -C "$USINE" rev-parse --short HEAD 2>/dev/null || echo inconnue)"

appliquer_gabarit() { # $1 = dossier du site du client
  node "$USINE/outils/appliquer-gabarit.mjs" "$1" "$VERSION_GABARIT"
}

verifier() { # $1 = dossier du site
  (cd "$1" && npm ci --no-audit --no-fund >/dev/null 2>&1 && npm run -s build >/dev/null 2>&1 \
    && npm run -s check && npm run -s check:envers | tail -1 && npm run -s check:hook | tail -1)
}

mettre_a_jour() { # $1 = identifiant
  local id="$1" fiche="$USINE/clients/$1.json"
  printf '\n== %s\n' "$id"
  [[ -f "$fiche" ]] || { echo "   ECHEC   pas de fiche clients/$id.json"; return 1; }
  local depot; depot="$(node -e "console.log(JSON.parse(require('fs').readFileSync('$fiche','utf8')).depot)")"
  local site; site="$(mktemp -d)/site"
  gh repo clone "$depot" "$site" -- --quiet --branch dev 2>/tmp/maj.err || { echo "   ECHEC   clonage de $depot : $(tail -2 /tmp/maj.err)"; return 1; }
  local avant; avant="$(cat "$site/.gabarit-version" 2>/dev/null || echo inconnue)"

  appliquer_gabarit "$site" || { echo "   ECHEC   application du gabarit"; return 1; }
  if [[ -z "$(git -C "$site" status --porcelain)" ]]; then
    echo "   A JOUR  $depot est deja a la version $VERSION_GABARIT du gabarit"; return 0
  fi
  echo "   Fichiers du gabarit modifies :"; git -C "$site" status --porcelain | sed 's/^/     /' | head -40

  if ! verifier "$site"; then
    echo "   ECHEC   build ou controles rouges APRES mise a jour : rien n'a ete pousse."
    echo "           Le contenu de ce client n'est pas compatible avec la nouvelle version du gabarit. Dossier : $site"
    return 1
  fi
  if (cd "$site" && git add -A && git -c user.name="usine" -c user.email="usine@localhost" commit -q -m "Mise a jour du gabarit : $avant -> $VERSION_GABARIT" && git push -q origin dev) 2>/tmp/maj.err; then
    node -e "const f='$fiche',fs=require('fs');const c=JSON.parse(fs.readFileSync(f,'utf8'));c.versionGabarit='$VERSION_GABARIT';fs.writeFileSync(f,JSON.stringify(c,null,2)+'\n')"
    echo "   FAIT    $depot : gabarit $avant -> $VERSION_GABARIT, pousse sur le site de TEST."
    echo "           Reste a faire : regarder le site de test, puis mettre en ligne (voir README, « Mettre a jour les clients »)."
  else
    echo "   ECHEC   envoi sur $depot : $(tail -3 /tmp/maj.err)"; return 1
  fi
}

case "${1:-}" in
  --simulation)
    SITE="${2:-}"; [[ -d "$SITE" ]] || { echo "Dossier introuvable : $SITE"; exit 1; }
    appliquer_gabarit "$SITE" || exit 1
    echo "SIMULATION : gabarit $VERSION_GABARIT applique dans $SITE. Rien n'a ete pousse."
    ;;
  --tous)
    ECHECS=0
    for FICHE in "$USINE"/clients/*.json; do
      [[ -e "$FICHE" ]] || { echo "Aucun client inscrit dans clients/."; exit 0; }
      mettre_a_jour "$(basename "$FICHE" .json)" || ECHECS=$((ECHECS + 1))
    done
    echo; echo "Termine : $ECHECS client(s) en echec."; [[ "$ECHECS" -eq 0 ]] || exit 1
    ;;
  ''|-h|--help)
    sed -n '2,13p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'; exit 1 ;;
  *)
    mettre_a_jour "$1" || exit 1 ;;
esac
