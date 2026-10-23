from pydantic import BaseModel, Field, field_validator

from utility.settings import MAX_MESSAGE_LENGTH


class ChatRequest(BaseModel):
    text: str = Field(..., max_length=MAX_MESSAGE_LENGTH)

    @field_validator('text')
    @classmethod
    def validate_text(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError('Message must not be empty.')
        return value


class ChatResponse(BaseModel):
    reply: str
    audio_b64: str
