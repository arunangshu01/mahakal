from source.storage import store
from tests.conftest import TEST_USER

USER_ID = TEST_USER["id"]


def test_guests_cannot_use_memories(client, api_base):
    res = client.get(f"{api_base}/memories")
    assert res.status_code == 401
    assert res.json()["detail"]["error_type"] == "SignInRequired"


def test_list_delete_and_clear_memories(signed_in_client, api_base):
    store.save_memories(USER_ID, ["Lives in Kolkata", "Prefers Hindi", "Loves cricket"])

    assert signed_in_client.get(f"{api_base}/memories").json() == {
        "memories": ["Lives in Kolkata", "Prefers Hindi", "Loves cricket"]
    }
    assert signed_in_client.delete(f"{api_base}/memories/1").json() == {"memories": ["Lives in Kolkata", "Loves cricket"]}
    assert signed_in_client.delete(f"{api_base}/memories/9").status_code == 404
    assert signed_in_client.delete(f"{api_base}/memories").json() == {"memories": []}
    assert store.load_memories(USER_ID) == []


def test_memories_and_name_are_given_to_the_brain(signed_in_client, api_base, fake_llm, fake_voice):
    store.save_memories(USER_ID, ["Lives in Kolkata"])
    signed_in_client.post(f"{api_base}/chat", json={"text": "Where do I live?"})

    context = fake_llm[-1]
    assert context.user_id == USER_ID
    assert context.user_name == TEST_USER["name"]
    assert context.memories == ["Lives in Kolkata"]


def test_guests_get_no_memory_context(client, api_base, fake_llm, fake_voice):
    client.post(f"{api_base}/chat", json={"text": "hi"})
    assert fake_llm[-1].user_id is None
    assert fake_llm[-1].memories == []
