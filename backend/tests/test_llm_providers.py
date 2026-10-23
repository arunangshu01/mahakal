import pytest

from source.llm_providers import LLMProviders
from utility.errors import AllProvidersFailedError, NoProviderConfiguredError


@pytest.fixture()
def llm():
    llm = LLMProviders(groq_api_key="", gemini_api_key="")
    llm.groq = "groq-client"
    llm.gemini = "gemini-client"
    return llm


def test_groq_is_used_first(llm):
    result = llm.run("chat", lambda c: f"groq via {c}", lambda c: "gemini")
    assert result == "groq via groq-client"


def test_falls_back_to_gemini_when_groq_fails(llm):
    def groq_call(client):
        raise TimeoutError("rate limited")
    assert llm.run("chat", groq_call, lambda c: f"gemini via {c}") == "gemini via gemini-client"


def test_skips_providers_without_a_key(llm):
    llm.groq = None
    assert llm.run("chat", lambda c: "groq", lambda c: "gemini") == "gemini"


def test_raises_when_no_provider_is_configured():
    llm = LLMProviders(groq_api_key="", gemini_api_key="")
    with pytest.raises(NoProviderConfiguredError):
        llm.run("chat", lambda c: "groq", lambda c: "gemini")


def test_raises_with_last_error_when_all_providers_fail(llm):
    def fail(message):
        def call(client):
            raise RuntimeError(message)
        return call

    with pytest.raises(AllProvidersFailedError) as exc_info:
        llm.run("chat", fail("groq down"), fail("gemini down"))
    assert str(exc_info.value.__cause__) == "gemini down"
