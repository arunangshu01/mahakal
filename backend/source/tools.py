import json
from dataclasses import dataclass, field
from datetime import datetime
from typing import Callable, Optional
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

import httpx

from source.storage import ConversationStore
from utility.logger import Logger
from utility.settings import (
    DEFAULT_TIMEZONE,
    MAX_MEMORIES,
    MAX_MEMORY_LENGTH,
    TOOL_HTTP_TIMEOUT_SECONDS,
    TOOL_USER_AGENT,
)

logger = Logger(__name__)

# WMO weather interpretation codes used by Open-Meteo.
WEATHER_CODES = {
    0: 'clear sky', 1: 'mainly clear', 2: 'partly cloudy', 3: 'overcast', 45: 'fog', 48: 'freezing fog',
    51: 'light drizzle', 53: 'drizzle', 55: 'heavy drizzle', 61: 'light rain', 63: 'rain', 65: 'heavy rain',
    66: 'freezing rain', 67: 'heavy freezing rain', 71: 'light snow', 73: 'snow', 75: 'heavy snow',
    77: 'snow grains', 80: 'light showers', 81: 'showers', 82: 'violent showers', 85: 'snow showers',
    86: 'heavy snow showers', 95: 'thunderstorm', 96: 'thunderstorm with hail', 99: 'severe thunderstorm with hail',
}

TOOL_LABELS = {
    'get_current_datetime': 'Checking the time',
    'get_weather': 'Checking the weather',
    'search_wikipedia': 'Searching Wikipedia',
    'remember': 'Saving to memory',
    'forget': 'Updating memory',
}


@dataclass
class ToolContext:
    """What a tool may know about the request: the user's timezone and, if signed in, their ID."""

    timezone: str = DEFAULT_TIMEZONE
    user_id: Optional[str] = None
    user_name: Optional[str] = None
    memories: list[str] = field(default_factory=list)


def _function(name: str, description: str, properties: dict, required: list[str]) -> dict:
    return {
        'type': 'function',
        'function': {
            'name': name,
            'description': description,
            'parameters': {'type': 'object', 'properties': properties, 'required': required},
        },
    }


BASE_TOOLS = [
    _function(
        'get_current_datetime',
        "Get the current date, time and day of the week. Defaults to the user's timezone.",
        {'timezone': {'type': 'string', 'description': 'IANA timezone, e.g. "Asia/Kolkata" or "Europe/London"'}},
        [],
    ),
    _function(
        'get_weather',
        'Get the current weather and the forecast for today and tomorrow for a place.',
        {'location': {'type': 'string', 'description': 'City or place name, e.g. "Ujjain" or "London, UK"'}},
        ['location'],
    ),
    _function(
        'search_wikipedia',
        'Look up a person, place, event or concept on Wikipedia and return a short summary.',
        {'query': {'type': 'string', 'description': 'What to look up'}},
        ['query'],
    ),
]

MEMORY_TOOLS = [
    _function(
        'remember',
        'Save a lasting fact or preference about the user for future conversations.',
        {'fact': {'type': 'string', 'description': 'A short fact in the third person, e.g. "Lives in Kolkata"'}},
        ['fact'],
    ),
    _function(
        'forget',
        'Remove saved facts about the user that match the given text.',
        {'fact': {'type': 'string', 'description': 'Words identifying the fact(s) to forget'}},
        ['fact'],
    ),
]


