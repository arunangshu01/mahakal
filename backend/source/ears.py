import mimetypes

from google import genai
from google.genai import types
from groq import Groq

from source.llm_providers import LLMProviders, providers
from utility.settings import GEMINI_MODEL, GROQ_STT_MODEL

TRANSCRIBE_PROMPT = 'Transcribe this audio verbatim. Return only the transcript, or nothing if there is no speech.'


class Ears:
    """Speech-to-text: Groq-hosted Whisper, with Gemini as the fallback."""

    def __init__(self, llm: LLMProviders):
        self.llm = llm

    def transcribe(self, audio_bytes: bytes, filename: str = 'speech.webm') -> str:
        def groq_call(client: Groq) -> str:
            return client.audio.transcriptions.create(model=GROQ_STT_MODEL, file=(filename, audio_bytes)).text

        def gemini_call(client: genai.Client) -> str:
            response = client.models.generate_content(
                model=GEMINI_MODEL,
                contents=[types.Part.from_bytes(data=audio_bytes, mime_type=self.audio_mime_type(filename)),
                          TRANSCRIBE_PROMPT],
            )
            return response.text or ''

        return self.llm.run('transcription', groq_call, gemini_call).strip()

    @staticmethod
    def audio_mime_type(filename: str) -> str:
        # Browsers record into webm/ogg/mp4 containers, which mimetypes reports as video/*.
        mime_type = mimetypes.guess_type(filename)[0] or 'audio/webm'
        return mime_type.replace('video/', 'audio/')


ears = Ears(providers)
