import pytest
from fastapi.testclient import TestClient

from app.main import app
from source.brain import brain
from source.voice import voice
from utility.settings import API_COMMON_PREFIX


@pytest.fixture(scope="session")
def api_base():
    return API_COMMON_PREFIX


@pytest.fixture()
def client():
    return TestClient(app)


@pytest.fixture(autouse=True)
def clean_history():
    brain.reset()
    yield
    brain.reset()


@pytest.fixture()
def fake_voice(monkeypatch):
    async def fake_speak(self, text):
        return b"mp3:" + text.encode()
    monkeypatch.setattr(type(voice), "speak", fake_speak)


@pytest.fixture()
def fake_llm(monkeypatch):
    """Make the brain answer without calling any real provider."""
    def fake_run(task, groq_call, gemini_call):
        return f"echo: {brain.history[-1]['content']}"
    monkeypatch.setattr(brain.llm, "run", fake_run)
