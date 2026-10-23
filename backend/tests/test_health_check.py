from source.llm_providers import providers


def test_health_check(client, api_base):
    res = client.get(f"{api_base}/health")
    assert res.status_code == 200
    body = res.json()
    assert body["status"] == "OK"
    assert body["code"] == 200
    assert set(body["providers"]) == {"groq", "gemini"}


def test_health_check_reports_configured_providers(client, api_base, monkeypatch):
    monkeypatch.setattr(providers, "groq", object())
    monkeypatch.setattr(providers, "gemini", None)
    res = client.get(f"{api_base}/health")
    assert res.json()["providers"] == {"groq": True, "gemini": False}


def test_docs_are_served_under_the_api_prefix(client, api_base):
    assert client.get(f"{api_base}/docs").status_code == 200
    paths = client.get(f"{api_base}/openapi.json").json()["paths"]
    assert {f"{api_base}/health", f"{api_base}/chat", f"{api_base}/listen", f"{api_base}/reset"} <= set(paths)
