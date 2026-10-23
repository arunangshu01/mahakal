# Deploying M.A.H.A.K.A.L. to Google Cloud

```
https://mahakal-ai.web.app   Firebase Hosting: React UI (CDN + free SSL)
        └─ /mahakal/api/**  →  Cloud Run "mahakal-api" (FastAPI, asia-south1)
                          ├─ Firestore (default) — users, conversations
                          └─ Secret Manager — API keys, session secret
Deploys: merge to main → CI passes → .github/workflows/deploy.yml
```

Already done in the console: project `mahakal-ai-230925`, billing + budget alert, Firestore `(default)`
in asia-south1, Firebase Hosting site `mahakal-ai`, OAuth client, and these secrets:
`groq-api-key`, `gemini-api-key`, `google-client-id`, `google-client-secret` (unused by the app),
`session-secret`.

## One-time setup (run in Terminal)

Status: steps 1–6 were completed on 23 October 2026.

```bash
export PROJECT_ID=mahakal-ai-230925
export REGION=asia-south1
export GITHUB_REPO=arunangshu01/mahakal
export PROJECT_NUMBER=$(gcloud projects describe $PROJECT_ID --format='value(projectNumber)')
export RUN_SA=mahakal-run@$PROJECT_ID.iam.gserviceaccount.com
export DEPLOY_SA=mahakal-deployer@$PROJECT_ID.iam.gserviceaccount.com
gcloud config set project $PROJECT_ID
```

### 1. Enable the APIs

```bash
gcloud services enable run.googleapis.com artifactregistry.googleapis.com iamcredentials.googleapis.com \
  sts.googleapis.com firestore.googleapis.com secretmanager.googleapis.com firebasehosting.googleapis.com \
  cloudresourcemanager.googleapis.com
```

### 2. Docker image repository

```bash
gcloud artifacts repositories create mahakal --repository-format=docker --location=$REGION \
  --description="M.A.H.A.K.A.L. images"

# Keep the 5 newest images, delete anything older than 30 days (stays in the free tier).
cat > /tmp/cleanup.json <<'JSON'
[{"name":"keep-recent-5","action":{"type":"Keep"},"mostRecentVersions":{"keepCount":5}},
 {"name":"delete-older-than-30d","action":{"type":"Delete"},"condition":{"olderThan":"30d"}}]
JSON
gcloud artifacts repositories set-cleanup-policies mahakal --location=$REGION --policy=/tmp/cleanup.json --no-dry-run
```

### 3. Runtime service account (what the app runs as)

Can read/write Firestore and read exactly four secrets, nothing else. The app runs with
`SECRETS_SOURCE=secret-manager`, so at startup it reads `groq-api-key`, `gemini-api-key`,
`google-client-id` and `session-secret` itself (`backend/utility/secrets.py`). If any can't be read,
the new revision fails to start and Cloud Run keeps serving the previous one.

```bash
gcloud iam service-accounts create mahakal-run --display-name="M.A.H.A.K.A.L. Cloud Run runtime"
gcloud projects add-iam-policy-binding $PROJECT_ID --member=serviceAccount:$RUN_SA --role=roles/datastore.user
for secret in groq-api-key gemini-api-key google-client-id session-secret; do
  gcloud secrets add-iam-policy-binding $secret --member=serviceAccount:$RUN_SA --role=roles/secretmanager.secretAccessor
done
```

### 4. Auto-delete idle conversations (Firestore TTL)

Guests' conversations expire after 7 idle days, signed-in users' after 90.

```bash
gcloud firestore fields ttls update expire_at --collection-group=conversations --enable-ttl --async
```

### 5. Deployer service account (what GitHub Actions deploys as)

```bash
gcloud iam service-accounts create mahakal-deployer --display-name="M.A.H.A.K.A.L. GitHub deployer"
for role in roles/run.admin roles/firebasehosting.admin roles/serviceusage.serviceUsageConsumer; do
  gcloud projects add-iam-policy-binding $PROJECT_ID --member=serviceAccount:$DEPLOY_SA --role=$role
done
gcloud artifacts repositories add-iam-policy-binding mahakal --location=$REGION \
  --member=serviceAccount:$DEPLOY_SA --role=roles/artifactregistry.writer
gcloud iam service-accounts add-iam-policy-binding $RUN_SA \
  --member=serviceAccount:$DEPLOY_SA --role=roles/iam.serviceAccountUser
```

### 6. Let GitHub Actions use the deployer (keyless, Workload Identity Federation)

Only workflows from `arunangshu01/mahakal` can use it; no keys are stored in GitHub.

