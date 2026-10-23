from source import assistant
from utility.settings import GUEST_MESSAGE_LIMIT, USER_RATE_LIMIT_MAX_REQUESTS


def test_guests_get_a_few_free_messages_then_must_sign_in(client, api_base, fake_llm, fake_voice):
    remaining = [
        client.post(f"{api_base}/chat", json={"text": f"hi {i}"}).json()["guest_remaining"]
        for i in range(GUEST_MESSAGE_LIMIT)
    ]
    assert remaining == list(range(GUEST_MESSAGE_LIMIT - 1, -1, -1))

    res = client.post(f"{api_base}/chat", json={"text": "one more"})
    assert res.status_code == 401
    assert res.json()["detail"]["error_type"] == "GuestLimitReachedError"
    assert "Sign in with Google" in res.json()["detail"]["error_message"]


def test_voice_messages_count_towards_the_guest_limit(client, api_base, fake_llm, fake_voice, monkeypatch):
    from source.ears import ears
    monkeypatch.setattr(ears, "transcribe", lambda audio_bytes, filename="speech.webm": "hello")

    for _ in range(GUEST_MESSAGE_LIMIT):
        client.post(f"{api_base}/listen", files={"file": ("speech.webm", b"audio", "audio/webm")})
    res = client.post(f"{api_base}/listen", files={"file": ("speech.webm", b"audio", "audio/webm")})
    assert res.status_code == 401


def test_signing_in_lifts_the_guest_limit(client, api_base, fake_llm, fake_voice, fake_google):
    for i in range(GUEST_MESSAGE_LIMIT):
        client.post(f"{api_base}/chat", json={"text": f"hi {i}"})
    assert client.post(f"{api_base}/chat", json={"text": "blocked"}).status_code == 401

    client.post(f"{api_base}/auth/google", json={"credential": "valid-token"})
    assert client.post(f"{api_base}/chat", json={"text": "now allowed"}).status_code == 200


def test_signing_out_does_not_reset_guest_messages(client, api_base, fake_llm, fake_voice, fake_google):
    for i in range(GUEST_MESSAGE_LIMIT):
        client.post(f"{api_base}/chat", json={"text": f"hi {i}"})
    client.post(f"{api_base}/auth/google", json={"credential": "valid-token"})
    client.post(f"{api_base}/auth/logout")

    assert client.post(f"{api_base}/chat", json={"text": "still a guest"}).status_code == 401


def test_guests_are_rate_limited_per_ip(client, api_base, fake_llm, fake_voice, monkeypatch):
    monkeypatch.setattr(assistant, "guest_ip_limiter", assistant.InMemoryRateLimiter(2, 3600))
    from fastapi.testclient import TestClient
    from app.main import app

    # Fresh cookies each time, same IP: clearing cookies doesn't buy unlimited messages.
    statuses = [TestClient(app).post(f"{api_base}/chat", json={"text": "hi"}).status_code for _ in range(3)]
    assert statuses == [200, 200, 429]


def test_signed_in_users_are_rate_limited(signed_in_client, api_base, fake_llm, fake_voice, monkeypatch):
    monkeypatch.setattr(assistant, "user_limiter", assistant.InMemoryRateLimiter(2, 600))
    statuses = [signed_in_client.post(f"{api_base}/chat", json={"text": "hi"}).status_code for _ in range(3)]
    assert statuses == [200, 200, 429]
    assert USER_RATE_LIMIT_MAX_REQUESTS > 2
