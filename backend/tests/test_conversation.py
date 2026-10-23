from source.storage import store
from utility.settings import GUEST_MESSAGE_LIMIT


def test_reset_clears_history_but_not_the_guest_count(client, api_base, fake_llm, fake_voice):
    client.post(f"{api_base}/chat", json={"text": "remember me"})

    res = client.post(f"{api_base}/reset")
    assert res.status_code == 200
    assert res.json() == {"message": "Conversation history cleared."}

    [conversation] = store.conversations.values()
    assert conversation.messages == []
    assert conversation.guest_messages_used == 1
    assert client.get(f"{api_base}/auth/me").json()["guest"]["remaining"] == GUEST_MESSAGE_LIMIT - 1
