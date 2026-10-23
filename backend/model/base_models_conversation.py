from pydantic import BaseModel


class ResetSuccess(BaseModel):
    message: str
