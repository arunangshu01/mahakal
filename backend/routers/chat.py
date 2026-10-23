import json

from fastapi import APIRouter, Depends, Request, Response, status
from fastapi.responses import StreamingResponse

from model.base_models_chat import ChatRequest, ChatResponse, StreamTokenResponse
from model.base_models_errors import ErrorResponse
from source.assistant import check_message_allowed, respond, respond_stream
from utility.errors import assistant_error
from utility.identity import Identity, client_ip, get_identity, get_stream_identity
from utility.logger import Logger
from utility.session import create_stream_token
from utility.settings import API_COMMON_PREFIX, STREAM_API_ORIGIN, STREAM_TOKEN_TTL_SECONDS

logger = Logger(__name__)

router = APIRouter(tags=["Chat"])

ERROR_RESPONSES = {code: {"model": ErrorResponse} for code in (401, 429, 500, 502, 503)}


@router.post('/chat', status_code=status.HTTP_200_OK, response_model=ChatResponse, responses=ERROR_RESPONSES)
async def chat(chat_request: ChatRequest, request: Request, identity: Identity = Depends(get_identity)):
    """Text in, the complete reply text and spoken audio out. Guests get a few free messages."""
    try:
        check_message_allowed(identity, client_ip(request))
        result = await respond(identity, chat_request.text, chat_request.timezone)
    except Exception as e:
        logger.error(f"Chat failed ({type(e).__name__}: {e})")
        raise assistant_error(e)
    return ChatResponse(
        reply=result.reply, audio_b64=result.audio_b64, guest_remaining=result.guest_remaining
    ).model_dump()


@router.post('/chat/stream-token', status_code=status.HTTP_200_OK, response_model=StreamTokenResponse)
async def chat_stream_token(identity: Identity = Depends(get_identity)):
    """A short-lived token and URL for /chat/stream.

    Firebase Hosting buffers responses, so in production the browser streams straight from
    Cloud Run (STREAM_API_ORIGIN), where the session cookie isn't available.
    """
    return StreamTokenResponse(
        token=create_stream_token(identity.to_session()),
        stream_url=f"{STREAM_API_ORIGIN}{API_COMMON_PREFIX}/chat/stream",
        expires_in=STREAM_TOKEN_TTL_SECONDS,
    ).model_dump()


def _sse(event: dict) -> str:
    return f"data: {json.dumps(event, ensure_ascii=False)}\n\n"


@router.post(
    '/chat/stream',
    status_code=status.HTTP_200_OK,
    responses={**ERROR_RESPONSES, 200: {"content": {"text/event-stream": {}}}},
)
async def chat_stream(
    chat_request: ChatRequest,
    request: Request,
    response: Response,
    identity: Identity = Depends(get_stream_identity),
):
    """Like /chat, but streams the reply as server-sent events while it is generated.

    Events: `tool` (a tool is being used), `delta` (next piece of text), `done` (full reply, audio,
    guest_remaining) or `error` (error_message, error_type).
    """
    try:
        check_message_allowed(identity, client_ip(request))
    except Exception as e:
        raise assistant_error(e)

    async def events():
        try:
            async for event in respond_stream(identity, chat_request.text, chat_request.timezone):
                yield _sse(event)
        except Exception as e:
            logger.error(f"Streaming chat failed ({type(e).__name__}: {e})")
            yield _sse({'type': 'error', **assistant_error(e).detail})

    streaming = StreamingResponse(
        events(),
        media_type='text/event-stream',
        headers={'Cache-Control': 'no-cache', 'X-Accel-Buffering': 'no'},
    )
    # FastAPI drops cookies set by dependencies when a Response is returned directly, so a new
    # guest's session cookie (cookie-based calls) has to be copied over explicitly.
    streaming.raw_headers.extend(header for header in response.raw_headers if header[0] == b'set-cookie')
    return streaming
