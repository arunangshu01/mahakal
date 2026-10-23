from google import genai
from google.genai import types
from groq import Groq

from source.llm_providers import LLMProviders, providers
from utility.settings import GEMINI_MODEL, GROQ_MODEL, SYSTEM_PROMPT


class Brain:
    """Generates replies and keeps the conversation history in memory."""

    def __init__(self, llm: LLMProviders):
        self.llm = llm
        self.history: list[dict] = []

    def think(self, user_text: str) -> str:
        self.history.append({'role': 'user', 'content': user_text})
        try:
            reply = self.llm.run('chat', self._ask_groq, self._ask_gemini)
        except Exception:
            # Drop the unanswered message so the history stays in user/assistant pairs.
            self.history.pop()
            raise
        self.history.append({'role': 'assistant', 'content': reply})
        return reply

    def reset(self) -> None:
        self.history.clear()

    def _ask_groq(self, client: Groq) -> str:
        response = client.chat.completions.create(
            model=GROQ_MODEL,
            messages=[{'role': 'system', 'content': SYSTEM_PROMPT}, *self.history],
            temperature=0.6,
        )
        return response.choices[0].message.content

    def _ask_gemini(self, client: genai.Client) -> str:
        response = client.models.generate_content(
            model=GEMINI_MODEL,
            contents=[
                types.Content(
                    role='user' if message['role'] == 'user' else 'model',
                    parts=[types.Part(text=message['content'])],
                )
                for message in self.history
            ],
            config=types.GenerateContentConfig(system_instruction=SYSTEM_PROMPT, temperature=0.6),
        )
        return response.text


brain = Brain(providers)
