from groq import Groq
from .config import GROQ_API_KEY, GROQ_MODEL, SYSTEM_PROMPT

client = Groq(api_key=GROQ_API_KEY)

# In-memory conversation; swap for Redis/SQLite later
_history: list[dict] = []


def think(user_text: str) -> str:
    _history.append({"role": "user", "content": user_text})
    resp = client.chat.completions.create(
        model=GROQ_MODEL,
        messages=[{"role": "system", "content": SYSTEM_PROMPT}, *_history],
        temperature=0.6,
    )
    reply = resp.choices[0].message.content
    _history.append({"role": "assistant", "content": reply})
    return reply


def reset() -> None:
    _history.clear()
