# M.A.H.A.K.A.L.

**M**odular **A**gentic **H**ub for **A**utomation, **K**nowledge & **A**daptive **L**ogic

A personal voice AI assistant with a JARVIS-style HUD, built entirely on free tiers.
Tap the reactor core and talk, or type a command. It answers out loud.

Live at **https://mahakal-ai.web.app** once deployed (see [docs/deploy-gcp.md](docs/deploy-gcp.md)).

## Stack

| Component | Service | Cost |
|---|---|---|
| Brain (LLM) | Groq API (GPT-OSS 120B), Gemini fallback | Free tier |
| Ears (STT) | Groq hosted Whisper, Gemini fallback | Free tier |
| Voice (TTS) | Microsoft Edge TTS | Free |
| Sign-in | Google Identity Services (Google sign-in) | Free |
| Backend | FastAPI on Cloud Run (`backend/`) | Free tier |
| Frontend | React + Vite on Firebase Hosting (`frontend/`) | Free tier |
| Database | Firestore | Free tier |
| Secrets | Google Secret Manager | Free tier |

If Groq fails or hits its rate limit, the same request is retried on Gemini automatically.

## Accounts and guests

- Visitors can send **5 messages as a guest**, then they are asked to **sign in with Google**.
  Their guest conversation carries over when they sign in.
- Each guest and each user has their own conversation history (the last 20 messages).
- Sessions use one signed, HttpOnly cookie named `__session` (the only cookie Firebase Hosting
  forwards to Cloud Run).
- Rate limits: signed-in users 30 messages / 10 minutes; guests 15 / hour per IP.
- Idle conversations are deleted automatically: guests after 7 days, users after 90.

## Project structure

```
backend/
  app/main.py          FastAPI app: routers, CORS
  routers/             One APIRouter per feature (health_check, auth, chat, listen, conversation)
  model/               Pydantic request/response models
  source/              Business logic: brain (LLM), ears (STT), voice (TTS), provider fallback,
                       storage (Firestore / in-memory), Google token verification, guest limits
  utility/             Settings, session cookie, identity, rate limiter, errors, logger
  tests/               pytest suite
  Dockerfile           Cloud Run image
frontend/
  src/api.js           Calls to the backend API
  src/hooks/           useAssistant, useAuth, useGoogleButton, useHealth, useClock
  src/components/      Reactor, HUD panels, chat log, command bar, sign-in dialog, boot sequence
  public/              privacy.html, terms.html, favicon
firebase.json          Hosting config: serves the UI, rewrites /mahakal/api/** to Cloud Run
deploy/cloud-run.env.yaml  Cloud Run environment variables (no secrets)
.github/workflows/     ci.yml (tests on every PR), deploy.yml (deploys after CI passes on main)
docs/deploy-gcp.md     One-time Google Cloud setup and deployment guide
```

## Getting started

Requires Python 3.12 and Node 22.

```bash
# Backend (http://localhost:8000)
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env     # add GROQ_API_KEY, GEMINI_API_KEY and GOOGLE_CLIENT_ID
uvicorn app.main:app --reload

# Frontend (http://localhost:5173, proxies /mahakal/api to :8000), in a second terminal
cd frontend
npm install
npm run dev
```

Or run the backend in Docker (same image as production): `docker compose up --build`.

Locally, conversations are kept in memory (`STORAGE_BACKEND=memory`). To use the real Firestore
database instead, run `gcloud auth application-default login` and set `STORAGE_BACKEND=firestore`.

Voice input needs microphone access, which browsers only allow over HTTPS or on `localhost`.

To show a portrait of Mahakal inside the reactor core instead of the built-in trishul
emblem, add an image you have the rights to at `frontend/public/mahakal.png`.

## API

All endpoints live under `/mahakal/api/v1`. Interactive docs: http://localhost:8000/mahakal/api/v1/docs

| Method | Path | Description |
|---|---|---|
| GET | `/health` | Health check, configured AI providers, sign-in and storage status |
| GET | `/auth/me` | Signed-in user or guest messages left, plus the Google client ID |
| POST | `/auth/google` | `{"credential": "<Google ID token>"}` → signs in |
| POST | `/auth/logout` | Signs out (guest message count is kept) |
| POST | `/chat` | `{"text": "..."}` → `{"reply", "audio_b64", "guest_remaining"}` |
| POST | `/listen` | Multipart audio `file` → `{"transcript", "reply", "audio_b64", "guest_remaining"}` |
| POST | `/reset` | Clears your conversation history |

Errors use the shape `{"detail": {"error_message", "error_type"}}`: 401 `GuestLimitReachedError`
when a guest must sign in, 429 when rate-limited, 502 when every AI provider failed, 503 when not configured.

## Tests

```bash
cd backend && python -m pytest      # backend
cd frontend && npm test             # frontend (Vitest + Testing Library)
```

## Deployment

Merging a PR into `main` runs CI; when it passes, `.github/workflows/deploy.yml` deploys the API to
Cloud Run and the UI to Firebase Hosting. API keys live in Secret Manager, never in the repo; the
app reads them at startup (`SECRETS_SOURCE=secret-manager`, see `backend/utility/secrets.py`).
One-time setup: [docs/deploy-gcp.md](docs/deploy-gcp.md).

## Roadmap

- [ ] Tool calling (weather, time, Spotify, file search)
- [ ] Wake word (openWakeWord)
- [ ] Long-term memories per user
- [ ] Delete-my-account button
