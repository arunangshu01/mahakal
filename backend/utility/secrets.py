import os

from utility.logger import Logger

logger = Logger(__name__)

# Environment variable -> Secret Manager secret name.
SECRET_ENV_VARS = {
    'GROQ_API_KEY': 'groq-api-key',
    'GEMINI_API_KEY': 'gemini-api-key',
    'GOOGLE_CLIENT_ID': 'google-client-id',
    'SESSION_SECRET': 'session-secret',
}


class SecretLoadError(RuntimeError):
    """Raised when secrets cannot be read from Secret Manager at startup."""


def load_secrets_into_environment(project: str, client=None) -> list[str]:
    """Read the latest version of each secret from Secret Manager into `os.environ`.

    Variables that are already set are left alone, so an explicit environment variable
    (e.g. in backend/.env) always wins. Raises if any secret can't be read, so a
    misconfigured deployment fails at startup instead of serving without credentials.
    Returns the names of the variables that were loaded.
    """
    missing = {env: secret for env, secret in SECRET_ENV_VARS.items() if not os.getenv(env)}
    if not missing:
        return []
    if not project:
        raise SecretLoadError('GOOGLE_CLOUD_PROJECT must be set to read secrets from Secret Manager.')

    if client is None:
        from google.cloud import secretmanager
        client = secretmanager.SecretManagerServiceClient()

    loaded, failed = [], []
    for env, secret in missing.items():
        try:
            response = client.access_secret_version(name=f"projects/{project}/secrets/{secret}/versions/latest")
            os.environ[env] = response.payload.data.decode('utf-8').strip()
            loaded.append(env)
        except Exception as e:
            failed.append(f"{secret} ({type(e).__name__}: {e})")

    if failed:
        raise SecretLoadError(f"Could not read secrets from Secret Manager: {'; '.join(failed)}")
    logger.info(f"Loaded {', '.join(loaded)} from Secret Manager.")
    return loaded
