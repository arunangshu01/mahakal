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
- The music dock uses its own app-grid row rather than fixed positioning, so Modules and chat cannot be covered. On narrow screens the expanded dock reduces the reactor size using the main container's available height.
- Music actions use accessible, tooltip-labeled SVG icons. Minimize switches to a compact player with a visible video at least 200 × 200px; it never hides, pauses, reloads, or starts playback. Restore also leaves playback unchanged; close unloads. Compact playback still ducks for assistant activity. Spotify embeds do not expose these custom playback/minimize controls.
- Keep typography consistent with the existing app: chat body text inherits the app font, and utility labels/code use the existing `--mono` token; do not introduce a separate system-font theme for responses.
- Keep the established HUD/reactor/chat layout and angular message panels. Do not resize the reactor when a conversation starts. ChatGPT-style response presentation means streamed text with readable Markdown, copy-response/code actions, a thinking indicator, and opt-in follow-to-bottom scrolling—not a redesign of the app layout. These presentation changes must not alter the voice/TTS pipeline.
- Music tests mock the YouTube API. Real-device checks are still needed for embedding availability, mobile volume restrictions, and microphone/wake-word behavior while music plays.
- `search_web` uses Gemini Google Search grounding through the existing Gemini credentials. The configured Gemini model must support Google Search grounding; provider quotas and grounding charges apply. Missing credentials, failed searches, or missing grounding sources must not silently become current-statistics answers.
- Automated grounding tests use mocked providers; passing tests do not verify live provider availability or the freshness of actual sports statistics.

## Deployment (GCP project `mahakal-ai-230925`, region asia-south1)
- UI: Firebase Hosting site `mahakal-ai` (https://mahakal-ai.web.app); `/mahakal/api/**` is rewritten to Cloud Run service `mahakal-api`.
- Data: Firestore `(default)`; collections `conversations/{guest_<id>|user_<sub>}` and `users/{sub}`.
- Firebase Hosting only forwards the cookie named `__session` to Cloud Run, so the session must stay in that single cookie.
- `.github/workflows/deploy.yml` deploys after CI passes on `main`; setup steps are in `docs/deploy-gcp.md`.
- Groq retires models: check `GROQ_MODEL` against `https://api.groq.com/openai/v1/models` if chat starts failing with `model_not_found`.
