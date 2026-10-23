from fastapi import APIRouter, status

from model.base_models_conversation import ResetSuccess
from source.brain import brain
from utility.logger import Logger

logger = Logger(__name__)

router = APIRouter(tags=["Conversation"])


@router.post('/reset', status_code=status.HTTP_200_OK, response_model=ResetSuccess)
async def reset_conversation():
    brain.reset()
    logger.info("Conversation history cleared.")
    return ResetSuccess(message="Conversation history cleared.").model_dump()
