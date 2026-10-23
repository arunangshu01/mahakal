from fastapi import HTTPException, status

from model.base_models_errors import ErrorResponseModel


class NoProviderConfiguredError(RuntimeError):
    """Raised when neither GROQ_API_KEY nor GEMINI_API_KEY is set."""


class AllProvidersFailedError(RuntimeError):
    """Raised when every configured provider failed for a request."""


def api_error(status_code: int, error_message: str, error_type: str) -> HTTPException:
    detail = ErrorResponseModel(error_message=error_message, error_type=error_type)
    return HTTPException(status_code=status_code, detail=detail.model_dump())


def assistant_error(error: Exception) -> HTTPException:
    """Translate a failure from the AI pipeline into a user-friendly HTTP error."""
    if isinstance(error, NoProviderConfiguredError):
        return api_error(
            status.HTTP_503_SERVICE_UNAVAILABLE,
            'Error: The assistant is not configured yet. Please add an API key and try again.',
            type(error).__name__,
        )
    if isinstance(error, AllProvidersFailedError):
        return api_error(
            status.HTTP_502_BAD_GATEWAY,
            'Error: The AI providers are unavailable right now. Please try again shortly.',
            type(error).__name__,
        )
    return api_error(
        status.HTTP_500_INTERNAL_SERVER_ERROR,
        'Error: Something went wrong. Please try again.',
        type(error).__name__,
    )
