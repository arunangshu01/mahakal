from source.storage import store
from tests.conftest import TEST_USER
from utility.session import decode_session, encode_session
from utility.settings import GUEST_MESSAGE_LIMIT, SESSION_COOKIE_NAME


def test_new_visitors_are_guests(client, api_base):
    res = client.get(f"{api_base}/auth/me")
    assert res.status_code == 200
    body = res.json()
    assert body["user"] is None
    assert body["guest"] == {"remaining": GUEST_MESSAGE_LIMIT, "limit": GUEST_MESSAGE_LIMIT}
    assert body["google_client_id"] == "test-client-id.apps.googleusercontent.com"


def test_session_cookie_is_http_only_and_named_for_firebase(client, api_base):
    res = client.get(f"{api_base}/auth/me")
    cookie = res.headers["set-cookie"]
    assert cookie.startswith(f"{SESSION_COOKIE_NAME}=")
    assert "HttpOnly" in cookie
    assert "SameSite=lax" in cookie
    assert res.headers.get_list("set-cookie") == [cookie]


def test_google_sign_in(client, api_base, fake_google):
    res = client.post(f"{api_base}/auth/google", json={"credential": "valid-token"})
    assert res.status_code == 200
    assert res.json()["user"] == TEST_USER
    assert res.json()["guest"] is None
    assert store.users[TEST_USER["id"]]["email"] == TEST_USER["email"]

    assert client.get(f"{api_base}/auth/me").json()["user"]["name"] == "Shiva"


def test_invalid_google_token_is_rejected(client, api_base, fake_google):
    res = client.post(f"{api_base}/auth/google", json={"credential": "forged"})
    assert res.status_code == 401
    assert res.json()["detail"]["error_type"] == "InvalidGoogleTokenError"
    assert client.get(f"{api_base}/auth/me").json()["user"] is None


def test_sign_in_requires_a_credential(client, api_base):
    assert client.post(f"{api_base}/auth/google", json={}).status_code == 422


def test_logout(signed_in_client, api_base):
    res = signed_in_client.post(f"{api_base}/auth/logout")
    assert res.json()["user"] is None
    assert signed_in_client.get(f"{api_base}/auth/me").json()["user"] is None


def test_guest_chat_carries_over_after_sign_in(client, api_base, fake_llm, fake_voice, fake_google):
    client.post(f"{api_base}/chat", json={"text": "remember this"})
    client.post(f"{api_base}/auth/google", json={"credential": "valid-token"})
    messages = store.load(f"user_{TEST_USER['id']}").messages
    assert [m["content"] for m in messages] == ["remember this", "echo: remember this"]


def test_tampered_or_expired_cookies_start_a_new_guest_session(client, api_base):
    forged = encode_session({"gid": "abc", "user": TEST_USER, "exp": 9_999_999_999})
    client.cookies.set(SESSION_COOKIE_NAME, forged[:-2] + "xx")
    assert client.get(f"{api_base}/auth/me").json()["user"] is None

    expired = encode_session({"gid": "abc", "user": TEST_USER, "exp": 1})
    client.cookies.set(SESSION_COOKIE_NAME, expired)
    assert client.get(f"{api_base}/auth/me").json()["user"] is None


def test_session_round_trip():
    token = encode_session({"gid": "g1", "user": None, "exp": 9_999_999_999})
    assert decode_session(token)["gid"] == "g1"
    assert decode_session("not-a-token") is None
    assert decode_session(token + "x") is None


def test_delete_account_removes_everything_and_signs_out(signed_in_client, api_base, fake_llm, fake_voice):
    signed_in_client.post(f"{api_base}/chat", json={"text": "remember this"})
    store.save_memories(TEST_USER["id"], ["Lives in Kolkata"])

    res = signed_in_client.delete(f"{api_base}/auth/account")

    assert res.status_code == 200
    assert res.json()["user"] is None
    assert TEST_USER["id"] not in store.users
    assert store.load_memories(TEST_USER["id"]) == []
    assert f"user_{TEST_USER['id']}" not in store.conversations
    assert signed_in_client.get(f"{api_base}/auth/me").json()["user"] is None


def test_guests_cannot_delete_an_account(client, api_base):
    assert client.delete(f"{api_base}/auth/account").status_code == 401
