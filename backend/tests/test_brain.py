import json
from types import SimpleNamespace

import pytest

from source.brain import EMPTY_REPLY, Brain, StreamEvent
from source.llm_providers import LLMProviders
from source.storage import MemoryStore
from source.tools import ToolContext
from utility.errors import AllProvidersFailedError, NoProviderConfiguredError
from utility.settings import MAX_TOOL_ROUNDS


def chunk(content=None, tool_calls=None):
    return SimpleNamespace(choices=[SimpleNamespace(delta=SimpleNamespace(content=content, tool_calls=tool_calls))])


def tool_call_chunk(index, call_id=None, name=None, arguments=None):
    function = SimpleNamespace(name=name, arguments=arguments)
    return chunk(tool_calls=[SimpleNamespace(index=index, id=call_id, function=function)])


class FakeGroq:
    """Plays back one scripted streamed response per call to chat.completions.create."""

    def __init__(self, *responses):
        self.responses = list(responses)
        self.requests = []
        self.chat = SimpleNamespace(completions=SimpleNamespace(create=self._create))

    def _create(self, **kwargs):
        self.requests.append(kwargs)
        response = self.responses.pop(0)
        if isinstance(response, Exception):
            raise response
        return iter(response)


class FakeTools:
    def __init__(self):
        self.calls = []

    @staticmethod
    def definitions(context):
        return [{"type": "function", "function": {"name": "get_weather"}}]

    def run(self, name, arguments, context):
        self.calls.append((name, json.loads(arguments)))
        return json.dumps({"temperature_c": 29})


def make_brain(groq=None, gemini=None):
    llm = LLMProviders(groq_api_key="", gemini_api_key="")
    llm.groq, llm.gemini = groq, gemini
    return Brain(llm, MemoryStore(), FakeTools())


def collect(brain, history=None, context=None):
    return list(brain.generate(history or [{"role": "user", "content": "hi"}], context or ToolContext()))


def test_streams_text_deltas():
    brain = make_brain(groq=FakeGroq([chunk("Hello"), chunk(" there")]))
    assert collect(brain) == [StreamEvent("delta", "Hello"), StreamEvent("delta", " there")]


def test_runs_tools_and_streams_the_final_answer():
    groq = FakeGroq(
        [tool_call_chunk(0, "call-1", "get_weather", '{"loca'), tool_call_chunk(0, arguments='tion": "Ujjain"}')],
        [chunk("It is 29 degrees.")],
    )
    brain = make_brain(groq=groq)

    events = collect(brain)

    assert events == [StreamEvent("tool", name="get_weather"), StreamEvent("delta", "It is 29 degrees.")]
    assert brain.tools.calls == [("get_weather", {"location": "Ujjain"})]
    second_request = groq.requests[1]["messages"]
    assert second_request[-2]["tool_calls"][0]["function"]["name"] == "get_weather"
    assert second_request[-1] == {"role": "tool", "tool_call_id": "call-1", "content": '{"temperature_c": 29}'}


def test_stops_offering_tools_after_the_round_limit():
    loop = [tool_call_chunk(0, "c", "get_weather", "{}")]
    groq = FakeGroq(*([loop] * MAX_TOOL_ROUNDS), [chunk("Done.")])
    events = collect(make_brain(groq=groq))
    assert events[-1] == StreamEvent("delta", "Done.")
    assert "tools" not in groq.requests[-1]


def test_falls_back_to_gemini_when_groq_fails_before_replying(monkeypatch):
    brain = make_brain(groq=FakeGroq(RuntimeError("rate limited")), gemini=object())
    monkeypatch.setattr(brain, "_ask_gemini", lambda client, history, context: "From Gemini.")
    assert collect(brain) == [StreamEvent("delta", "From Gemini.")]


def test_does_not_switch_provider_part_way_through_a_reply():
    def broken_stream():
        yield chunk("Half a")
        raise ConnectionError("dropped")
    brain = make_brain(groq=FakeGroq(broken_stream()), gemini=object())
    with pytest.raises(AllProvidersFailedError):
        collect(brain)


def test_raises_when_all_providers_fail(monkeypatch):
    brain = make_brain(groq=FakeGroq(RuntimeError("down")), gemini=object())

    def gemini_down(client, history, context):
        raise RuntimeError("also down")
    monkeypatch.setattr(brain, "_ask_gemini", gemini_down)
    with pytest.raises(AllProvidersFailedError):
        collect(brain)


def test_raises_when_no_provider_is_configured():
    with pytest.raises(NoProviderConfiguredError):
        collect(make_brain())


def test_saves_the_turn_and_uses_a_fallback_for_empty_replies():
    brain = make_brain(groq=FakeGroq([chunk("")]))
    conversation = brain.think("guest_x", "hello", count_as_guest_message=True)
    assert conversation.messages == [
        {"role": "user", "content": "hello"},
        {"role": "assistant", "content": EMPTY_REPLY},
    ]
    assert conversation.guest_messages_used == 1


def test_system_prompt_includes_memories_only_for_signed_in_users():
    guest_prompt = Brain.system_prompt(ToolContext(timezone="Europe/London", memories=["Likes tea"]))
    assert "Europe/London" in guest_prompt
    assert "Likes tea" not in guest_prompt

    user_prompt = Brain.system_prompt(ToolContext(user_id="1", user_name="Shiva", memories=["Lives in Ujjain"]))
    assert "The user's name is Shiva." in user_prompt
    assert "- Lives in Ujjain" in user_prompt
    assert "remember tool" in user_prompt
