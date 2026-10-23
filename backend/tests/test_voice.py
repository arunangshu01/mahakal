import pytest

from source.voice import Voice


@pytest.mark.parametrize("text, expected", [
    ("I am M.A.H.A.K.A.L., your assistant.", "I am Mahakal, your assistant."),
    ("Ask M.A.H.A.K.A.L anything", "Ask Mahakal anything"),
    ("Nothing to change here.", "Nothing to change here."),
])
def test_name_is_pronounced_as_a_word(text, expected):
    assert Voice.prepare_for_speech(text) == expected
