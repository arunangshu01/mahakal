import os

# Tests never touch real services, whatever is in backend/.env (load_dotenv won't override these).
os.environ.update({
    "SECRETS_SOURCE": "env",
    "STORAGE_BACKEND": "memory",
    "SESSION_SECRET": "test-session-secret",
    "GOOGLE_CLIENT_ID": "test-client-id.apps.googleusercontent.com",
    "GUEST_MESSAGE_LIMIT": "5",
    "COOKIE_SECURE": "false",
})

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

import routers.auth as auth_router  # noqa: E402
from app.main import app  # noqa: E402
from source import assistant  # noqa: E402
from source.brain import brain  # noqa: E402
from source.storage import store  # noqa: E402
from source.voice import voice  # noqa: E402
from utility.settings import API_COMMON_PREFIX  # noqa: E402

TEST_USER = {"id": "1234567890", "email": "shiva@example.com", "name": "Shiva", "picture": "https://example.com/a.png"}


@pytest.fixture(scope="session")
def api_base():
    return API_COMMON_PREFIX


@pytest.fixture()
def client():
    return TestClient(app)


@pytest.fixture(autouse=True)
def clean_state():
    store.clear()
    assistant.user_limiter.reset()
    assistant.guest_ip_limiter.reset()
    yield
    store.clear()


@pytest.fixture()
def fake_voice(monkeypatch):
    async def fake_speak(self, text):
        return b"mp3:" + text.encode()
    monkeypatch.setattr(type(voice), "speak", fake_speak)


@pytest.fixture()
def fake_llm(monkeypatch):
    """Make the brain answer without calling any real provider (records the context it was given)."""
    from source.brain import StreamEvent
    seen = []

    def fake_generate(history, context):
        seen.append(context)
        yield StreamEvent("delta", text="echo: ")
        yield StreamEvent("delta", text=history[-1]["content"])
    monkeypatch.setattr(brain, "generate", fake_generate)
    return seen


@pytest.fixture()
def fake_google(monkeypatch):
    """Accept the credential "valid-token" as TEST_USER; reject anything else."""
    from utility.errors import InvalidGoogleTokenError

    def verify(credential):
        if credential != "valid-token":
            raise InvalidGoogleTokenError("bad token")
        return dict(TEST_USER)
    monkeypatch.setattr(auth_router, "verify_google_credential", verify)


@pytest.fixture()
def signed_in_client(client, api_base, fake_google):
    assert client.post(f"{api_base}/auth/google", json={"credential": "valid-token"}).status_code == 200
    return client
