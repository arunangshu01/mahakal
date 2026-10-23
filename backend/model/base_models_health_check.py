from pydantic import BaseModel


class ProviderStatus(BaseModel):
    groq: bool
    gemini: bool


class HealthCheck(BaseModel):
    status: str
    code: int
    providers: ProviderStatus
    google_sign_in: bool
    storage: str
