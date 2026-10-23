import pytest

from source.ears import ears
from utility.errors import AllProvidersFailedError
from utility.settings import MAX_AUDIO_BYTES


@pytest.fixture()
def fake_ears(monkeypatch):
    calls = []

    def fake_transcribe(audio_bytes, filename="speech.webm"):
        calls.append((audio_bytes, filename))
        return "what time is it"
    monkeypatch.setattr(ears, "transcribe", fake_transcribe)
    return calls


def _upload(content=b"RIFF-audio", filename="speech.webm"):
    return {"file": (filename, content, "audio/webm")}


def test_listen_transcribes_and_replies(client, api_base, fake_ears, fake_llm, fake_voice):
    res = client.post(f"{api_base}/listen", files=_upload())
    assert res.status_code == 200
    body = res.json()
    assert body["transcript"] == "what time is it"
    assert body["reply"] == "echo: what time is it"
    assert body["audio_b64"]
    assert fake_ears == [(b"RIFF-audio", "speech.webm")]


def test_listen_handles_silence(client, api_base, monkeypatch, fake_llm):
    monkeypatch.setattr(ears, "transcribe", lambda audio_bytes, filename="speech.webm": "")
    res = client.post(f"{api_base}/listen", files=_upload())
    assert res.status_code == 200
    # Silence doesn't use up one of the guest's free messages.
    assert res.json() == {"transcript": "", "reply": "I didn't catch that.", "audio_b64": "", "guest_remaining": 5}


def test_listen_requires_a_file(client, api_base):
    assert client.post(f"{api_base}/listen").status_code == 422


def test_listen_rejects_empty_audio(client, api_base):
    res = client.post(f"{api_base}/listen", files=_upload(content=b""))
    assert res.status_code == 400
    assert res.json()["detail"]["error_type"] == "EmptyAudio"


def test_listen_rejects_oversized_audio(client, api_base):
    res = client.post(f"{api_base}/listen", files=_upload(content=b"0" * (MAX_AUDIO_BYTES + 1)))
    assert res.status_code == 413
    assert res.json()["detail"]["error_type"] == "AudioTooLarge"


def test_listen_reports_transcription_outage(client, api_base, monkeypatch):
    def failing_transcribe(audio_bytes, filename="speech.webm"):
        raise AllProvidersFailedError("down")
    monkeypatch.setattr(ears, "transcribe", failing_transcribe)

    res = client.post(f"{api_base}/listen", files=_upload())
    assert res.status_code == 502
    assert res.json()["detail"]["error_type"] == "AllProvidersFailedError"
