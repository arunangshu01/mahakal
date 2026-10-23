import tempfile
from groq import Groq
from .config import GROQ_API_KEY

client = Groq(api_key=GROQ_API_KEY)


def transcribe(audio_bytes: bytes, filename: str = "audio.webm") -> str:
    # Groq's hosted Whisper — free tier, very fast
    with tempfile.NamedTemporaryFile(suffix=f".{filename.rsplit('.', 1)[-1]}", delete=False) as f:
        f.write(audio_bytes)
        path = f.name
    with open(path, "rb") as f:
        result = client.audio.transcriptions.create(
            model="whisper-large-v3-turbo",
            file=(filename, f.read()),
        )
    return result.text
