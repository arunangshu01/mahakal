from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from typing import Protocol

from utility.logger import Logger
from utility.settings import (
    GOOGLE_CLOUD_PROJECT,
    GUEST_CONVERSATION_TTL_DAYS,
    STORAGE_BACKEND,
    USER_CONVERSATION_TTL_DAYS,
)

logger = Logger(__name__)


@dataclass
class Conversation:
    messages: list[dict] = field(default_factory=list)
    guest_messages_used: int = 0


class ConversationStore(Protocol):
    def load(self, key: str) -> Conversation: ...

    def save(self, key: str, conversation: Conversation) -> None: ...

    def save_user(self, profile: dict) -> None: ...


class MemoryStore:
    """Keeps everything in process memory. Used for local development and tests."""

    def __init__(self):
        self.conversations: dict[str, Conversation] = {}
        self.users: dict[str, dict] = {}

    def load(self, key: str) -> Conversation:
        stored = self.conversations.get(key)
        return Conversation(list(stored.messages), stored.guest_messages_used) if stored else Conversation()

    def save(self, key: str, conversation: Conversation) -> None:
        self.conversations[key] = Conversation(list(conversation.messages), conversation.guest_messages_used)

    def save_user(self, profile: dict) -> None:
        self.users[profile['id']] = dict(profile)

    def clear(self) -> None:
        self.conversations.clear()
        self.users.clear()


class FirestoreStore:
    """Firestore layout:

    conversations/{key}  messages (last HISTORY_LIMIT), guest_messages_used, updated_at, expire_at
    users/{id}           email, name, picture, last_login_at

    `expire_at` drives a Firestore TTL policy, so idle conversations are deleted automatically.
    """

    def __init__(self, project: str = GOOGLE_CLOUD_PROJECT):
        from google.cloud import firestore
        self._db = firestore.Client(project=project or None)

    def load(self, key: str) -> Conversation:
        data = self._db.collection('conversations').document(key).get().to_dict() or {}
        return Conversation(data.get('messages', []), data.get('guest_messages_used', 0))

    def save(self, key: str, conversation: Conversation) -> None:
        now = datetime.now(timezone.utc)
        ttl_days = GUEST_CONVERSATION_TTL_DAYS if key.startswith('guest_') else USER_CONVERSATION_TTL_DAYS
        self._db.collection('conversations').document(key).set({
            'messages': conversation.messages,
            'guest_messages_used': conversation.guest_messages_used,
            'updated_at': now,
            'expire_at': now + timedelta(days=ttl_days),
        })

    def save_user(self, profile: dict) -> None:
        self._db.collection('users').document(profile['id']).set(
            {**{k: v for k, v in profile.items() if k != 'id'}, 'last_login_at': datetime.now(timezone.utc)},
            merge=True,
        )


def create_store() -> ConversationStore:
    if STORAGE_BACKEND == 'firestore':
        logger.info(f"Using Firestore storage (project: {GOOGLE_CLOUD_PROJECT or 'default'}).")
        return FirestoreStore()
    logger.info("Using in-memory storage; conversations are lost on restart.")
    return MemoryStore()


store = create_store()
