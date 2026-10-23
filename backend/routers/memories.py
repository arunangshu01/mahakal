from fastapi import APIRouter, Depends, status

from model.base_models_errors import ErrorResponse
from model.base_models_memories import MemoryList
from source.storage import store
from utility.errors import api_error
from utility.identity import Identity, get_identity
from utility.logger import Logger

logger = Logger(__name__)

router = APIRouter(prefix='/memories', tags=["Memory"])

SIGNED_IN_ONLY = {401: {"model": ErrorResponse}, 404: {"model": ErrorResponse}}


def require_user(identity: Identity = Depends(get_identity)) -> str:
    if identity.is_guest:
        raise api_error(status.HTTP_401_UNAUTHORIZED, 'Error: Sign in to use long-term memory.', 'SignInRequired')
    return identity.user['id']


@router.get('', status_code=status.HTTP_200_OK, response_model=MemoryList, responses=SIGNED_IN_ONLY)
async def list_memories(user_id: str = Depends(require_user)):
    """What M.A.H.A.K.A.L. remembers about you."""
    return MemoryList(memories=store.load_memories(user_id)).model_dump()


@router.delete('/{index}', status_code=status.HTTP_200_OK, response_model=MemoryList, responses=SIGNED_IN_ONLY)
async def delete_memory(index: int, user_id: str = Depends(require_user)):
    """Forget one memory (by its position in the list)."""
    memories = store.load_memories(user_id)
    if not 0 <= index < len(memories):
        raise api_error(status.HTTP_404_NOT_FOUND, 'Error: That memory no longer exists.', 'MemoryNotFound')
    memories.pop(index)
    store.save_memories(user_id, memories)
    return MemoryList(memories=memories).model_dump()


@router.delete('', status_code=status.HTTP_200_OK, response_model=MemoryList, responses=SIGNED_IN_ONLY)
async def clear_memories(user_id: str = Depends(require_user)):
    """Forget everything."""
    store.save_memories(user_id, [])
    logger.info("Memories cleared.")
    return MemoryList(memories=[]).model_dump()
