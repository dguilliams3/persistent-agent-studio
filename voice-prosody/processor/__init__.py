"""
Voice Prosody Processor Module

@description Package containing the three processing stages:
    1. transcribe - WhisperX speech-to-text with word timestamps
    2. prosody - Parselmouth pitch/intensity extraction
    3. annotate - Heuristic formatting into stage directions

@upstream Called by: modal_app.process()
@downstream Calls: whisperx, parselmouth, numpy
"""

from .transcribe import transcribe_audio
from .prosody import extract_prosody
from .annotate import format_annotations

__all__ = ["transcribe_audio", "extract_prosody", "format_annotations"]