```bash
gcloud iam workload-identity-pools create github --location=global --display-name="GitHub Actions"
gcloud iam workload-identity-pools providers create-oidc mahakal-repo --location=global \
  --workload-identity-pool=github --display-name="mahakal repo" \
  --issuer-uri=https://token.actions.githubusercontent.com \
  --attribute-mapping="google.subject=assertion.sub,attribute.repository=assertion.repository,attribute.ref=assertion.ref" \
  --attribute-condition="assertion.repository=='$GITHUB_REPO' && assertion.ref=='refs/heads/main'"
gcloud iam service-accounts add-iam-policy-binding $DEPLOY_SA --role=roles/iam.workloadIdentityUser \
  --member="principalSet://iam.googleapis.com/projects/$PROJECT_NUMBER/locations/global/workloadIdentityPools/github/attribute.repository/$GITHUB_REPO"

echo "GCP_WIF_PROVIDER = projects/$PROJECT_NUMBER/locations/global/workloadIdentityPools/github/providers/mahakal-repo"
echo "GCP_DEPLOY_SA    = $DEPLOY_SA"
```

### 7. GitHub repository variables

GitHub → repo → **Settings → Secrets and variables → Actions → Variables → New repository variable**.
These are identifiers, not secrets.

| Name | Value |
|---|---|
| `GCP_PROJECT_ID` | `mahakal-ai-230925` |
| `GCP_WIF_PROVIDER` | printed by step 6 |
| `GCP_DEPLOY_SA` | printed by step 6 |

### 8. Protecting `main`

Deploys are already limited to `main` on the Google side: the provider's attribute condition is
`assertion.repository=='arunangshu01/mahakal' && assertion.ref=='refs/heads/main'`, so workflows on
any other branch (or from forks) cannot get Google credentials.

On GitHub, **rulesets and environments are not enforced for private repositories on the Free plan**.
To have GitHub block merges until CI passes, either upgrade to **GitHub Pro** or make the repository
public, then create a branch ruleset (Settings → Rules → Rulesets → New branch ruleset):

| Setting | Value |
|---|---|
| Ruleset name | `protect-main` |
| Enforcement status | **Active** |
| Target branches | **Include default branch** |
| Restrict deletions / Block force pushes | ✅ / ✅ |
| Require a pull request before merging | ✅ — 0 approvals, ✅ *Require conversation resolution* |
| Require status checks to pass | ✅ — ✅ *Require branches to be up to date*, checks **Backend tests** and **Frontend tests** |

Until then: always merge through a PR and wait for both checks to go green. Even if something is
merged with failing tests, the Deploy workflow only runs after CI succeeds on `main`.

## Configuration

- **Backend (Cloud Run):** non-secret settings live in `deploy/cloud-run.env.yaml`; the deploy workflow
  applies it with `--env-vars-file`. Change a value there and merge to `main` to roll it out.
- **Secrets:** Secret Manager only (read by the app at startup).
- **Frontend (Firebase Hosting):** no environment variables. It calls the API on the same domain
  (`/mahakal/api/v1`) and gets the Google client ID from `/mahakal/api/v1/auth/me`.

## Deploying

- **Automatically:** merge a PR into `main`. CI runs the tests; when it passes, **Deploy** builds the API image,
  deploys it to Cloud Run, builds the frontend and deploys it to Firebase Hosting, then smoke-tests
  `https://mahakal-ai.web.app/mahakal/api/v1/health`.
- **Manually:** GitHub → **Actions → Deploy → Run workflow**.

## Before going public

1. Sign in on https://mahakal-ai.web.app with your test Gmail and check that chat and voice work.
2. Google Auth Platform → **Branding**: add the privacy policy `https://mahakal-ai.web.app/privacy.html`,
   terms `https://mahakal-ai.web.app/terms.html`, and authorized domain `mahakal-ai.web.app`.
3. Google Auth Platform → **Audience** → **Publish app**, so any Google account can sign in.

## Rotating a secret

```bash
printf '%s' 'NEW_VALUE' | gcloud secrets versions add groq-api-key --data-file=-
```

Then re-run the Deploy workflow; Cloud Run picks up `latest` on the new revision.

## Monitoring

`deploy/setup-monitoring.sh` creates an email notification channel, an uptime check on
`https://mahakal-ai.web.app/mahakal/api/v1/health` (every 5 minutes from 3 regions), and two
alert policies: site down and more than 5 server errors (5xx) in 5 minutes. Run it once:

```bash
ALERT_EMAIL=you@example.com deploy/setup-monitoring.sh
```

It is safe to re-run (existing items are reused). Change `PROJECT_ID`, `HOST` or `SERVICE` via
the environment variables at the top of the script if they ever differ.

## Costs

Cloud Run (scales to zero, max 3 instances), Firestore, Hosting, Secret Manager and Artifact Registry all
stay within their free tiers at small scale. Keep the budget alert on.
