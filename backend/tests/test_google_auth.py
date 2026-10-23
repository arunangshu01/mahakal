import pytest

from source import google_auth
from utility.errors import InvalidGoogleTokenError, SignInNotConfiguredError

CLAIMS = {"sub": "42", "email": "parvati@example.com", "email_verified": True, "name": "Parvati", "picture": "p.png"}


def test_valid_token_returns_profile(monkeypatch):
    seen = {}

    def verify(token, request, audience):
        seen.update(token=token, audience=audience)
        return dict(CLAIMS)
    monkeypatch.setattr(google_auth.id_token, "verify_oauth2_token", verify)

    profile = google_auth.verify_google_credential("token")
    assert profile == {"id": "42", "email": "parvati@example.com", "name": "Parvati", "picture": "p.png"}
    assert seen == {"token": "token", "audience": google_auth.GOOGLE_CLIENT_ID}


def test_invalid_token_raises(monkeypatch):
    def verify(token, request, audience):
        raise ValueError("Token expired")
    monkeypatch.setattr(google_auth.id_token, "verify_oauth2_token", verify)
    with pytest.raises(InvalidGoogleTokenError):
        google_auth.verify_google_credential("token")


def test_unverified_email_is_rejected(monkeypatch):
    monkeypatch.setattr(google_auth.id_token, "verify_oauth2_token", lambda *a: {**CLAIMS, "email_verified": False})
    with pytest.raises(InvalidGoogleTokenError):
        google_auth.verify_google_credential("token")


def test_requires_client_id(monkeypatch):
    monkeypatch.setattr(google_auth, "GOOGLE_CLIENT_ID", "")
    with pytest.raises(SignInNotConfiguredError):
        google_auth.verify_google_credential("token")
