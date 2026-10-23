import edge_tts
from .config import TTS_VOICE


async def speak(text: str) -> bytes:
    """Return mp3 audio bytes for the given text (Microsoft Edge TTS — free)."""
    communicate = edge_tts.Communicate(text, TTS_VOICE)
    audio = bytearray()
    async for chunk in communicate.stream():
        if chunk["type"] == "audio":
            audio.extend(chunk["data"])
    return bytes(audio)
