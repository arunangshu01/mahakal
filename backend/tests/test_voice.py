import pytest

from source.voice import Voice


@pytest.mark.parametrize("text, expected", [
    ("I am M.A.H.A.K.A.L., your assistant.", "I am Mahakal, your assistant."),
    ("Ask M.A.H.A.K.A.L anything", "Ask Mahakal anything"),
    ("Nothing to change here.", "Nothing to change here."),
    ("It is **29\u202f°C** with `light` rain.", "It is 29 °C with light rain."),
    ("- one\n- two", "one two"),
    ("[Groq](https://groq.com) is fast.", "Groq is fast."),
    ("| A | B |\n|---|---|\n| 1 | 2 |", "A B 1 2"),
    ("# Title\nBody > quote", "Title Body quote"),
])
def test_name_is_pronounced_as_a_word(text, expected):
    assert Voice.prepare_for_speech(text) == expected
