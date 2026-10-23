import json

import httpx
import pytest

from source.storage import MemoryStore
from source.tools import ToolContext, Tools
from utility.settings import MAX_MEMORIES

GEOCODE = {"results": [{"name": "Ujjain", "admin1": "Madhya Pradesh", "country": "India", "latitude": 23.18, "longitude": 75.78}]}
FORECAST = {
    "current": {"temperature_2m": 29.5, "apparent_temperature": 32.0, "relative_humidity_2m": 60,
                "weather_code": 61, "wind_speed_10m": 9.0},
    "daily": {"time": ["2026-10-23", "2026-10-24"], "weather_code": [61, 0], "temperature_2m_min": [21, 20],
              "temperature_2m_max": [31, 32], "precipitation_probability_max": [70, 5]},
}


def fake_http(routes):
    def handler(request):
        for prefix, body in routes.items():
            if str(request.url).startswith(prefix):
                return httpx.Response(200, json=body)
        return httpx.Response(404, json={})
    return httpx.Client(transport=httpx.MockTransport(handler))


@pytest.fixture()
def tools():
    return Tools(MemoryStore(), http=fake_http({
        "https://geocoding-api.open-meteo.com": GEOCODE,
        "https://api.open-meteo.com": FORECAST,
        "https://en.wikipedia.org/w/rest.php": {"pages": [{"key": "Mahakaleshwar_Jyotirlinga", "title": "Mahakaleshwar"}]},
        "https://en.wikipedia.org/api/rest_v1/page/summary": {
            "title": "Mahakaleshwar Jyotirlinga", "description": "Hindu temple", "extract": "A temple of Shiva in Ujjain.",
            "content_urls": {"desktop": {"page": "https://en.wikipedia.org/wiki/Mahakaleshwar_Jyotirlinga"}},
        },
    }))


def run(tools, name, context=None, **arguments):
    return json.loads(tools.run(name, json.dumps(arguments), context or ToolContext()))


def test_current_datetime_uses_the_users_timezone(tools):
    assert run(tools, "get_current_datetime", ToolContext(timezone="Europe/London"))["timezone"] == "Europe/London"
    assert run(tools, "get_current_datetime", timezone="Asia/Tokyo")["timezone"] == "Asia/Tokyo"
    assert run(tools, "get_current_datetime", timezone="Not/AZone")["timezone"] == "Asia/Kolkata"


def test_weather(tools):
    result = run(tools, "get_weather", location="Ujjain")
    assert result["place"] == "Ujjain, Madhya Pradesh, India"
    assert result["now"]["conditions"] == "light rain"
    assert result["now"]["temperature_c"] == 29.5
    assert [day["max_c"] for day in result["forecast"]] == [31, 32]


def test_weather_for_an_unknown_place():
    tools = Tools(MemoryStore(), http=fake_http({"https://geocoding-api.open-meteo.com": {}}))
    assert "Could not find" in run(tools, "get_weather", location="Atlantis")["error"]


def test_wikipedia(tools):
    result = run(tools, "search_wikipedia", query="Mahakaleshwar")
    assert result["title"] == "Mahakaleshwar Jyotirlinga"
    assert result["summary"] == "A temple of Shiva in Ujjain."


def test_tool_errors_are_returned_to_the_model_not_raised(tools):
    assert "Unknown tool" in run(tools, "launch_rockets")["error"]
    assert "error" in json.loads(tools.run("get_weather", "not json", ToolContext()))


def test_memory_tools_are_offered_to_signed_in_users_only():
    names = lambda context: [t["function"]["name"] for t in Tools.definitions(context)]  # noqa: E731
    assert "remember" not in names(ToolContext())
    assert {"remember", "forget"} <= set(names(ToolContext(user_id="1")))


def test_remember_and_forget(tools):
    context = ToolContext(user_id="42")
    run(tools, "remember", context, fact="  Lives in   Kolkata ")
    run(tools, "remember", context, fact="lives in kolkata")
    run(tools, "remember", context, fact="Prefers replies in Hindi")
    assert tools.conversations.load_memories("42") == ["Lives in Kolkata", "Prefers replies in Hindi"]

    assert run(tools, "forget", context, fact="Kolkata")["forgotten"] == 1
    assert tools.conversations.load_memories("42") == ["Prefers replies in Hindi"]
    assert context.memories == ["Prefers replies in Hindi"]


def test_memories_are_capped(tools):
    context = ToolContext(user_id="42")
    for i in range(MAX_MEMORIES + 5):
        run(tools, "remember", context, fact=f"Fact number {i}")
    memories = tools.conversations.load_memories("42")
    assert len(memories) == MAX_MEMORIES
    assert memories[-1] == f"Fact number {MAX_MEMORIES + 4}"


def test_guests_cannot_use_memory(tools):
    assert "signed-in" in run(tools, "remember", fact="anything")["error"]
