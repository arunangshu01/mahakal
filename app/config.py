import os
from dotenv import load_dotenv

load_dotenv()

GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
GROQ_MODEL = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")
TTS_VOICE = os.getenv("TTS_VOICE", "en-IN-PrabhatNeural")

SYSTEM_PROMPT = (
    "You are MAHAKAL, a personal AI assistant — a Modular Agentic Hub for "
    "Automation, Knowledge & Adaptive Logic. You speak concisely and helpfully, "
    "like a calm, competent aide. Keep spoken replies short (1-3 sentences) "
    "unless the user asks for detail."
)
