import json

from source.brain import StreamEvent, brain
from utility.settings import GUEST_MESSAGE_LIMIT


def events_from(response):
    return [json.loads(line[len("data: "):]) for line in response.text.splitlines() if line.startswith("data: ")]


def stream_token(client, api_base):
    res = client.post(f"{api_base}/chat/stream-token")
    assert res.status_code == 200
    return res.json()


def test_stream_token_points_at_the_stream_endpoint(client, api_base):
    body = stream_token(client, api_base)
    assert body["stream_url"] == f"{api_base}/chat/stream"
    assert body["expires_in"] > 0 and body["token"]


def test_streams_deltas_then_done_with_a_bearer_token(client, api_base, fake_llm, fake_voice):
    from fastapi.testclient import TestClient
    from app.main import app

    token = stream_token(client, api_base)["token"]
    cookieless = TestClient(app)  # like the browser calling Cloud Run directly
    res = cookieless.post(f"{api_base}/chat/stream", json={"text": "Namaste"}, headers={"Authorization": f"Bearer {token}"})

    assert res.status_code == 200
    assert res.headers["content-type"].startswith("text/event-stream")
    events = events_from(res)
    assert [e["type"] for e in events] == ["delta", "delta", "done"]
    assert "".join(e["text"] for e in events if e["type"] == "delta") == "echo: Namaste"
    assert events[-1]["reply"] == "echo: Namaste"
    assert events[-1]["audio_b64"]
    assert events[-1]["guest_remaining"] == GUEST_MESSAGE_LIMIT - 1
    # The message counts against the same guest that requested the token.
    assert client.get(f"{api_base}/auth/me").json()["guest"]["remaining"] == GUEST_MESSAGE_LIMIT - 1


def test_streaming_also_works_with_the_session_cookie(client, api_base, fake_llm, fake_voice):
    res = client.post(f"{api_base}/chat/stream", json={"text": "hi"})
    assert events_from(res)[-1]["type"] == "done"


def test_tool_use_is_reported(client, api_base, fake_voice, monkeypatch):
    def generate(history, context):
        yield StreamEvent("tool", name="get_weather")
        yield StreamEvent("delta", text="Sunny.")
    monkeypatch.setattr(brain, "generate", generate)

    events = events_from(client.post(f"{api_base}/chat/stream", json={"text": "weather?"}))
    assert events[0] == {"type": "tool", "name": "get_weather", "label": "Checking the weather"}


def test_invalid_or_expired_tokens_are_rejected(client, api_base):
    res = client.post(f"{api_base}/chat/stream", json={"text": "hi"}, headers={"Authorization": "Bearer forged.token"})
    assert res.status_code == 401
    assert res.json()["detail"]["error_type"] == "InvalidStreamToken"


def test_stream_tokens_cannot_be_used_as_cookies(client, api_base):
    from fastapi.testclient import TestClient
    from app.main import app
    from utility.settings import SESSION_COOKIE_NAME

    token = stream_token(client, api_base)["token"]
    res = TestClient(app, cookies={SESSION_COOKIE_NAME: token}).get(f"{api_base}/auth/me")
    # Treated as a brand-new visitor and given a proper session cookie instead.
    assert res.headers["set-cookie"].split(";")[0] != f"{SESSION_COOKIE_NAME}={token}"


def test_new_guests_get_a_session_cookie_from_the_stream_endpoint(client, api_base, fake_llm, fake_voice):
    res = client.post(f"{api_base}/chat/stream", json={"text": "hi"})
    assert res.headers["set-cookie"].startswith("__session=")


def test_guest_limit_is_checked_before_streaming(client, api_base, fake_llm, fake_voice):
    for i in range(GUEST_MESSAGE_LIMIT):
        client.post(f"{api_base}/chat/stream", json={"text": f"hi {i}"})
    res = client.post(f"{api_base}/chat/stream", json={"text": "one more"})
    assert res.status_code == 401
    assert res.json()["detail"]["error_type"] == "GuestLimitReachedError"


def test_failures_during_the_stream_become_an_error_event(client, api_base, monkeypatch):
    from utility.errors import AllProvidersFailedError

    def generate(history, context):
        raise AllProvidersFailedError("down")
        yield
    monkeypatch.setattr(brain, "generate", generate)

    events = events_from(client.post(f"{api_base}/chat/stream", json={"text": "hi"}))
    assert events == [{
        "type": "error",
        "error_message": "Error: The AI providers are unavailable right now. Please try again shortly.",
        "error_type": "AllProvidersFailedError",
    }]


def test_timezone_reaches_the_tools(client, api_base, fake_llm, fake_voice):
    client.post(f"{api_base}/chat/stream", json={"text": "time?", "timezone": "Europe/London"})
    assert fake_llm[-1].timezone == "Europe/London"
