from fastapi import HTTPException, status

from model.base_models_errors import ErrorResponseModel
from utility.settings import ASSISTANT_NAME


class NoProviderConfiguredError(RuntimeError):
    """Raised when neither GROQ_API_KEY nor GEMINI_API_KEY is set."""


class AllProvidersFailedError(RuntimeError):
    """Raised when every configured provider failed for a request."""


class GuestLimitReachedError(RuntimeError):
    """Raised when a guest has used all of their free messages."""


class RateLimitedError(RuntimeError):
    """Raised when a user or guest sends messages too quickly."""


class InvalidGoogleTokenError(ValueError):
    """Raised when a Google ID token is missing, expired or not issued for this app."""


class SignInNotConfiguredError(RuntimeError):
    """Raised when GOOGLE_CLIENT_ID is not set."""


def api_error(status_code: int, error_message: str, error_type: str) -> HTTPException:
    detail = ErrorResponseModel(error_message=error_message, error_type=error_type)
    return HTTPException(status_code=status_code, detail=detail.model_dump())


_ERRORS = {
    NoProviderConfiguredError: (
        status.HTTP_503_SERVICE_UNAVAILABLE,
        'Error: The assistant is not configured yet. Please add an API key and try again.',
    ),
    AllProvidersFailedError: (
        status.HTTP_502_BAD_GATEWAY,
        'Error: The AI providers are unavailable right now. Please try again shortly.',
    ),
    GuestLimitReachedError: (
        status.HTTP_401_UNAUTHORIZED,
        f'Error: You have used all your guest messages. Sign in with Google to keep talking to {ASSISTANT_NAME}',
    ),
    RateLimitedError: (
        status.HTTP_429_TOO_MANY_REQUESTS,
        'Error: You are sending messages too quickly. Please wait a moment and try again.',
    ),
    InvalidGoogleTokenError: (
        status.HTTP_401_UNAUTHORIZED,
        'Error: Google sign-in failed. Please try again.',
    ),
    SignInNotConfiguredError: (
        status.HTTP_503_SERVICE_UNAVAILABLE,
        'Error: Google sign-in is not configured yet.',
    ),
}


def assistant_error(error: Exception) -> HTTPException:
    """Translate a failure into a user-friendly HTTP error."""
    status_code, message = next(
        (value for error_class, value in _ERRORS.items() if isinstance(error, error_class)),
        (status.HTTP_500_INTERNAL_SERVER_ERROR, 'Error: Something went wrong. Please try again.'),
    )
    return api_error(status_code, message, type(error).__name__)
