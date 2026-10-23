from fastapi import APIRouter, status

from model.base_models_chat import ChatRequest, ChatResponse
from model.base_models_errors import ErrorResponse
from source.assistant import respond
from utility.errors import assistant_error
from utility.logger import Logger

logger = Logger(__name__)

router = APIRouter(tags=["Chat"])


@router.post(
    '/chat',
    status_code=status.HTTP_200_OK,
    response_model=ChatResponse,
    responses={500: {"model": ErrorResponse}, 502: {"model": ErrorResponse}, 503: {"model": ErrorResponse}},
)
async def chat(chat_request: ChatRequest):
    """Text in, reply text and spoken audio out."""
    try:
        reply, audio_b64 = await respond(chat_request.text)
    except Exception as e:
        logger.error(f"Chat failed ({type(e).__name__}: {e})")
        raise assistant_error(e)
    return ChatResponse(reply=reply, audio_b64=audio_b64).model_dump()
