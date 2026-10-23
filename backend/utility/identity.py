from dataclasses import dataclass
from typing import Optional

from fastapi import Request, Response

from utility.errors import api_error
from utility.session import new_session, read_session, read_stream_token, write_session


@dataclass
class Identity:
    """Who is talking: a signed-in Google user, or an anonymous guest."""

    guest_id: str
    user: Optional[dict] = None

    @property
    def is_guest(self) -> bool:
        return self.user is None

    @property
    def conversation_key(self) -> str:
        return f"guest_{self.guest_id}" if self.is_guest else f"user_{self.user['id']}"

    def to_session(self) -> dict:
        return {'gid': self.guest_id, 'user': self.user}


def get_identity(request: Request, response: Response) -> Identity:
    """FastAPI dependency: read the session cookie, starting a guest session if there is none."""
    data = read_session(request) or new_session()
    identity = Identity(guest_id=data['gid'], user=data.get('user'))
    write_session(response, identity.to_session())
    return identity


def get_stream_identity(request: Request, response: Response) -> Identity:
    """Like get_identity, but also accepts a stream token (Authorization: Bearer ...).

    Production streams straight from Cloud Run, where the Firebase-domain cookie isn't sent.
    """
    authorization = request.headers.get('authorization', '')
    if authorization.lower().startswith('bearer '):
        data = read_stream_token(authorization[7:].strip())
        if not data:
            raise api_error(401, 'Error: Your session expired. Please try again.', 'InvalidStreamToken')
        return Identity(guest_id=data['gid'], user=data.get('user'))
    return get_identity(request, response)


def client_ip(request: Request) -> str:
    forwarded = request.headers.get('x-forwarded-for', '')
    if forwarded:
        return forwarded.split(',')[0].strip()
    return request.client.host if request.client else 'unknown'
