import pytest

from source.ears import Ears


@pytest.mark.parametrize("filename, expected", [
    ("speech.webm", "audio/webm"),
    ("speech.mp4", "audio/mp4"),
    ("speech.ogg", "audio/ogg"),
    ("speech", "audio/webm"),
])
def test_recordings_are_sent_as_audio(filename, expected):
    assert Ears.audio_mime_type(filename) == expected
