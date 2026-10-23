from typing import Callable, Optional, TypeVar

from google import genai
from groq import Groq

from utility.errors import AllProvidersFailedError, NoProviderConfiguredError
from utility.logger import Logger
from utility.settings import GEMINI_API_KEY, GROQ_API_KEY

logger = Logger(__name__)

T = TypeVar('T')


class LLMProviders:
    """Runs a task on Groq first and falls back to Gemini if Groq fails.

    Providers without an API key are skipped. Groq's built-in retries are disabled
    so a rate-limited request moves to Gemini straight away.
    """

    def __init__(self, groq_api_key: str = GROQ_API_KEY, gemini_api_key: str = GEMINI_API_KEY):
        self.groq: Optional[Groq] = Groq(api_key=groq_api_key, max_retries=0) if groq_api_key else None
        self.gemini: Optional[genai.Client] = genai.Client(api_key=gemini_api_key) if gemini_api_key else None

    def run(self, task: str, groq_call: Callable[[Groq], T], gemini_call: Callable[[genai.Client], T]) -> T:
        attempts = [
            (name, client, call)
            for name, client, call in (('Groq', self.groq, groq_call), ('Gemini', self.gemini, gemini_call))
            if client is not None
        ]
        if not attempts:
            raise NoProviderConfiguredError(
                'No LLM provider configured. Set GROQ_API_KEY and/or GEMINI_API_KEY in backend/.env.'
            )

        last_error: Optional[Exception] = None
        for name, client, call in attempts:
            try:
                return call(client)
            except Exception as e:
                logger.warning(f"{name} {task} failed ({type(e).__name__}: {e})")
                last_error = e
        raise AllProvidersFailedError(f"All providers failed for {task}.") from last_error


providers = LLMProviders()
