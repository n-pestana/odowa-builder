#!/usr/bin/env bash
# Regle le depot GitHub d'un client en une commande.
#
#   bash outils/github.sh PROPRIETAIRE/DEPOT [LOGIN-GITHUB-DU-CLIENT]
#
# Appele par nouveau-client.sh ; utilisable seul pour inviter un client ou reappliquer les reglages.
#
# A lancer par Nicolas, une fois "main" et "dev" poussees, avec gh connecte en
# administrateur du depot (gh auth login). Relancable sans risque.

set -uo pipefail

DEPOT="${1:-}"
CLIENT="${2:-}"
if [[ -z "$DEPOT" || "$DEPOT" != */* ]]; then
  echo "Usage : bash outils/github.sh PROPRIETAIRE/DEPOT [LOGIN-GITHUB-DU-CLIENT]"
  exit 1
fi

ECHECS=0
etape() { printf '\n== %s\n' "$1"; }
ok() { echo "   FAIT    $1"; }
ko() { echo "   ECHEC   $1"; ECHECS=$((ECHECS + 1)); }

etape "Verifications"
gh api "repos/$DEPOT" --jq '.full_name' >/dev/null 2>&1 || { echo "   Depot $DEPOT introuvable, ou gh non connecte (gh auth login)."; exit 1; }
for BRANCHE in main dev; do
  gh api "repos/$DEPOT/branches/$BRANCHE" --jq '.name' >/dev/null 2>&1 || { echo "   La branche $BRANCHE n'existe pas sur GitHub : la pousser d'abord."; exit 1; }
done
ok "depot et branches main/dev presents"

etape "Reglages generaux"
if gh api -X PATCH "repos/$DEPOT" \
  -f default_branch=dev \
  -F allow_squash_merge=true -F allow_merge_commit=false -F allow_rebase_merge=false \
  -F delete_branch_on_merge=true >/dev/null 2>/tmp/github-sh.err; then
  ok "branche par defaut dev, fusion squash uniquement, suppression automatique des branches fusionnees"
else
  ko "reglages generaux : $(cat /tmp/github-sh.err)"
fi

etape "Protection de main"
if gh api -X PUT "repos/$DEPOT/branches/main/protection" --input - >/dev/null 2>/tmp/github-sh.err <<'JSON'
{
  "required_status_checks": { "strict": false, "contexts": ["controles"] },
  "enforce_admins": false,
  "required_pull_request_reviews": {
    "required_approving_review_count": 0,
    "require_code_owner_reviews": true,
    "dismiss_stale_reviews": false
  },
  "restrictions": null,
  "allow_force_pushes": false,
  "allow_deletions": false
}
JSON
then
  ok "pull request obligatoire, controle \"controles\" obligatoire, accord du proprietaire du code, ni push force ni suppression"
else
  ko "protection de main : $(cat /tmp/github-sh.err)"
  if grep -qi 'upgrade' /tmp/github-sh.err; then
    echo "           -> GitHub demande une offre payante pour proteger une branche d'un depot prive."
    echo "              Sans cette protection, le gabarit n'a plus de verrou : ne pas le confier a un client."
  fi
fi

etape "Etiquettes"
creer_etiquette() {
  if gh api "repos/$DEPOT/labels/$1" >/dev/null 2>&1; then
    ok "etiquette $1 (deja presente)"
  elif gh api -X POST "repos/$DEPOT/labels" -f name="$1" -f color="$2" -f description="$3" >/dev/null 2>/tmp/github-sh.err; then
    ok "etiquette $1"
  else
    ko "etiquette $1 : $(cat /tmp/github-sh.err)"
  fi
}
creer_etiquette alerte      d93f0b "Alerte envoyee a Nicolas"
creer_etiquette prod-cassee b60205 "Le site en ligne a un probleme"
creer_etiquette bloque      fbca04 "Le client ne peut pas avancer"
creer_etiquette question    0e8a16 "Question du client"
creer_etiquette info        c5def5 "Information, pas d'action attendue"

etape "Acces du client"
if [[ -z "$CLIENT" ]]; then
  echo "   IGNORE  aucun login client fourni (le passer en 2e argument quand le compte existe)"
elif gh api -X PUT "repos/$DEPOT/collaborators/$CLIENT" -f permission=push >/dev/null 2>/tmp/github-sh.err; then
  ok "$CLIENT invite en ecriture (il doit accepter l'invitation recue par mail)"
else
  ko "invitation de $CLIENT : $(cat /tmp/github-sh.err)"
fi

etape "Relecture"
gh api "repos/$DEPOT" --jq '"   branche par defaut : \(.default_branch) | squash : \(.allow_squash_merge) | merge : \(.allow_merge_commit) | rebase : \(.allow_rebase_merge) | suppression auto : \(.delete_branch_on_merge) | prive : \(.private)"' 2>/dev/null
gh api "repos/$DEPOT/branches/main/protection" --jq '"   main : controles obligatoires = \(.required_status_checks.contexts) | proprietaire du code = \(.required_pull_request_reviews.require_code_owner_reviews) | approbations = \(.required_pull_request_reviews.required_approving_review_count)"' 2>/dev/null \
  || echo "   main : AUCUNE protection en place"

echo
if [[ "$ECHECS" -eq 0 ]]; then
  echo "TERMINE - tous les reglages sont en place."
else
  echo "INCOMPLET - $ECHECS reglage(s) en echec, voir ci-dessus."
  exit 1
fi
