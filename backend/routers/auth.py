from fastapi import APIRouter, Depends, Response, status
from starlette.concurrency import run_in_threadpool

from model.base_models_auth import GoogleSignInRequest, GuestStatus, SessionResponse, UserProfile
from model.base_models_errors import ErrorResponse
from source.assistant import guest_messages_remaining
from source.google_auth import verify_google_credential
from source.storage import store
from utility.errors import assistant_error
from utility.identity import Identity, get_identity
from utility.logger import Logger
from utility.session import write_session
from utility.settings import GOOGLE_CLIENT_ID, GUEST_MESSAGE_LIMIT

logger = Logger(__name__)

router = APIRouter(prefix='/auth', tags=["Authentication"])


def session_response(identity: Identity) -> dict:
    guest = (
        GuestStatus(remaining=guest_messages_remaining(identity), limit=GUEST_MESSAGE_LIMIT)
        if identity.is_guest else None
    )
    user = UserProfile(**identity.user) if identity.user else None
    return SessionResponse(user=user, guest=guest, google_client_id=GOOGLE_CLIENT_ID).model_dump()


def carry_over_guest_conversation(guest_key: str, user_key: str) -> None:
    """Keep the guest's recent chat when they sign in, unless the account already has history."""
    guest_conversation = store.load(guest_key)
    user_conversation = store.load(user_key)
    if guest_conversation.messages and not user_conversation.messages:
        user_conversation.messages = guest_conversation.messages
        store.save(user_key, user_conversation)
        guest_conversation.messages = []
        store.save(guest_key, guest_conversation)


@router.get('/me', status_code=status.HTTP_200_OK, response_model=SessionResponse)
async def current_session(identity: Identity = Depends(get_identity)):
    """Who is signed in, or how many guest messages are left. Also returns the Google client ID."""
    return session_response(identity)


@router.post(
    '/google',
    status_code=status.HTTP_200_OK,
    response_model=SessionResponse,
    responses={code: {"model": ErrorResponse} for code in (401, 500, 503)},
)
async def sign_in_with_google(
    sign_in: GoogleSignInRequest, response: Response, identity: Identity = Depends(get_identity)
):
    try:
        profile = await run_in_threadpool(verify_google_credential, sign_in.credential)
        guest_key = identity.conversation_key
        await run_in_threadpool(store.save_user, profile)
        signed_in = Identity(guest_id=identity.guest_id, user=profile)
        await run_in_threadpool(carry_over_guest_conversation, guest_key, signed_in.conversation_key)
    except Exception as e:
        logger.warning(f"Google sign-in failed ({type(e).__name__}: {e})")
        raise assistant_error(e)
    write_session(response, signed_in.to_session())
    logger.info("User signed in with Google.")
    return session_response(signed_in)


@router.post('/logout', status_code=status.HTTP_200_OK, response_model=SessionResponse)
async def sign_out(response: Response, identity: Identity = Depends(get_identity)):
    # Keep the guest ID so signing out does not reset the free guest messages.
    guest = Identity(guest_id=identity.guest_id)
    write_session(response, guest.to_session())
    return session_response(guest)
