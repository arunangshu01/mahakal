# M.A.H.A.K.A.L.

**M**odular **A**gentic **H**ub for **A**utomation, **K**nowledge & **A**daptive **L**ogic

A personal voice AI assistant with a JARVIS-style HUD, built entirely on free tiers.
Tap the reactor core and talk, or type a command. It answers out loud.

## Stack

| Component | Service | Cost |
|---|---|---|
| Brain (LLM) | Groq API (Llama 3.3 70B), Gemini fallback | Free tier |
| Ears (STT) | Groq hosted Whisper, Gemini fallback | Free tier |
| Voice (TTS) | Microsoft Edge TTS | Free |
| Backend | FastAPI (`backend/`) | — |
| Frontend | React + Vite (`frontend/`) | — |
| Deploy | Render / Railway / fly.io | Free tier |

If Groq fails or hits its rate limit, the same request is retried on Gemini automatically.
Either key can be left out; the app uses whichever provider is configured.

## Project structure

```
backend/
  app/main.py          FastAPI app: routers, CORS, serves frontend/dist in production
  routers/             One APIRouter per feature (health_check, chat, listen, conversation)
  model/               Pydantic request/response models
  source/              Business logic: brain (LLM), ears (STT), voice (TTS), provider fallback
  utility/             Settings, logger, error helpers
  tests/               pytest suite
frontend/
  src/api.js           Calls to the backend API
  src/hooks/           useAssistant (recording, playback, conversation), useHealth, useClock
  src/components/      Reactor, HUD panels, chat log, command bar, boot sequence
  src/styles/          Base theme and responsive layout
.github/workflows/     CI: backend + frontend tests on every pull request
```

## Getting started

Requires Python 3.12 and Node 22.

```bash
# Backend (http://localhost:8000)
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env     # add GROQ_API_KEY (https://console.groq.com/keys)
                         # and/or GEMINI_API_KEY (https://aistudio.google.com/apikey)
uvicorn app.main:app --reload

# Frontend (http://localhost:5173, proxies /api to :8000), in a second terminal
cd frontend
npm install
npm run dev
```

Voice input needs microphone access, which browsers only allow over HTTPS or on `localhost`.
To try it from a phone on your network, deploy it or put it behind an HTTPS tunnel.

To show a portrait of Mahakal inside the reactor core instead of the built-in trishul
emblem, add an image you have the rights to at `frontend/public/mahakal.png`.

## API

All endpoints live under `/api/v1`. Interactive docs: http://localhost:8000/api/v1/docs

| Method | Path | Description |
|---|---|---|
| GET | `/health` | Health check, plus which AI providers are configured |
| POST | `/chat` | `{"text": "..."}` → `{"reply", "audio_b64"}` |
| POST | `/listen` | Multipart audio `file` → `{"transcript", "reply", "audio_b64"}` |
| POST | `/reset` | Clears the conversation history |

Errors use the shape `{"detail": {"error_message", "error_type"}}`:
503 when no provider is configured, 502 when every provider failed.

## Tests

```bash
cd backend && python -m pytest      # backend
cd frontend && npm test             # frontend (Vitest + Testing Library)
```

GitHub Actions runs both suites, the frontend lint and the production build on every
pull request and on pushes to `main`.

## Production

The backend serves the built frontend, so one process runs everything:

```bash
cd frontend && npm ci && npm run build      # outputs frontend/dist
cd ../backend && pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

On Render/Railway use the same build command, and the start command from the `Procfile`.
Set `GROQ_API_KEY` / `GEMINI_API_KEY` as environment variables on the host, never in the repo.

## Roadmap

- [ ] Tool calling (weather, time, Spotify, file search)
- [ ] Wake word (openWakeWord)
- [ ] Persistent memory and per-user conversations (SQLite)
- [ ] Deploy to Render free tier
