#!/usr/bin/env bash
#
# One-shot helper: wires the dashboard-integration env vars onto the live
# `autoblogger-api-prod` Cloud Run service in hiyebo. Idempotent.
#
# Why this is a separate script: the canonical deploy path (cloudbuild.yaml)
# runs `gcloud run deploy --image only`, which preserves env config from the
# previous revision. So new env vars / secrets need to be added once,
# out-of-band, before the next deploy. After this script runs, every
# subsequent Cloud Build deploy keeps these settings.
#
# Required pre-condition: a secret called AUTOBLOGGER__CEO_DASHBOARD_INTERNAL_KEY
# must exist on hiyebo, holding the SAME value as the dashboard's INTERNAL_API_KEY.
# Create it with:
#
#   echo -n "<dashboard-internal-key-value>" | \
#     gcloud secrets create AUTOBLOGGER__CEO_DASHBOARD_INTERNAL_KEY \
#       --project=hiyebo --replication-policy=automatic --data-file=-
#
# Usage:
#   gcloud config configurations activate deployer
#   gcloud config set project hiyebo
#   ./wire-dashboard-integration.sh

set -euo pipefail

PROJECT=${PROJECT:-hiyebo}
REGION=${REGION:-europe-west1}
SERVICE=${SERVICE:-autoblogger-api-prod}

DASHBOARD_URL=${DASHBOARD_URL:-https://ceo-dashboard-api-438855261609.europe-west1.run.app}
SECRET_NAME=${SECRET_NAME:-AUTOBLOGGER__CEO_DASHBOARD_INTERNAL_KEY}

echo "→ Verifying secret $SECRET_NAME exists on $PROJECT…"
if ! gcloud secrets describe "$SECRET_NAME" --project="$PROJECT" >/dev/null 2>&1; then
  echo "❌ Secret $SECRET_NAME not found on $PROJECT." >&2
  echo "   Create it first — see header comment of this script for the gcloud command." >&2
  exit 1
fi

echo "→ Updating $SERVICE on $PROJECT with CEO_DASHBOARD_API_URL + CEO_DASHBOARD_INTERNAL_KEY…"
gcloud run services update "$SERVICE" \
  --project="$PROJECT" \
  --region="$REGION" \
  --update-env-vars="CEO_DASHBOARD_API_URL=${DASHBOARD_URL}" \
  --update-secrets="CEO_DASHBOARD_INTERNAL_KEY=${SECRET_NAME}:latest"

echo "✅ Done. Verify with:"
echo "   gcloud run services describe $SERVICE --region=$REGION --project=$PROJECT \\"
echo "     --format='value(spec.template.spec.containers[0].env[?name=\"CEO_DASHBOARD_API_URL\"].value,spec.template.spec.containers[0].env[?name=\"CEO_DASHBOARD_INTERNAL_KEY\"].valueFrom.secretKeyRef.name)'"
