#!/usr/bin/env bash
# Crea el repo en GitHub y deja puestas las reglas del taller. Se ejecuta una vez, a mano:
#   bash scripts/configurar-github.sh JorgeVJ/arena42
# Requiere gh con sesión iniciada. La protección de ramas en GitHub Free solo existe en repos públicos.
set -euo pipefail
REPO="${1:?uso: configurar-github.sh <dueño>/<repo>}"

if ! gh repo view "$REPO" >/dev/null 2>&1; then
  gh repo create "$REPO" --public --source . --remote origin --description "Arena multijugador del taller de GitHub de 42 Madrid"
fi
git push -u origin main
git show-ref --verify --quiet refs/heads/dev || git branch dev main
git push -u origin dev
gh repo edit "$REPO" --default-branch dev

# Fusión: squash para las PR de piezas, merge commit para pasar dev a main; auto-merge y ramas borradas al fusionar.
gh api -X PATCH "repos/$REPO" \
  -F allow_squash_merge=true -F allow_merge_commit=true -F allow_rebase_merge=false \
  -F allow_auto_merge=true -F delete_branch_on_merge=true \
  -f squash_merge_commit_title=PR_TITLE -f squash_merge_commit_message=PR_BODY >/dev/null

# dev: nada entra sin PR, sin la validación en verde y sin la aprobación del code owner (@JorgeVJ).
# enforce_admins: tampoco Jorge se la salta por error.
gh api -X PUT "repos/$REPO/branches/dev/protection" --input - >/dev/null <<'JSON'
{
  "required_status_checks": { "strict": false, "contexts": ["validar"] },
  "enforce_admins": true,
  "required_pull_request_reviews": {
    "require_code_owner_reviews": true,
    "required_approving_review_count": 1,
    "dismiss_stale_reviews": true
  },
  "restrictions": null,
  "required_linear_history": true,
  "allow_force_pushes": false,
  "allow_deletions": false
}
JSON

# main: solo por PR desde dev, que abre y fusiona Jorge (no puede aprobarse a sí mismo, por eso 0 aprobaciones).
gh api -X PUT "repos/$REPO/branches/main/protection" --input - >/dev/null <<'JSON'
{
  "required_status_checks": null,
  "enforce_admins": false,
  "required_pull_request_reviews": { "required_approving_review_count": 0 },
  "restrictions": null,
  "allow_force_pushes": false,
  "allow_deletions": false
}
JSON

# Colaboradores: un login por línea en colaboradores.txt (permiso push: pueden subir ramas, no tocar dev).
if [ -f colaboradores.txt ]; then
  while read -r login; do
    [ -n "$login" ] && gh api -X PUT "repos/$REPO/collaborators/$login" -f permission=push >/dev/null && echo "invitado @$login"
  done < colaboradores.txt
fi

echo
echo "Listo. Falta, a mano:"
echo "  gh secret set CLOUDFLARE_API_TOKEN --repo $REPO"
echo "  gh secret set CLOUDFLARE_ACCOUNT_ID --repo $REPO"
echo "  node scripts/crear-issues.mjs $REPO   # backlog inicial"
