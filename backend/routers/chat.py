from fastapi import APIRouter, Depends, Request, status

from model.base_models_chat import ChatRequest, ChatResponse
from model.base_models_errors import ErrorResponse
from source.assistant import check_message_allowed, respond
from utility.errors import assistant_error
from utility.identity import Identity, client_ip, get_identity
from utility.logger import Logger

logger = Logger(__name__)

router = APIRouter(tags=["Chat"])


@router.post(
    '/chat',
    status_code=status.HTTP_200_OK,
    response_model=ChatResponse,
    responses={code: {"model": ErrorResponse} for code in (401, 429, 500, 502, 503)},
)
async def chat(chat_request: ChatRequest, request: Request, identity: Identity = Depends(get_identity)):
    """Text in, reply text and spoken audio out. Guests get a few free messages."""
    try:
        check_message_allowed(identity, client_ip(request))
        result = await respond(identity, chat_request.text)
    except Exception as e:
        logger.error(f"Chat failed ({type(e).__name__}: {e})")
        raise assistant_error(e)
    return ChatResponse(
        reply=result.reply, audio_b64=result.audio_b64, guest_remaining=result.guest_remaining
    ).model_dump()
