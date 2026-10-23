from typing import Optional

from fastapi import APIRouter, Depends, File, Form, Request, UploadFile, status
from starlette.concurrency import run_in_threadpool

from model.base_models_errors import ErrorResponse
from model.base_models_listen import ListenResponse
from source.assistant import check_message_allowed, guest_messages_remaining, respond
from source.ears import ears
from utility.errors import api_error, assistant_error
from utility.identity import Identity, client_ip, get_identity
from utility.logger import Logger
from utility.settings import MAX_AUDIO_BYTES

logger = Logger(__name__)

router = APIRouter(tags=["Voice"])

NOT_HEARD_REPLY = "I didn't catch that."


@router.post(
    '/listen',
    status_code=status.HTTP_200_OK,
    response_model=ListenResponse,
    responses={code: {"model": ErrorResponse} for code in (400, 401, 413, 429, 500, 502, 503)},
)
async def listen(
    request: Request,
    file: UploadFile = File(...),
    timezone: Optional[str] = Form(None, max_length=64),
    identity: Identity = Depends(get_identity),
):
    """Recorded speech in, transcript plus reply text and spoken audio out."""
    audio_bytes = await file.read()
    if not audio_bytes:
        raise api_error(status.HTTP_400_BAD_REQUEST, "Error: The audio recording is empty.", "EmptyAudio")
    if len(audio_bytes) > MAX_AUDIO_BYTES:
        raise api_error(status.HTTP_413_CONTENT_TOO_LARGE, "Error: The audio recording is too long.", "AudioTooLarge")

    try:
        check_message_allowed(identity, client_ip(request))
        transcript = await run_in_threadpool(ears.transcribe, audio_bytes, file.filename or 'speech.webm')
        if not transcript:
            return ListenResponse(
                transcript='', reply=NOT_HEARD_REPLY, audio_b64='',
                guest_remaining=guest_messages_remaining(identity),
            ).model_dump()
        result = await respond(identity, transcript, timezone)
    except Exception as e:
        logger.error(f"Listen failed ({type(e).__name__}: {e})")
        raise assistant_error(e)
    return ListenResponse(
        transcript=transcript, reply=result.reply, audio_b64=result.audio_b64, guest_remaining=result.guest_remaining
    ).model_dump()
