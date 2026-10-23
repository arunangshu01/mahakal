from datetime import datetime, timezone
from unittest.mock import MagicMock

from source.storage import Conversation, FirestoreStore, MemoryStore


def test_memory_store_returns_copies():
    store = MemoryStore()
    conversation = Conversation(messages=[{"role": "user", "content": "hi"}])
    store.save("guest_1", conversation)
    conversation.messages.append({"role": "assistant", "content": "changed later"})

    assert len(store.load("guest_1").messages) == 1
    assert store.load("unknown") == Conversation()


def _firestore_store():
    firestore_store = FirestoreStore.__new__(FirestoreStore)
    firestore_store._db = MagicMock()
    return firestore_store, firestore_store._db.collection.return_value.document.return_value


def test_firestore_store_saves_with_expiry():
    firestore_store, document = _firestore_store()
    firestore_store.save("guest_abc", Conversation(messages=[{"role": "user", "content": "hi"}], guest_messages_used=2))

    saved = document.set.call_args.args[0]
    assert saved["messages"] == [{"role": "user", "content": "hi"}]
    assert saved["guest_messages_used"] == 2
    assert 6 <= (saved["expire_at"] - datetime.now(timezone.utc)).days <= 7


def test_firestore_store_loads_missing_documents_as_empty():
    firestore_store, document = _firestore_store()
    document.get.return_value.to_dict.return_value = None
    assert firestore_store.load("user_1") == Conversation()


def test_firestore_store_saves_user_profile_without_id_field():
    firestore_store, document = _firestore_store()
    firestore_store.save_user({"id": "42", "email": "a@b.c", "name": "A", "picture": ""})
    data, = document.set.call_args.args
    assert "id" not in data and data["email"] == "a@b.c" and "last_login_at" in data
    assert document.set.call_args.kwargs == {"merge": True}
