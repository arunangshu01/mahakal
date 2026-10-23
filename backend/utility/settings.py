import os
import secrets
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

# "env": secrets come from environment variables / backend/.env (local development).
# "secret-manager": secrets are read from Google Secret Manager at startup (production).
SECRETS_SOURCE = os.getenv('SECRETS_SOURCE', 'env').lower()
if SECRETS_SOURCE == 'secret-manager':
    from utility.secrets import load_secrets_into_environment
    load_secrets_into_environment(os.getenv('GOOGLE_CLOUD_PROJECT', ''))

BASE_DIR = Path(__file__).resolve().parent.parent
FRONTEND_DIST = BASE_DIR.parent / 'frontend' / 'dist'

ASSISTANT_NAME = 'M.A.H.A.K.A.L.'
ASSISTANT_SPOKEN_NAME = 'Mahakal'
API_COMMON_PREFIX = '/mahakal/api/v1'

HOST = os.getenv('HOST', '0.0.0.0')
PORT = int(os.getenv('PORT', '8000'))
DEBUG_MODE = os.getenv('DEBUG_MODE', 'False').lower() in ('true', '1')

# Comma-separated list of frontend origins allowed to call the API.
CORS_ORIGINS = [o.strip() for o in os.getenv(
    'CORS_ORIGINS', 'http://localhost:5173').split(',') if o.strip()]

# Groq is the primary provider; Gemini takes over when Groq fails or is rate-limited.
GROQ_API_KEY = os.getenv('GROQ_API_KEY', '')
GROQ_MODEL = os.getenv('GROQ_MODEL', 'openai/gpt-oss-120b')
GROQ_STT_MODEL = os.getenv('GROQ_STT_MODEL', 'whisper-large-v3-turbo')
GEMINI_API_KEY = os.getenv('GEMINI_API_KEY', '')
GEMINI_MODEL = os.getenv('GEMINI_MODEL', 'gemini-flash-latest')

TTS_VOICE = os.getenv('TTS_VOICE', 'en-IN-PrabhatNeural')

MAX_MESSAGE_LENGTH = 2000
MAX_AUDIO_BYTES = 10 * 1024 * 1024

# Google sign-in. Only the OAuth client ID is needed to verify ID tokens.
GOOGLE_CLIENT_ID = os.getenv('GOOGLE_CLIENT_ID', '')

# Signs the session cookie. Must be set (and stable) in production; locally a random
# per-process value is used, so sessions reset when the server restarts.
SESSION_SECRET = os.getenv('SESSION_SECRET', '')
SESSION_SECRET_IS_EPHEMERAL = not SESSION_SECRET
SESSION_SECRET = SESSION_SECRET or secrets.token_hex(32)
# Firebase Hosting only forwards a cookie named "__session" to Cloud Run.
SESSION_COOKIE_NAME = '__session'
SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60
COOKIE_SECURE = os.getenv('COOKIE_SECURE', 'False').lower() in ('true', '1')

# Conversation storage: "firestore" in production, "memory" for local development and tests.
GOOGLE_CLOUD_PROJECT = os.getenv('GOOGLE_CLOUD_PROJECT', '')
STORAGE_BACKEND = os.getenv('STORAGE_BACKEND', 'memory').lower()
HISTORY_LIMIT = 20
GUEST_CONVERSATION_TTL_DAYS = 7
USER_CONVERSATION_TTL_DAYS = 90

# Guests can try a few messages before they are asked to sign in.
GUEST_MESSAGE_LIMIT = int(os.getenv('GUEST_MESSAGE_LIMIT', '5'))

# Abuse protection (per server instance).
USER_RATE_LIMIT_MAX_REQUESTS = int(os.getenv('USER_RATE_LIMIT_MAX_REQUESTS', '30'))
USER_RATE_LIMIT_WINDOW_SECONDS = int(os.getenv('USER_RATE_LIMIT_WINDOW_SECONDS', '600'))
GUEST_IP_RATE_LIMIT_MAX_REQUESTS = int(os.getenv('GUEST_IP_RATE_LIMIT_MAX_REQUESTS', '15'))
GUEST_IP_RATE_LIMIT_WINDOW_SECONDS = int(os.getenv('GUEST_IP_RATE_LIMIT_WINDOW_SECONDS', '3600'))

SYSTEM_PROMPT = (
    f"You are {ASSISTANT_NAME}, a personal AI assistant — a Modular Agentic Hub for "
    "Automation, Knowledge & Adaptive Logic. You speak concisely and helpfully, "
    "like a calm, competent aide. Keep spoken replies short (1-3 sentences) "
    "unless the user asks for detail."
)
