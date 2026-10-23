import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from routers import auth, chat, conversation, health_check, listen, memories
from utility.logger import Logger
from utility.settings import (
    API_COMMON_PREFIX,
    ASSISTANT_NAME,
    CORS_ORIGINS,
    DEBUG_MODE,
    FRONTEND_DIST,
    HOST,
    PORT,
    SESSION_SECRET_IS_EPHEMERAL,
)

logger = Logger(__name__)

tags_metadata = [
    {
        "name": "Health Check",
        "description": "For API Health Check and configured AI providers"
    },
    {
        "name": "Authentication",
        "description": "Google sign-in, guest status, sign-out and account deletion"
    },
    {
        "name": "Chat",
        "description": "Send a text message and get a spoken reply (complete or streamed)"
    },
    {
        "name": "Voice",
        "description": "Send recorded speech and get a spoken reply"
    },
    {
        "name": "Conversation",
        "description": "Read or clear the conversation history"
    },
    {
        "name": "Memory",
        "description": "Long-term facts remembered about a signed-in user"
    }
]

app = FastAPI(
    openapi_tags=tags_metadata,
    title=ASSISTANT_NAME,
    description="Modular Agentic Hub for Automation, Knowledge & Adaptive Logic",
    docs_url=f"{API_COMMON_PREFIX}/docs",
    redoc_url=f"{API_COMMON_PREFIX}/redoc",
    openapi_url=f"{API_COMMON_PREFIX}/openapi.json",
    debug=DEBUG_MODE
)

app.include_router(health_check.router, prefix=API_COMMON_PREFIX)
app.include_router(auth.router, prefix=API_COMMON_PREFIX)
app.include_router(chat.router, prefix=API_COMMON_PREFIX)
app.include_router(listen.router, prefix=API_COMMON_PREFIX)
app.include_router(conversation.router, prefix=API_COMMON_PREFIX)
app.include_router(memories.router, prefix=API_COMMON_PREFIX)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

if SESSION_SECRET_IS_EPHEMERAL:
    logger.warning("SESSION_SECRET is not set; using a temporary one. Sessions will reset on restart.")

# In production the built React app (frontend/dist) is served from the same origin.
# Mounted last so it never shadows the API routes.
if FRONTEND_DIST.is_dir():
    app.mount("/", StaticFiles(directory=FRONTEND_DIST, html=True), name="frontend")

if __name__ == '__main__':
    uvicorn.run("app.main:app",
                host=HOST,
                port=PORT,
                access_log=True)
