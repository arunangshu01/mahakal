# AGENTS.md

## Layout
- `backend/`: FastAPI, portfolio-style layout (`app/`, `routers/`, `model/`, `source/`, `utility/`, `tests/`). Run commands from `backend/`.
- `frontend/`: React + Vite + Vitest. Run commands from `frontend/`.

## Verify before committing
```bash
cd backend && .venv/bin/python -m pytest -q
cd frontend && npm run lint && npm test && npm run build
```
CI (`.github/workflows/ci.yml`) runs the same on every PR.

## Conventions
- Work on a feature branch; `main` is the deployment branch and only changes via PRs.
- The assistant's name is written `M.A.H.A.K.A.L.` (see `ASSISTANT_NAME` in `backend/utility/settings.py` and `frontend/src/constants.js`). TTS converts it to "Mahakal" so it is spoken as a word.
- New dependencies: pin versions published at least 7 days ago.
- Never read, print or commit secrets. Local values live in `backend/.env` (git-ignored); production values in GCP Secret Manager (`groq-api-key`, `gemini-api-key`, `google-client-id`, `session-secret`).

## Deployment (GCP project `mahakal-ai-230925`, region asia-south1)
- UI: Firebase Hosting site `mahakal-ai` (https://mahakal-ai.web.app); `/mahakal/api/**` is rewritten to Cloud Run service `mahakal-api`.
- Data: Firestore `(default)`; collections `conversations/{guest_<id>|user_<sub>}` and `users/{sub}`.
- Firebase Hosting only forwards the cookie named `__session` to Cloud Run, so the session must stay in that single cookie.
- `.github/workflows/deploy.yml` deploys after CI passes on `main`; setup steps are in `docs/deploy-gcp.md`.
- Groq retires models: check `GROQ_MODEL` against `https://api.groq.com/openai/v1/models` if chat starts failing with `model_not_found`.
