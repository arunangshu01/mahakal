import base64
import hashlib
import hmac
import json
import time
import uuid
from typing import Optional

from fastapi import Request, Response

from utility.settings import COOKIE_SECURE, SESSION_COOKIE_NAME, SESSION_MAX_AGE_SECONDS, SESSION_SECRET


def _b64encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b'=').decode()


def _b64decode(data: str) -> bytes:
    return base64.urlsafe_b64decode(data + '=' * (-len(data) % 4))


def _sign(payload: str) -> str:
    return _b64encode(hmac.new(SESSION_SECRET.encode(), payload.encode(), hashlib.sha256).digest())


def encode_session(data: dict) -> str:
    payload = _b64encode(json.dumps(data, separators=(',', ':')).encode())
    return f"{payload}.{_sign(payload)}"


def decode_session(token: str) -> Optional[dict]:
    """Return the session data, or None if the token is malformed, tampered with or expired."""
    try:
        payload, signature = token.split('.', 1)
        if not hmac.compare_digest(signature, _sign(payload)):
            return None
        data = json.loads(_b64decode(payload))
    except (ValueError, json.JSONDecodeError):
        return None
    if not isinstance(data, dict) or data.get('exp', 0) < time.time() or not data.get('gid'):
        return None
    return data


def new_session() -> dict:
    return {'gid': uuid.uuid4().hex, 'user': None}


def read_session(request: Request) -> Optional[dict]:
    token = request.cookies.get(SESSION_COOKIE_NAME)
    return decode_session(token) if token else None


def write_session(response: Response, data: dict) -> None:
    data = {**data, 'exp': int(time.time()) + SESSION_MAX_AGE_SECONDS}
    # Replace (rather than duplicate) a session cookie set earlier in the same request.
    prefix = f"{SESSION_COOKIE_NAME}=".encode()
    response.raw_headers[:] = [
        (name, value) for name, value in response.raw_headers
        if not (name == b'set-cookie' and value.startswith(prefix))
    ]
    response.set_cookie(
        SESSION_COOKIE_NAME,
        encode_session(data),
        max_age=SESSION_MAX_AGE_SECONDS,
        httponly=True,
        secure=COOKIE_SECURE,
        samesite='lax',
        path='/',
    )
