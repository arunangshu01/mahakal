from types import SimpleNamespace

import pytest

from utility.secrets import SECRET_ENV_VARS, SecretLoadError, load_secrets_into_environment


class FakeSecretManager:
    def __init__(self, values, failing=()):
        self.values = values
        self.failing = set(failing)
        self.requested = []

    def access_secret_version(self, name):
        self.requested.append(name)
        secret = name.split('/')[3]
        if secret in self.failing:
            raise PermissionError('denied')
        return SimpleNamespace(payload=SimpleNamespace(data=f"{self.values[secret]}\n".encode()))


@pytest.fixture(autouse=True)
def clear_secret_env(monkeypatch):
    for env in SECRET_ENV_VARS:
        monkeypatch.delenv(env, raising=False)


def test_loads_every_secret_into_the_environment(monkeypatch):
    import os
    client = FakeSecretManager({secret: f"value-of-{secret}" for secret in SECRET_ENV_VARS.values()})

    loaded = load_secrets_into_environment("my-project", client)

    assert sorted(loaded) == sorted(SECRET_ENV_VARS)
    assert os.environ["GROQ_API_KEY"] == "value-of-groq-api-key"
    assert os.environ["SESSION_SECRET"] == "value-of-session-secret"
    assert "projects/my-project/secrets/gemini-api-key/versions/latest" in client.requested


def test_existing_environment_variables_win(monkeypatch):
    import os
    monkeypatch.setenv("GROQ_API_KEY", "from-dotenv")
    client = FakeSecretManager({secret: "from-secret-manager" for secret in SECRET_ENV_VARS.values()})

    load_secrets_into_environment("my-project", client)

    assert os.environ["GROQ_API_KEY"] == "from-dotenv"
    assert not any("groq-api-key" in name for name in client.requested)


def test_nothing_to_do_when_everything_is_set(monkeypatch):
    for env in SECRET_ENV_VARS:
        monkeypatch.setenv(env, "set")
    assert load_secrets_into_environment("", client=None) == []


def test_fails_loudly_when_a_secret_cannot_be_read():
    client = FakeSecretManager({secret: "x" for secret in SECRET_ENV_VARS.values()}, failing={"session-secret"})
    with pytest.raises(SecretLoadError, match="session-secret"):
        load_secrets_into_environment("my-project", client)


def test_requires_a_project():
    with pytest.raises(SecretLoadError, match="GOOGLE_CLOUD_PROJECT"):
        load_secrets_into_environment("", FakeSecretManager({}))
