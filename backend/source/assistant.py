from dataclasses import dataclass
from typing import AsyncIterator, Optional

from starlette.concurrency import iterate_in_threadpool, run_in_threadpool

from source.brain import brain
from source.storage import Conversation
from source.tools import TOOL_LABELS, ToolContext
from source.voice import voice
from utility.errors import GuestLimitReachedError, RateLimitedError
from utility.identity import Identity
from utility.logger import Logger
from utility.rate_limit import InMemoryRateLimiter
from utility.settings import (
    DEFAULT_TIMEZONE,
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


def tool_context(identity: Identity, timezone: Optional[str]) -> ToolContext:
    if identity.is_guest:
        return ToolContext(timezone=timezone or DEFAULT_TIMEZONE)
    user_id = identity.user['id']
    return ToolContext(
        timezone=timezone or DEFAULT_TIMEZONE,
        user_id=user_id,
        user_name=identity.user.get('name'),
        memories=brain.conversations.load_memories(user_id),
    )


async def speak_or_silence(reply: str) -> str:
    """Spoken audio (base64 mp3) for the reply; a TTS failure just means no audio."""
    try:
        return await voice.speak_base64(reply)
    except Exception as e:
        logger.warning(f"Text-to-speech failed, replying without audio ({type(e).__name__}: {e})")
        return ''


def _guest_remaining(identity: Identity, conversation: Conversation) -> Optional[int]:
    return max(0, GUEST_MESSAGE_LIMIT - conversation.guest_messages_used) if identity.is_guest else None


async def respond(identity: Identity, text: str, timezone: Optional[str] = None) -> AssistantReply:
    """Generate the full reply to `text` and its spoken audio."""
    context = await run_in_threadpool(tool_context, identity, timezone)
    conversation = await run_in_threadpool(
        brain.think, identity.conversation_key, text, identity.is_guest, context
    )
    reply = conversation.messages[-1]['content']
    return AssistantReply(reply, await speak_or_silence(reply), _guest_remaining(identity, conversation))


async def respond_stream(identity: Identity, text: str, timezone: Optional[str] = None) -> AsyncIterator[dict]:
    """Yield reply events as they are generated:

    {"type": "tool", "name", "label"}   a tool is being used (e.g. checking the weather)
    {"type": "delta", "text"}           the next piece of the reply
    {"type": "done", "reply", "audio_b64", "guest_remaining"}
    """
    context = await run_in_threadpool(tool_context, identity, timezone)
    conversation = None
    events = brain.stream(identity.conversation_key, text, identity.is_guest, context)
    async for event in iterate_in_threadpool(events):
        if isinstance(event, Conversation):
            conversation = event
        elif event.type == 'tool':
            yield {'type': 'tool', 'name': event.name, 'label': TOOL_LABELS.get(event.name, 'Working')}
        else:
            yield {'type': 'delta', 'text': event.text}

    reply = conversation.messages[-1]['content']
    yield {
        'type': 'done',
        'reply': reply,
        'audio_b64': await speak_or_silence(reply),
        'guest_remaining': _guest_remaining(identity, conversation),
    }
