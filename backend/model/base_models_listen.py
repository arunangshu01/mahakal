from typing import Optional

from pydantic import BaseModel


class ListenResponse(BaseModel):
    transcript: str
    reply: str
    audio_b64: str
    guest_remaining: Optional[int] = None
