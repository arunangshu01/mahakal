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
