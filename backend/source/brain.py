from google import genai
from google.genai import types
from groq import Groq

from source.llm_providers import LLMProviders, providers
from source.storage import Conversation, ConversationStore, store
from utility.settings import GEMINI_MODEL, GROQ_MODEL, HISTORY_LIMIT, SYSTEM_PROMPT


class Brain:
    """Generates replies. Each conversation (user or guest) keeps its own recent history."""

    def __init__(self, llm: LLMProviders, conversations: ConversationStore):
        self.llm = llm
        self.conversations = conversations

    def think(self, conversation_key: str, user_text: str, count_as_guest_message: bool = False) -> Conversation:
        conversation = self.conversations.load(conversation_key)
        history = [*conversation.messages, {'role': 'user', 'content': user_text}]
        reply = self.reply_to(history)

        # Only saved after a successful reply, so failed requests leave no half-finished turn.
        conversation.messages = [*history, {'role': 'assistant', 'content': reply}][-HISTORY_LIMIT:]
        if count_as_guest_message:
            conversation.guest_messages_used += 1
        self.conversations.save(conversation_key, conversation)
        return conversation

    def reply_to(self, history: list[dict]) -> str:
        return self.llm.run(
            'chat',
            lambda client: self._ask_groq(client, history),
            lambda client: self._ask_gemini(client, history),
        )

    def reset(self, conversation_key: str) -> None:
        conversation = self.conversations.load(conversation_key)
        conversation.messages = []
        self.conversations.save(conversation_key, conversation)

    @staticmethod
    def _ask_groq(client: Groq, history: list[dict]) -> str:
        response = client.chat.completions.create(
            model=GROQ_MODEL,
            messages=[{'role': 'system', 'content': SYSTEM_PROMPT}, *history],
            temperature=0.6,
        )
        return response.choices[0].message.content

    @staticmethod
    def _ask_gemini(client: genai.Client, history: list[dict]) -> str:
        response = client.models.generate_content(
            model=GEMINI_MODEL,
            contents=[
                types.Content(
                    role='user' if message['role'] == 'user' else 'model',
                    parts=[types.Part(text=message['content'])],
                )
                for message in history
            ],
            config=types.GenerateContentConfig(system_instruction=SYSTEM_PROMPT, temperature=0.6),
        )
        return response.text


brain = Brain(providers, store)
