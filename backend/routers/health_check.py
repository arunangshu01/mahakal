from fastapi import APIRouter, status

from model.base_models_health_check import HealthCheck, ProviderStatus
from source.llm_providers import providers
from utility.logger import Logger

logger = Logger(__name__)

router = APIRouter(tags=["Health Check"])


@router.get('/health', status_code=status.HTTP_200_OK, response_model=HealthCheck)
async def health_check():
    logger.info("Health Check is OK. Status Code: 200.")
    health = HealthCheck(
        status="OK",
        code=200,
        providers=ProviderStatus(groq=providers.groq is not None, gemini=providers.gemini is not None),
    )
    return health.model_dump()
