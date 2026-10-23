# MAHAKAL

**M**odular **A**gentic **H**ub for **A**utomation, **K**nowledge & **A**daptive **L**ogic

A personal voice AI assistant — 100% free-tier stack.

## Stack

| Component | Service | Cost |
|---|---|---|
| Brain (LLM) | Groq API (Llama 3.3 70B), Gemini fallback | Free tier |
| Ears (STT) | Groq hosted Whisper, Gemini fallback | Free tier |
| Voice (TTS) | Microsoft Edge TTS | Free |
| Backend | FastAPI | — |
| UI | React + Vite (`ui/`) | — |
| Deploy | Render / Railway / fly.io | Free tier |

## Setup

```bash
# Backend
pip install -r requirements.txt
cp .env.example .env   # add GROQ_API_KEY (https://console.groq.com/keys)
                       # and optionally GEMINI_API_KEY (https://aistudio.google.com/apikey)
uvicorn app.main:app --reload

# React UI (separate terminal)
cd ui
npm install
npm run dev          # http://localhost:5173, proxies /api -> :8000
```

Open http://localhost:5173 — click the orb to talk, or type below it.
The orb pulses with your mic input while listening and with the voice
output while speaking (Web Audio analyser).

### Production (single server)

```bash
cd ui && npm run build && cd ..   # outputs ui/dist
uvicorn app.main:app              # serves UI + API at http://localhost:8000
```

## Roadmap

- [ ] Tool calling (weather, time, Spotify, file search)
- [ ] Wake word (openWakeWord)
- [ ] Persistent memory (SQLite)
- [ ] Deploy to Render free tier
