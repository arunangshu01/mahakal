import logging
from typing import Callable, TypeVar

from google import genai
from groq import Groq

from .config import GEMINI_API_KEY, GROQ_API_KEY

log = logging.getLogger("mahakal")
T = TypeVar("T")

groq_client = Groq(api_key=GROQ_API_KEY, max_retries=0) if GROQ_API_KEY else None
gemini_client = genai.Client(api_key=GEMINI_API_KEY) if GEMINI_API_KEY else None


def with_fallback(task: str, groq_fn: Callable[[], T], gemini_fn: Callable[[], T]) -> T:
    """Try Groq first, then Gemini. Providers without an API key are skipped."""
    attempts = [(n, fn) for n, c, fn in (("Groq", groq_client, groq_fn), ("Gemini", gemini_client, gemini_fn)) if c]
    if not attempts:
        raise RuntimeError("No LLM provider configured: set GROQ_API_KEY and/or GEMINI_API_KEY in .env")
    last_error: Exception | None = None
    for name, fn in attempts:
        try:
            return fn()
        except Exception as e:
            log.warning("%s %s failed: %s", name, task, e)
            last_error = e
    raise RuntimeError(f"All providers failed for {task}") from last_error
