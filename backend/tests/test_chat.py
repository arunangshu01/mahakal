import base64

import pytest

from source.brain import brain
from source.storage import store
from source.voice import voice
from tests.conftest import TEST_USER
from utility.errors import AllProvidersFailedError, NoProviderConfiguredError
from utility.settings import HISTORY_LIMIT, MAX_MESSAGE_LENGTH


def test_chat_returns_reply_and_audio(client, api_base, fake_llm, fake_voice):
    res = client.post(f"{api_base}/chat", json={"text": "Hello"})
    assert res.status_code == 200
    body = res.json()
    assert body["reply"] == "echo: Hello"
    assert base64.b64decode(body["audio_b64"]) == b"mp3:echo: Hello"
    assert body["guest_remaining"] == 4


def test_signed_in_users_have_no_guest_counter(signed_in_client, api_base, fake_llm, fake_voice):
    res = signed_in_client.post(f"{api_base}/chat", json={"text": "Hello"})
    assert res.status_code == 200
    assert res.json()["guest_remaining"] is None
    assert store.load(f"user_{TEST_USER['id']}").messages[-1]["content"] == "echo: Hello"


def test_each_visitor_has_their_own_history(client, api_base, fake_llm, fake_voice):
    from fastapi.testclient import TestClient
    from app.main import app

    other = TestClient(app)
    client.post(f"{api_base}/chat", json={"text": "  first  "})
    other.post(f"{api_base}/chat", json={"text": "someone else"})

    conversations = [c.messages for c in store.conversations.values()]
    assert len(conversations) == 2
    assert [m["content"] for m in conversations[0]] == ["first", "echo: first"]


def test_history_is_capped(signed_in_client, api_base, fake_llm, fake_voice):
    for i in range(HISTORY_LIMIT):
        signed_in_client.post(f"{api_base}/chat", json={"text": f"message {i}"})
    messages = store.load(f"user_{TEST_USER['id']}").messages
    assert len(messages) == HISTORY_LIMIT
    assert messages[-1]["content"] == f"echo: message {HISTORY_LIMIT - 1}"


@pytest.mark.parametrize("payload", [{}, {"text": ""}, {"text": "   "}, {"text": "x" * (MAX_MESSAGE_LENGTH + 1)}])
def test_chat_rejects_invalid_messages(client, api_base, payload):
    assert client.post(f"{api_base}/chat", json=payload).status_code == 422


@pytest.mark.parametrize("error, status_code", [
    (NoProviderConfiguredError("no keys"), 503),
    (AllProvidersFailedError("down"), 502),
    (ValueError("boom"), 500),
])
def test_chat_maps_provider_errors(client, api_base, monkeypatch, error, status_code):
    def failing_run(task, groq_call, gemini_call):
        raise error
    monkeypatch.setattr(brain.llm, "run", failing_run)

    res = client.post(f"{api_base}/chat", json={"text": "Hello"})
    assert res.status_code == status_code
    detail = res.json()["detail"]
    assert detail["error_type"] == type(error).__name__
    assert detail["error_message"].startswith("Error:")
    # A failed reply is neither saved nor counted against the guest allowance.
    assert all(not c.messages and c.guest_messages_used == 0 for c in store.conversations.values())


def test_chat_still_replies_when_speech_fails(client, api_base, fake_llm, monkeypatch):
    async def broken_speak(self, text):
        raise ConnectionError("tts down")
    monkeypatch.setattr(type(voice), "speak", broken_speak)

    res = client.post(f"{api_base}/chat", json={"text": "Hello"})
    assert res.status_code == 200
    assert res.json()["reply"] == "echo: Hello"
    assert res.json()["audio_b64"] == ""
