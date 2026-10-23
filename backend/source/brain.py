from dataclasses import dataclass
from typing import Iterator, Optional, Union

from google import genai
from google.genai import types
from groq import Groq

from source.llm_providers import LLMProviders, providers
from source.storage import Conversation, ConversationStore, store
from source.tools import ToolContext, Tools
from utility.errors import AllProvidersFailedError, NoProviderConfiguredError
from utility.logger import Logger
from utility.settings import (
    GEMINI_MODEL,
    GROQ_MODEL,
    HISTORY_LIMIT,
    MAX_TOOL_ROUNDS,
    MEMORY_PROMPT,
    SYSTEM_PROMPT,
)

logger = Logger(__name__)

EMPTY_REPLY = "I'm not sure how to answer that. Could you rephrase?"


@dataclass
class StreamEvent:
    """A piece of a reply as it is generated: a text `delta`, or a `tool` being used."""

    type: str
    text: str = ''
    name: str = ''


class Brain:
    """Generates replies (with tools), keeps each conversation's recent history."""

    def __init__(self, llm: LLMProviders, conversations: ConversationStore, tools: Tools):
        self.llm = llm
        self.conversations = conversations
        self.tools = tools

    def think(
        self,
        conversation_key: str,
        user_text: str,
        count_as_guest_message: bool = False,
        context: Optional[ToolContext] = None,
    ) -> Conversation:
        """Generate a full reply and save the turn. Returns the updated conversation."""
        events = self.stream(conversation_key, user_text, count_as_guest_message, context)
        return next(event for event in events if isinstance(event, Conversation))

    def stream(
        self,
        conversation_key: str,
        user_text: str,
        count_as_guest_message: bool = False,
        context: Optional[ToolContext] = None,
    ) -> Iterator[Union[StreamEvent, Conversation]]:
        """Yield StreamEvents as the reply is generated, then the saved Conversation."""
        conversation = self.conversations.load(conversation_key)
        history = [*conversation.messages, {'role': 'user', 'content': user_text}]
        parts = []
        for event in self.generate(history, context or ToolContext()):
            if event.type == 'delta':
                parts.append(event.text)
            yield event

        # Only saved after a successful reply, so failed requests leave no half-finished turn.
        reply = ''.join(parts).strip() or EMPTY_REPLY
        conversation.messages = [*history, {'role': 'assistant', 'content': reply}][-HISTORY_LIMIT:]
        if count_as_guest_message:
            conversation.guest_messages_used += 1
        self.conversations.save(conversation_key, conversation)
        yield conversation

    def generate(self, history: list[dict], context: ToolContext) -> Iterator[StreamEvent]:
        """Groq (streaming, with tools) first; Gemini (plain answer) if Groq fails before replying."""
        groq, gemini = self.llm.groq, self.llm.gemini
        if groq is None and gemini is None:
            raise NoProviderConfiguredError(
                'No LLM provider configured. Set GROQ_API_KEY and/or GEMINI_API_KEY in backend/.env.'
            )

        last_error: Optional[Exception] = None
        if groq is not None:
            replying = False
            try:
                for event in self._groq_events(groq, history, context):
                    replying = replying or event.type == 'delta'
                    yield event
                return
            except Exception as e:
                if replying:
                    raise AllProvidersFailedError('Groq failed part-way through a reply.') from e
                logger.warning(f"Groq chat failed ({type(e).__name__}: {e})")
                last_error = e

        if gemini is not None:
            try:
                yield StreamEvent('delta', text=self._ask_gemini(gemini, history, context))
                return
            except Exception as e:
                logger.warning(f"Gemini chat failed ({type(e).__name__}: {e})")
                last_error = e
        raise AllProvidersFailedError('All providers failed for chat.') from last_error

    def reset(self, conversation_key: str) -> None:
        conversation = self.conversations.load(conversation_key)
        conversation.messages = []
        self.conversations.save(conversation_key, conversation)

    @staticmethod
    def system_prompt(context: ToolContext) -> str:
        lines = [SYSTEM_PROMPT, f"The user's timezone is {context.timezone}."]
        if context.user_id:
            if context.user_name:
                lines.append(f"The user's name is {context.user_name}.")
            lines.append(MEMORY_PROMPT)
            if context.memories:
                lines.append('What you remember about the user:\n' + '\n'.join(f"- {m}" for m in context.memories))
        return '\n\n'.join(lines)

    def _groq_events(self, client: Groq, history: list[dict], context: ToolContext) -> Iterator[StreamEvent]:
        messages = [{'role': 'system', 'content': self.system_prompt(context)}, *history]
        for round_number in range(MAX_TOOL_ROUNDS + 1):
            # After MAX_TOOL_ROUNDS the model must answer with what it has.
            tool_options = {'tools': self.tools.definitions(context)} if round_number < MAX_TOOL_ROUNDS else {}
            calls: dict[int, dict] = {}
            content = ''
            for chunk in client.chat.completions.create(
                model=GROQ_MODEL, messages=messages, temperature=0.6, stream=True, **tool_options
            ):
                if not chunk.choices:
                    continue
                delta = chunk.choices[0].delta
                if delta.content:
                    content += delta.content
                    yield StreamEvent('delta', text=delta.content)
                for call in delta.tool_calls or []:
                    entry = calls.setdefault(call.index, {'id': '', 'name': '', 'arguments': ''})
                    entry['id'] = call.id or entry['id']
                    if call.function:
                        entry['name'] += call.function.name or ''
                        entry['arguments'] += call.function.arguments or ''

            if not calls:
                return
            messages.append({
                'role': 'assistant',
                'content': content or None,
                'tool_calls': [
                    {'id': c['id'], 'type': 'function', 'function': {'name': c['name'], 'arguments': c['arguments']}}
                    for c in calls.values()
                ],
            })
            for call in calls.values():
                yield StreamEvent('tool', name=call['name'])
                result = self.tools.run(call['name'], call['arguments'], context)
                messages.append({'role': 'tool', 'tool_call_id': call['id'], 'content': result})

    def _ask_gemini(self, client: genai.Client, history: list[dict], context: ToolContext) -> str:
        response = client.models.generate_content(
            model=GEMINI_MODEL,
            contents=[
                types.Content(
                    role='user' if message['role'] == 'user' else 'model',
                    parts=[types.Part(text=message['content'])],
                )
                for message in history
            ],
            config=types.GenerateContentConfig(system_instruction=self.system_prompt(context), temperature=0.6),
        )
        return response.text or ''


brain = Brain(providers, store, Tools(store))
