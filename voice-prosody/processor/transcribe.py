"""
WhisperX Transcription Module

@description Transcribes audio using WhisperX with word-level timestamps.
    Uses wav2vec2 forced alignment for accurate word boundaries.

@upstream Called by: modal_app.process()
@downstream Calls: whisperx.load_model, whisperx.load_align_model, whisperx.align

@note WhisperX provides more accurate word timestamps than vanilla Whisper
    by using phoneme-level forced alignment via wav2vec2.
"""

import whisperx
import torch


# Model cache (loaded once per container)
_model = None
_align_model = None
_align_metadata = None


def _get_device():
    """Get the appropriate device (CUDA if available, else CPU)."""
    return "cuda" if torch.cuda.is_available() else "cpu"


def _load_models():
    """
    @description Lazy-load WhisperX models on first use.
        Models are cached in module-level variables for reuse.

    @downstream Calls: whisperx.load_model, whisperx.load_align_model
    """
    global _model, _align_model, _align_metadata

    device = _get_device()
    compute_type = "float16" if device == "cuda" else "int8"

    if _model is None:
        # Load Whisper model (using medium for balance of speed/accuracy)
        # large-v3 is more accurate but slower to load
        _model = whisperx.load_model(
            "medium",
            device=device,
            compute_type=compute_type,
            language="en"
        )

    if _align_model is None:
        # Load alignment model for word timestamps
        _align_model, _align_metadata = whisperx.load_align_model(
            language_code="en",
            device=device
        )


def transcribe_audio(audio_path: str) -> dict:
    """
    @description Transcribe audio file and return text with word-level timestamps.

    @upstream Called by: modal_app.process()
    @downstream Calls: _load_models, whisperx model inference, whisperx.align

    @param audio_path Path to audio file (supports WAV, MP3, OGG, etc.)
    @returns dict with keys:
        - text: Full transcript string
        - words: List of word dicts with {word, start, end}
        - duration: Total audio duration in seconds

    @example
        result = transcribe_audio("/tmp/audio.ogg")
        # Returns: {
        #     "text": "Hello how are you",
        #     "words": [
        #         {"word": "Hello", "start": 0.0, "end": 0.5},
        #         {"word": "how", "start": 0.6, "end": 0.8},
        #         ...
        #     ],
        #     "duration": 2.5
        # }

    @note First call loads models (~5-10s). Subsequent calls are fast (~1-3s).
    """
    _load_models()

    device = _get_device()

    # Load and transcribe audio
    audio = whisperx.load_audio(audio_path)
    result = _model.transcribe(audio, batch_size=16)

    # Get duration from audio array (samples / sample_rate)
    # whisperx uses 16kHz sample rate
    duration = len(audio) / 16000

    # Align for word timestamps
    if result["segments"]:
        result = whisperx.align(
            result["segments"],
            _align_model,
            _align_metadata,
            audio,
            device,
            return_char_alignments=False
        )

    # Extract words from segments
    words = []
    for segment in result.get("segments", []):
        for word_info in segment.get("words", []):
            if "word" in word_info and "start" in word_info and "end" in word_info:
                words.append({
                    "word": word_info["word"].strip(),
                    "start": round(word_info["start"], 3),
                    "end": round(word_info["end"], 3)
                })

    # Get full text
    full_text = " ".join(w["word"] for w in words)

    return {
        "text": full_text,
        "words": words,
        "duration": round(duration, 2)
    }
