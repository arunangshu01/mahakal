import base64
from pathlib import Path

from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from . import brain, ears, voice

app = FastAPI(title="MAHAKAL")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)
UI_DIST = Path(__file__).resolve().parent.parent / "ui" / "dist"


class ChatRequest(BaseModel):
    text: str


@app.post("/api/chat")
async def chat(req: ChatRequest):
    """Text in -> text + audio out."""
    reply = brain.think(req.text)
    audio = await voice.speak(reply)
    return {
        "reply": reply,
        "audio_b64": base64.b64encode(audio).decode(),
    }


@app.post("/api/listen")
async def listen(file: UploadFile = File(...)):
    """Audio in -> transcript -> reply text + audio out."""
    audio_bytes = await file.read()
    transcript = ears.transcribe(audio_bytes, file.filename or "audio.webm")
    if not transcript.strip():
        return {"transcript": "", "reply": "I didn't catch that.", "audio_b64": ""}
    reply = brain.think(transcript)
    tts_audio = await voice.speak(reply)
    return {
        "transcript": transcript,
        "reply": reply,
        "audio_b64": base64.b64encode(tts_audio).decode(),
    }


@app.post("/api/reset")
async def reset():
    brain.reset()
    return {"status": "ok"}


if UI_DIST.is_dir():
    app.mount("/", StaticFiles(directory=UI_DIST, html=True), name="ui")
