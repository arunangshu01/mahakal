from dataclasses import dataclass
from typing import Optional

from starlette.concurrency import run_in_threadpool

from source.brain import brain
from source.voice import voice
from utility.errors import GuestLimitReachedError, RateLimitedError
from utility.identity import Identity
from utility.logger import Logger
from utility.rate_limit import InMemoryRateLimiter
from utility.settings import (
    GUEST_IP_RATE_LIMIT_MAX_REQUESTS,
    GUEST_IP_RATE_LIMIT_WINDOW_SECONDS,
    GUEST_MESSAGE_LIMIT,
    USER_RATE_LIMIT_MAX_REQUESTS,
    USER_RATE_LIMIT_WINDOW_SECONDS,
)

logger = Logger(__name__)

user_limiter = InMemoryRateLimiter(USER_RATE_LIMIT_MAX_REQUESTS, USER_RATE_LIMIT_WINDOW_SECONDS)
# Guests are also limited per IP, so clearing cookies does not give unlimited free messages.
guest_ip_limiter = InMemoryRateLimiter(GUEST_IP_RATE_LIMIT_MAX_REQUESTS, GUEST_IP_RATE_LIMIT_WINDOW_SECONDS)


@dataclass
class AssistantReply:
    reply: str
    audio_b64: str
    guest_remaining: Optional[int]


def guest_messages_remaining(identity: Identity) -> Optional[int]:
    if not identity.is_guest:
        return None
    used = brain.conversations.load(identity.conversation_key).guest_messages_used
    return max(0, GUEST_MESSAGE_LIMIT - used)


def check_message_allowed(identity: Identity, ip: str) -> None:
    """Raise if this user or guest may not send another message right now."""
    if identity.is_guest:
        if guest_messages_remaining(identity) == 0:
            raise GuestLimitReachedError(identity.guest_id)
        if not guest_ip_limiter.allow(ip):
            raise RateLimitedError(ip)
    elif not user_limiter.allow(identity.user['id']):
        raise RateLimitedError(identity.user['id'])


async def respond(identity: Identity, text: str) -> AssistantReply:
    """Generate a reply to `text` and its spoken audio (base64 mp3).

    A text-to-speech failure is not fatal: the reply is still returned, just without audio.
    """
    conversation = await run_in_threadpool(
        brain.think, identity.conversation_key, text, identity.is_guest
    )
    reply = conversation.messages[-1]['content']
    try:
        audio_b64 = await voice.speak_base64(reply)
    except Exception as e:
        logger.warning(f"Text-to-speech failed, replying without audio ({type(e).__name__}: {e})")
        audio_b64 = ''
    guest_remaining = max(0, GUEST_MESSAGE_LIMIT - conversation.guest_messages_used) if identity.is_guest else None
    return AssistantReply(reply, audio_b64, guest_remaining)
