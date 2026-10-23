from pydantic import BaseModel


class MemoryList(BaseModel):
    memories: list[str]
