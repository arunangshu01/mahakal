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

## Music and fresh information
- Music is opt-in and defaults to the user-approved Shambhu Stuti recording `STq6tE6un6E`. The public build-time `VITE_MUSIC_URL` can override it with a YouTube watch/share/Music URL or Spotify track URL; rebuild after changing it.
- YouTube playback uses the official IFrame API, loaded only when the music player is opened. Assistant listening/thinking/speaking and three-second in-app notices smoothly duck music to at most 8% and restore the previous volume without pausing or restarting. Wake-word standby alone does not duck. Spotify embeds and OS/other-app notifications do not support this volume control.
- The music heading and external listening link follow the embedded YouTube video's metadata via `getVideoData()` on readiness/state changes and a one-second refresh while open. Missing titles use a neutral `Music` label. Recommendations that open outside the app cannot be tracked; the app does not replace YouTube's recommendation UI.
- Music tests mock the YouTube API. Real-device checks are still needed for embedding availability, mobile volume restrictions, and microphone/wake-word behavior while music plays.
- `search_web` uses Gemini Google Search grounding through the existing Gemini credentials. The configured Gemini model must support Google Search grounding; provider quotas and grounding charges apply. Missing credentials, failed searches, or missing grounding sources must not silently become current-statistics answers.
- Automated grounding tests use mocked providers; passing tests do not verify live provider availability or the freshness of actual sports statistics.

## Deployment (GCP project `mahakal-ai-230925`, region asia-south1)
- UI: Firebase Hosting site `mahakal-ai` (https://mahakal-ai.web.app); `/mahakal/api/**` is rewritten to Cloud Run service `mahakal-api`.
- Data: Firestore `(default)`; collections `conversations/{guest_<id>|user_<sub>}` and `users/{sub}`.
- Firebase Hosting only forwards the cookie named `__session` to Cloud Run, so the session must stay in that single cookie.
- `.github/workflows/deploy.yml` deploys after CI passes on `main`; setup steps are in `docs/deploy-gcp.md`.
- Groq retires models: check `GROQ_MODEL` against `https://api.groq.com/openai/v1/models` if chat starts failing with `model_not_found`.
