from fastapi import APIRouter, File, UploadFile, status
from starlette.concurrency import run_in_threadpool

from model.base_models_errors import ErrorResponse
from model.base_models_listen import ListenResponse
from source.assistant import respond
from source.ears import ears
from utility.errors import api_error, assistant_error
from utility.logger import Logger
from utility.settings import MAX_AUDIO_BYTES

logger = Logger(__name__)

router = APIRouter(tags=["Voice"])

NOT_HEARD_REPLY = "I didn't catch that."


@router.post(
    '/listen',
    status_code=status.HTTP_200_OK,
    response_model=ListenResponse,
    responses={
        400: {"model": ErrorResponse},
        413: {"model": ErrorResponse},
        500: {"model": ErrorResponse},
        502: {"model": ErrorResponse},
        503: {"model": ErrorResponse},
    },
)
async def listen(file: UploadFile = File(...)):
    """Recorded speech in, transcript plus reply text and spoken audio out."""
    audio_bytes = await file.read()
    if not audio_bytes:
        raise api_error(status.HTTP_400_BAD_REQUEST, "Error: The audio recording is empty.", "EmptyAudio")
    if len(audio_bytes) > MAX_AUDIO_BYTES:
        raise api_error(
            status.HTTP_413_CONTENT_TOO_LARGE, "Error: The audio recording is too long.", "AudioTooLarge"
        )

    try:
        transcript = await run_in_threadpool(ears.transcribe, audio_bytes, file.filename or 'speech.webm')
        if not transcript:
            return ListenResponse(transcript='', reply=NOT_HEARD_REPLY, audio_b64='').model_dump()
        reply, audio_b64 = await respond(transcript)
    except Exception as e:
        logger.error(f"Listen failed ({type(e).__name__}: {e})")
        raise assistant_error(e)
    return ListenResponse(transcript=transcript, reply=reply, audio_b64=audio_b64).model_dump()
