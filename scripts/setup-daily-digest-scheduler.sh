#!/usr/bin/env bash
#
# Sets up the Cloud Scheduler job that triggers the autoblogger's
# dashboard-digest generation once per day at 09:00 SAST (UTC+02:00).
#
# What it does:
#   1. POSTs to <autoblogger>/api/blogs/generate-from-dashboard
#   2. Header X-Job-Secret = JOB_SECRET (matches the env var in the autoblogger)
#   3. Body: { "sinceHours": 24, "autoPublish": true }
#
# The endpoint accepts EITHER X-Internal-Key OR X-Job-Secret. We use the job
# secret for the cron path because it's the same auth used by /api/schedules/run
# and stays scoped to "things triggered by an automation, not a human."
#
# This script is idempotent: re-running updates the existing job rather than
# creating a duplicate.
#
# Usage:
#   ./setup-daily-digest-scheduler.sh
#
# Requires: gcloud configured with deploy SA active, project = omevision-utils.

set -euo pipefail

PROJECT=${PROJECT:-omevision-utils}
REGION=${REGION:-europe-west1}
JOB_NAME=${JOB_NAME:-autoblogger-daily-digest}
AUTOBLOGGER_URL=${AUTOBLOGGER_URL:-https://autoblogger-1026777738823.europe-west1.run.app}
ENDPOINT="${AUTOBLOGGER_URL}/api/blogs/generate-from-dashboard"

# 09:00 SAST = 07:00 UTC. We could also use --time-zone=Africa/Mbabane and
# specify the hour as 09, but specifying UTC + a fixed hour is more obvious
# at a glance and survives DST-related confusion (Eswatini doesn't observe
# DST, but the fewer assumptions we encode the better).
SCHEDULE='0 7 * * *'
TIME_ZONE='Etc/UTC'

# Pull the job secret from Secret Manager (same secret the autoblogger uses).
echo "→ Fetching job secret from Secret Manager…"
JOB_SECRET=$(gcloud secrets versions access latest \
  --secret=OMEVISION_JOB_SECRET \
  --project="$PROJECT")

if [[ -z "$JOB_SECRET" ]]; then
  echo "❌ Could not fetch OMEVISION_JOB_SECRET from project=$PROJECT" >&2
  exit 1
fi

# JSON body for the POST. autoPublish=true means generated posts go straight
# to the live blog (per the user's confirmed publish-mode decision).
BODY='{"sinceHours":24,"autoPublish":true}'

# Check whether the job already exists; if so, update it. Otherwise, create.
if gcloud scheduler jobs describe "$JOB_NAME" \
     --location="$REGION" \
     --project="$PROJECT" >/dev/null 2>&1; then
  echo "→ Job exists; updating $JOB_NAME"
  gcloud scheduler jobs update http "$JOB_NAME" \
    --location="$REGION" \
    --project="$PROJECT" \
    --schedule="$SCHEDULE" \
    --time-zone="$TIME_ZONE" \
    --uri="$ENDPOINT" \
    --http-method=POST \
    --headers="Content-Type=application/json,X-Job-Secret=${JOB_SECRET}" \
    --message-body="$BODY" \
    --description="Daily 09:00 SAST autoblogger run: generate dashboard-digest posts for every product with completed tasks in the last 24h."
else
  echo "→ Creating job $JOB_NAME"
  gcloud scheduler jobs create http "$JOB_NAME" \
    --location="$REGION" \
    --project="$PROJECT" \
    --schedule="$SCHEDULE" \
    --time-zone="$TIME_ZONE" \
    --uri="$ENDPOINT" \
    --http-method=POST \
    --headers="Content-Type=application/json,X-Job-Secret=${JOB_SECRET}" \
    --message-body="$BODY" \
    --description="Daily 09:00 SAST autoblogger run: generate dashboard-digest posts for every product with completed tasks in the last 24h."
fi

echo "✅ Cloud Scheduler job '$JOB_NAME' is configured."
echo "   Project:  $PROJECT"
echo "   Region:   $REGION"
echo "   Schedule: $SCHEDULE ($TIME_ZONE)  → 09:00 SAST daily"
echo "   Endpoint: $ENDPOINT"
echo ""
echo "To run it manually right now:"
echo "  gcloud scheduler jobs run $JOB_NAME --location=$REGION --project=$PROJECT"
