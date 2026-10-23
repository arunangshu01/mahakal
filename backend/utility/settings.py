import os
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

BASE_DIR = Path(__file__).resolve().parent.parent
FRONTEND_DIST = BASE_DIR.parent / 'frontend' / 'dist'

ASSISTANT_NAME = 'M.A.H.A.K.A.L.'
ASSISTANT_SPOKEN_NAME = 'Mahakal'
API_COMMON_PREFIX = '/api/v1'

HOST = os.getenv('HOST', '0.0.0.0')
PORT = int(os.getenv('PORT', '8000'))
DEBUG_MODE = os.getenv('DEBUG_MODE', 'False').lower() in ('true', '1')

# Comma-separated list of frontend origins allowed to call the API.
CORS_ORIGINS = [o.strip() for o in os.getenv(
    'CORS_ORIGINS', 'http://localhost:5173').split(',') if o.strip()]

# Groq is the primary provider; Gemini takes over when Groq fails or is rate-limited.
GROQ_API_KEY = os.getenv('GROQ_API_KEY', '')
GROQ_MODEL = os.getenv('GROQ_MODEL', 'llama-3.3-70b-versatile')
GROQ_STT_MODEL = os.getenv('GROQ_STT_MODEL', 'whisper-large-v3-turbo')
GEMINI_API_KEY = os.getenv('GEMINI_API_KEY', '')
GEMINI_MODEL = os.getenv('GEMINI_MODEL', 'gemini-flash-latest')

TTS_VOICE = os.getenv('TTS_VOICE', 'en-IN-PrabhatNeural')

MAX_MESSAGE_LENGTH = 2000
MAX_AUDIO_BYTES = 10 * 1024 * 1024

SYSTEM_PROMPT = (
    f"You are {ASSISTANT_NAME}, a personal AI assistant — a Modular Agentic Hub for "
    "Automation, Knowledge & Adaptive Logic. You speak concisely and helpfully, "
    "like a calm, competent aide. Keep spoken replies short (1-3 sentences) "
    "unless the user asks for detail."
)
