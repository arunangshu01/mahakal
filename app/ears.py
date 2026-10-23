import mimetypes

from google.genai import types

from .config import GEMINI_MODEL
from .providers import gemini_client, groq_client, with_fallback


def transcribe(audio_bytes: bytes, filename: str = "audio.webm") -> str:
    def groq_fn() -> str:
        # Groq's hosted Whisper — free tier, very fast
        return groq_client.audio.transcriptions.create(
            model="whisper-large-v3-turbo",
            file=(filename, audio_bytes),
        ).text

    def gemini_fn() -> str:
        mime = mimetypes.guess_type(filename)[0] or "audio/webm"
        return gemini_client.models.generate_content(
            model=GEMINI_MODEL,
            contents=[
                types.Part.from_bytes(data=audio_bytes, mime_type=mime),
                "Transcribe this audio verbatim. Return only the transcript, or nothing if there is no speech.",
            ],
        ).text or ""

    return with_fallback("transcription", groq_fn, gemini_fn)
