import base64
import re

import edge_tts

from utility.settings import ASSISTANT_NAME, ASSISTANT_SPOKEN_NAME, TTS_VOICE


class Voice:
    """Text-to-speech using Microsoft Edge TTS (free, no API key)."""

    def __init__(self, voice: str = TTS_VOICE):
        self.voice = voice

    @staticmethod
    def prepare_for_speech(text: str) -> str:
        # Otherwise the TTS engine spells the name out letter by letter.
        text = text.replace(ASSISTANT_NAME, ASSISTANT_SPOKEN_NAME).replace(
            ASSISTANT_NAME.rstrip('.'), ASSISTANT_SPOKEN_NAME
        )
        # Markdown symbols would be read out loud ("asterisk asterisk").
        text = re.sub(r'[*_`#]+', '', text)
        return re.sub(r'[\u00a0\u202f]', ' ', text)

    async def speak(self, text: str) -> bytes:
        communicate = edge_tts.Communicate(self.prepare_for_speech(text), self.voice)
        audio = bytearray()
        async for chunk in communicate.stream():
            if chunk['type'] == 'audio':
                audio.extend(chunk['data'])
        return bytes(audio)

    async def speak_base64(self, text: str) -> str:
        return base64.b64encode(await self.speak(text)).decode()


voice = Voice()
