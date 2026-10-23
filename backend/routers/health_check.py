from fastapi import APIRouter, status

from model.base_models_health_check import HealthCheck, ProviderStatus
from source.llm_providers import providers
from utility.logger import Logger
from utility.settings import GOOGLE_CLIENT_ID, STORAGE_BACKEND

logger = Logger(__name__)

router = APIRouter(tags=["Health Check"])


@router.get('/health', status_code=status.HTTP_200_OK, response_model=HealthCheck)
async def health_check():
    logger.info("Health Check is OK. Status Code: 200.")
    health = HealthCheck(
        status="OK",
        code=200,
        providers=ProviderStatus(groq=providers.groq is not None, gemini=providers.gemini is not None),
        google_sign_in=bool(GOOGLE_CLIENT_ID),
        storage=STORAGE_BACKEND,
    )
    return health.model_dump()
