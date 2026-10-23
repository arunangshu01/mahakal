from typing import Optional

from pydantic import BaseModel, Field


class GoogleSignInRequest(BaseModel):
    credential: str = Field(..., min_length=1, description="ID token from Google Identity Services")


class UserProfile(BaseModel):
    id: str
    email: str
    name: str
    picture: str = ''


class GuestStatus(BaseModel):
    remaining: int
    limit: int


class SessionResponse(BaseModel):
    user: Optional[UserProfile] = None
    guest: Optional[GuestStatus] = None
    google_client_id: str = ''
