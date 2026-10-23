#!/usr/bin/env bash
# Uptime check and email alerts for M.A.H.A.K.A.L. Safe to re-run: existing items are reused.
#
#   ALERT_EMAIL=you@example.com deploy/setup-monitoring.sh
#
# Creates:
#   - an email notification channel
#   - an uptime check on https://mahakal-ai.web.app/mahakal/api/v1/health (every 5 minutes, 3 regions)
#   - an alert when the uptime check fails
#   - an alert when Cloud Run returns more than 5 server errors (5xx) in 5 minutes
set -euo pipefail

PROJECT_ID="${PROJECT_ID:-mahakal-ai-230925}"
ALERT_EMAIL="${ALERT_EMAIL:?Set ALERT_EMAIL to the address that should receive alerts}"
HOST="${HOST:-mahakal-ai.web.app}"
HEALTH_PATH="/mahakal/api/v1/health"
SERVICE="mahakal-api"
API="https://monitoring.googleapis.com/v3/projects/${PROJECT_ID}"

gcloud services enable monitoring.googleapis.com --project="$PROJECT_ID" >/dev/null
TOKEN="$(gcloud auth print-access-token)"

call() { # call METHOD PATH [JSON]
  curl -sS --fail-with-body -X "$1" "${API}$2" \
    -H "Authorization: Bearer ${TOKEN}" -H "x-goog-user-project: ${PROJECT_ID}" \
    -H "Content-Type: application/json" ${3:+-d "$3"}
}

# Prints the "name" of the first item in LIST_FIELD whose displayName matches, or nothing.
find_by_display_name() { # find_by_display_name PATH LIST_FIELD DISPLAY_NAME
  call GET "$1" | python3 -c '
import json, sys
field, wanted = sys.argv[1], sys.argv[2]
print(next((i["name"] for i in json.load(sys.stdin).get(field, []) if i.get("displayName") == wanted), ""))
' "$2" "$3"
}

name_of() { python3 -c 'import json, sys; print(json.load(sys.stdin)["name"])'; }

# 1. Email notification channel
CHANNEL_NAME="M.A.H.A.K.A.L. alerts (${ALERT_EMAIL})"
CHANNEL="$(find_by_display_name /notificationChannels notificationChannels "$CHANNEL_NAME")"
if [ -z "$CHANNEL" ]; then
  CHANNEL="$(call POST /notificationChannels "{
    \"type\": \"email\",
    \"displayName\": \"${CHANNEL_NAME}\",
    \"labels\": {\"email_address\": \"${ALERT_EMAIL}\"}
  }" | name_of)"
  echo "Created notification channel: $CHANNEL"
else
  echo "Notification channel exists: $CHANNEL"
fi

# 2. Uptime check
UPTIME_NAME="M.A.H.A.K.A.L. health"
UPTIME="$(find_by_display_name /uptimeCheckConfigs uptimeCheckConfigs "$UPTIME_NAME")"
if [ -z "$UPTIME" ]; then
  UPTIME="$(call POST /uptimeCheckConfigs "{
    \"displayName\": \"${UPTIME_NAME}\",
    \"monitoredResource\": {\"type\": \"uptime_url\", \"labels\": {\"project_id\": \"${PROJECT_ID}\", \"host\": \"${HOST}\"}},
    \"httpCheck\": {\"path\": \"${HEALTH_PATH}\", \"port\": 443, \"useSsl\": true, \"validateSsl\": true, \"requestMethod\": \"GET\"},
    \"contentMatchers\": [{\"content\": \"\\\"status\\\":\\\"OK\\\"\", \"matcher\": \"CONTAINS_STRING\"}],
    \"period\": \"300s\",
    \"timeout\": \"10s\",
    \"selectedRegions\": [\"ASIA_PACIFIC\", \"EUROPE\", \"USA_VIRGINIA\"]
  }" | name_of)"
  echo "Created uptime check: $UPTIME"
else
  echo "Uptime check exists: $UPTIME"
fi
CHECK_ID="${UPTIME##*/}"

# 3. Alerting policies (created once; edit them in the console afterwards if needed)
create_policy() { # create_policy DISPLAY_NAME JSON
  if [ -n "$(find_by_display_name /alertPolicies alertPolicies "$1")" ]; then
    echo "Alert policy exists: $1"
  else
    call POST /alertPolicies "$2" >/dev/null
    echo "Created alert policy: $1"
  fi
}

create_policy "M.A.H.A.K.A.L. is down" "{
  \"displayName\": \"M.A.H.A.K.A.L. is down\",
  \"documentation\": {\"content\": \"The health check at https://${HOST}${HEALTH_PATH} is failing from multiple regions. Check Cloud Run logs for ${SERVICE}.\", \"mimeType\": \"text/markdown\"},
  \"combiner\": \"OR\",
  \"conditions\": [{
    \"displayName\": \"Uptime check failing\",
    \"conditionThreshold\": {
      \"filter\": \"metric.type=\\\"monitoring.googleapis.com/uptime_check/check_passed\\\" AND resource.type=\\\"uptime_url\\\" AND metric.label.check_id=\\\"${CHECK_ID}\\\"\",
      \"aggregations\": [{\"alignmentPeriod\": \"600s\", \"perSeriesAligner\": \"ALIGN_NEXT_OLDER\", \"crossSeriesReducer\": \"REDUCE_COUNT_FALSE\", \"groupByFields\": [\"resource.label.host\"]}],
      \"comparison\": \"COMPARISON_GT\",
      \"thresholdValue\": 1,
      \"duration\": \"300s\",
      \"trigger\": {\"count\": 1}
    }
  }],
  \"notificationChannels\": [\"${CHANNEL}\"],
  \"alertStrategy\": {\"autoClose\": \"3600s\"}
}"

create_policy "M.A.H.A.K.A.L. server errors" "{
  \"displayName\": \"M.A.H.A.K.A.L. server errors\",
  \"documentation\": {\"content\": \"Cloud Run service ${SERVICE} returned more than 5 server errors (5xx) in 5 minutes. Check its logs.\", \"mimeType\": \"text/markdown\"},
  \"combiner\": \"OR\",
  \"conditions\": [{
    \"displayName\": \"More than 5 5xx responses in 5 minutes\",
    \"conditionThreshold\": {
      \"filter\": \"metric.type=\\\"run.googleapis.com/request_count\\\" AND resource.type=\\\"cloud_run_revision\\\" AND resource.label.service_name=\\\"${SERVICE}\\\" AND metric.label.response_code_class=\\\"5xx\\\"\",
      \"aggregations\": [{\"alignmentPeriod\": \"300s\", \"perSeriesAligner\": \"ALIGN_SUM\", \"crossSeriesReducer\": \"REDUCE_SUM\"}],
      \"comparison\": \"COMPARISON_GT\",
      \"thresholdValue\": 5,
      \"duration\": \"0s\",
      \"trigger\": {\"count\": 1}
    }
  }],
  \"notificationChannels\": [\"${CHANNEL}\"],
  \"alertStrategy\": {\"autoClose\": \"3600s\"}
}"

echo "Done. Uptime dashboard: https://console.cloud.google.com/monitoring/uptime?project=${PROJECT_ID}"