class Tools:
    """Tool definitions for the LLM and their implementations."""

    def __init__(self, conversations: ConversationStore, http: Optional[httpx.Client] = None):
        self.conversations = conversations
        self.http = http or httpx.Client(
            timeout=TOOL_HTTP_TIMEOUT_SECONDS, headers={'User-Agent': TOOL_USER_AGENT}, follow_redirects=True
        )

    @staticmethod
    def definitions(context: ToolContext) -> list[dict]:
        return BASE_TOOLS + (MEMORY_TOOLS if context.user_id else [])

    def run(self, name: str, raw_arguments: str, context: ToolContext) -> str:
        """Run a tool and return its result as a JSON string. Never raises: errors go back to the model."""
        handlers: dict[str, Callable[..., dict]] = {
            'get_current_datetime': self.get_current_datetime,
            'get_weather': self.get_weather,
            'search_wikipedia': self.search_wikipedia,
            'remember': self.remember,
            'forget': self.forget,
        }
        try:
            arguments = json.loads(raw_arguments or '{}')
            if name not in handlers:
                raise ValueError(f"Unknown tool: {name}")
            result = handlers[name](context=context, **arguments)
        except Exception as e:
            logger.warning(f"Tool {name} failed ({type(e).__name__}: {e})")
            result = {'error': f"{type(e).__name__}: {e}"}
        return json.dumps(result, ensure_ascii=False)

    def get_current_datetime(self, context: ToolContext, timezone: Optional[str] = None) -> dict:
        zone_name = timezone or context.timezone or DEFAULT_TIMEZONE
        try:
            zone = ZoneInfo(zone_name)
        except (ZoneInfoNotFoundError, ValueError):
            zone_name, zone = DEFAULT_TIMEZONE, ZoneInfo(DEFAULT_TIMEZONE)
        now = datetime.now(zone)
        return {
            'timezone': zone_name,
            'date': now.strftime('%A, %d %B %Y'),
            'time': now.strftime('%I:%M %p').lstrip('0'),
            'iso': now.isoformat(timespec='seconds'),
        }

    def get_weather(self, context: ToolContext, location: str) -> dict:
        places = self.http.get(
            'https://geocoding-api.open-meteo.com/v1/search', params={'name': location, 'count': 1}
        ).json().get('results') or []
        if not places:
            return {'error': f"Could not find a place called {location!r}."}
        place = places[0]
        forecast = self.http.get('https://api.open-meteo.com/v1/forecast', params={
            'latitude': place['latitude'],
            'longitude': place['longitude'],
            'current': 'temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m',
            'daily': 'temperature_2m_max,temperature_2m_min,precipitation_probability_max,weather_code',
            'forecast_days': 2,
            'timezone': 'auto',
        }).json()
        current, daily = forecast['current'], forecast['daily']
        return {
            'place': ', '.join(p for p in (place.get('name'), place.get('admin1'), place.get('country')) if p),
            'now': {
                'conditions': WEATHER_CODES.get(current['weather_code'], 'unknown'),
                'temperature_c': current['temperature_2m'],
                'feels_like_c': current['apparent_temperature'],
                'humidity_percent': current['relative_humidity_2m'],
                'wind_kmh': current['wind_speed_10m'],
            },
            'forecast': [
                {
                    'date': daily['time'][i],
                    'conditions': WEATHER_CODES.get(daily['weather_code'][i], 'unknown'),
                    'min_c': daily['temperature_2m_min'][i],
                    'max_c': daily['temperature_2m_max'][i],
                    'rain_chance_percent': daily['precipitation_probability_max'][i],
                }
                for i in range(len(daily['time']))
            ],
        }

    def search_wikipedia(self, context: ToolContext, query: str) -> dict:
        pages = self.http.get(
            'https://en.wikipedia.org/w/rest.php/v1/search/page', params={'q': query, 'limit': 1}
        ).json().get('pages') or []
        if not pages:
            return {'error': f"No Wikipedia article found for {query!r}."}
        summary = self.http.get(f"https://en.wikipedia.org/api/rest_v1/page/summary/{pages[0]['key']}").json()
        return {
            'title': summary.get('title', pages[0].get('title')),
            'description': summary.get('description', ''),
            'summary': summary.get('extract', ''),
            'url': summary.get('content_urls', {}).get('desktop', {}).get('page', ''),
        }

    def remember(self, context: ToolContext, fact: str) -> dict:
        if not context.user_id:
            return {'error': 'Memory is only available to signed-in users.'}
        fact = ' '.join(fact.split())[:MAX_MEMORY_LENGTH]
        memories = self.conversations.load_memories(context.user_id)
        if fact and fact.lower() not in (m.lower() for m in memories):
            memories = [*memories, fact][-MAX_MEMORIES:]
            self.conversations.save_memories(context.user_id, memories)
            context.memories = memories
        return {'saved': fact, 'total_memories': len(memories)}

    def forget(self, context: ToolContext, fact: str) -> dict:
        if not context.user_id:
            return {'error': 'Memory is only available to signed-in users.'}
        words = [w for w in fact.lower().split() if len(w) > 2] or [fact.lower()]
        memories = self.conversations.load_memories(context.user_id)
        kept = [m for m in memories if not all(w in m.lower() for w in words)]
        if len(kept) != len(memories):
            self.conversations.save_memories(context.user_id, kept)
            context.memories = kept
        return {'forgotten': len(memories) - len(kept), 'total_memories': len(kept)}
