from typing import Literal

from pydantic import BaseModel


class ResetSuccess(BaseModel):
    message: str


class HistoryMessage(BaseModel):
    role: Literal['user', 'assistant']
    content: str


class ConversationHistory(BaseModel):
    messages: list[HistoryMessage]
