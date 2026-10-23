from source.brain import brain


def test_reset_clears_history(client, api_base, fake_llm, fake_voice):
    client.post(f"{api_base}/chat", json={"text": "remember me"})
    assert brain.history

    res = client.post(f"{api_base}/reset")
    assert res.status_code == 200
    assert res.json() == {"message": "Conversation history cleared."}
    assert brain.history == []
