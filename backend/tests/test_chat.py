import base64

import pytest

from source.brain import brain
from source.voice import voice
from utility.errors import AllProvidersFailedError, NoProviderConfiguredError
from utility.settings import MAX_MESSAGE_LENGTH


def test_chat_returns_reply_and_audio(client, api_base, fake_llm, fake_voice):
    res = client.post(f"{api_base}/chat", json={"text": "Hello"})
    assert res.status_code == 200
    body = res.json()
    assert body["reply"] == "echo: Hello"
    assert base64.b64decode(body["audio_b64"]) == b"mp3:echo: Hello"


def test_chat_strips_whitespace_and_keeps_history(client, api_base, fake_llm, fake_voice):
    client.post(f"{api_base}/chat", json={"text": "  first  "})
    client.post(f"{api_base}/chat", json={"text": "second"})
    assert [m["role"] for m in brain.history] == ["user", "assistant", "user", "assistant"]
    assert brain.history[0]["content"] == "first"


@pytest.mark.parametrize("payload", [{}, {"text": ""}, {"text": "   "}, {"text": "x" * (MAX_MESSAGE_LENGTH + 1)}])
def test_chat_rejects_invalid_messages(client, api_base, payload):
    res = client.post(f"{api_base}/chat", json=payload)
    assert res.status_code == 422


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
    assert brain.history == []


def test_chat_still_replies_when_speech_fails(client, api_base, fake_llm, monkeypatch):
    async def broken_speak(self, text):
        raise ConnectionError("tts down")
    monkeypatch.setattr(type(voice), "speak", broken_speak)

    res = client.post(f"{api_base}/chat", json={"text": "Hello"})
    assert res.status_code == 200
    assert res.json() == {"reply": "echo: Hello", "audio_b64": ""}
