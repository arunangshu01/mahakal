from google.genai import types

from .config import GEMINI_MODEL, GROQ_MODEL, SYSTEM_PROMPT
from .providers import gemini_client, groq_client, with_fallback

# In-memory conversation; swap for Redis/SQLite later
_history: list[dict] = []


def _ask_groq() -> str:
    resp = groq_client.chat.completions.create(
        model=GROQ_MODEL,
        messages=[{"role": "system", "content": SYSTEM_PROMPT}, *_history],
        temperature=0.6,
    )
    return resp.choices[0].message.content


def _ask_gemini() -> str:
    resp = gemini_client.models.generate_content(
        model=GEMINI_MODEL,
        contents=[
            types.Content(role="user" if m["role"] == "user" else "model", parts=[types.Part(text=m["content"])])
            for m in _history
        ],
        config=types.GenerateContentConfig(system_instruction=SYSTEM_PROMPT, temperature=0.6),
    )
    return resp.text


def think(user_text: str) -> str:
    _history.append({"role": "user", "content": user_text})
    try:
        reply = with_fallback("chat", _ask_groq, _ask_gemini)
    except Exception:
        _history.pop()
        raise
    _history.append({"role": "assistant", "content": reply})
    return reply


def reset() -> None:
    _history.clear()
