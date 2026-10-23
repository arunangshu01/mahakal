from google.auth.transport import requests as google_requests
from google.oauth2 import id_token

from utility.errors import InvalidGoogleTokenError, SignInNotConfiguredError
from utility.settings import GOOGLE_CLIENT_ID

_transport = google_requests.Request()


def verify_google_credential(credential: str) -> dict:
    """Verify a Google Identity Services ID token and return the user's profile.

    Checks the signature, expiry, issuer and that the token was issued for our OAuth client.
    """
    if not GOOGLE_CLIENT_ID:
        raise SignInNotConfiguredError('GOOGLE_CLIENT_ID is not set.')
    try:
        claims = id_token.verify_oauth2_token(credential, _transport, GOOGLE_CLIENT_ID)
    except ValueError as e:
        raise InvalidGoogleTokenError(str(e)) from e
    if not claims.get('email_verified'):
        raise InvalidGoogleTokenError('Google account email is not verified.')
    return {
        'id': claims['sub'],
        'email': claims['email'],
        'name': claims.get('name') or claims['email'].split('@')[0],
        'picture': claims.get('picture', ''),
    }
