from starlette.concurrency import run_in_threadpool

from source.brain import brain
from source.voice import voice
from utility.logger import Logger

logger = Logger(__name__)


async def respond(text: str) -> tuple[str, str]:
    """Generate a reply to `text` and its spoken audio (base64 mp3).

    A text-to-speech failure is not fatal: the reply is still returned, just without audio.
    """
    reply = await run_in_threadpool(brain.think, text)
    try:
        audio_b64 = await voice.speak_base64(reply)
    except Exception as e:
        logger.warning(f"Text-to-speech failed, replying without audio ({type(e).__name__}: {e})")
        audio_b64 = ''
    return reply, audio_b64
