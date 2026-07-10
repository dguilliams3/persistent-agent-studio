"""
Voice Prosody Modal App

@description Main Modal application for prosodic annotation of voice messages.
    Receives audio, transcribes with WhisperX, extracts prosody with Parselmouth,
    and returns annotated text with stage directions.

@upstream Called by: Cloudflare Worker (worker/src/telegram/commands/voice.js)
@downstream Calls: processor.transcribe, processor.prosody, processor.annotate

@example
    # Deploy:
    modal deploy modal_app.py

    # Test locally:
    modal serve modal_app.py

    # Call endpoint:
    curl -X POST https://your-username--voice-prosody-process.modal.run \
        -H "Content-Type: audio/ogg" \
        --data-binary @audio.ogg

@note Cold starts are 5-15 seconds due to model loading. Warm requests are ~2-5s.
"""

import modal
from fastapi import Request
import io
import tempfile
import os

# Define the Modal app
app = modal.App("voice-prosody")

# Define the container image with all dependencies
image = (
    modal.Image.debian_slim(python_version="3.11")
    .apt_install("ffmpeg", "git", "pkg-config", "libavformat-dev", "libavcodec-dev", "libavdevice-dev", "libavutil-dev", "libswscale-dev", "libswresample-dev")
    .pip_install(
        "torch==2.0.1",
        "torchaudio==2.0.2",  # Must match torch version for pyannote compatibility
        "whisperx",
        "praat-parselmouth",  # NOT "parselmouth" - that's a different package!
        "numpy<2",  # WhisperX needs numpy 1.x
        "pydub",
        "fastapi",  # Required for web endpoints
    )
    .add_local_dir("processor", remote_path="/root/processor")  # Copy processor module into image
)


@app.function(
    image=image,
    gpu="T4",  # Use T4 GPU for WhisperX inference
    timeout=300,  # 5 minute timeout (first run downloads models)
    memory=4096,  # 4GB RAM
)
@modal.fastapi_endpoint(method="POST")
async def process(request: Request) -> dict:
    """
    @description Process audio bytes and return prosodically-annotated transcript.

    @upstream Called by: HTTP POST from Cloudflare Worker
    @downstream Calls: transcribe_audio, extract_prosody, format_annotations

    @param request FastAPI Request object containing raw audio bytes in body
    @returns dict with keys: annotated_text, raw_text, word_count, duration_seconds

    @example
        curl -X POST https://endpoint.modal.run -H "Content-Type: audio/ogg" --data-binary @audio.ogg
        # Returns: {"annotated_text": "[softly] Hello...", "raw_text": "Hello", ...}
    """
    # Add /root to path so processor module can be found
    import sys
    if '/root' not in sys.path:
        sys.path.insert(0, '/root')

    from processor.transcribe import transcribe_audio
    from processor.prosody import extract_prosody
    from processor.annotate import format_annotations

    # Read raw audio bytes from request body
    audio_bytes = await request.body()

    if not audio_bytes:
        return {"error": "No audio data received", "annotated_text": "", "raw_text": ""}

    # Save audio to temp file (WhisperX needs file path)
    with tempfile.NamedTemporaryFile(suffix=".ogg", delete=False) as f:
        f.write(audio_bytes)
        audio_path = f.name

    try:
        # Step 1: Transcribe with word timestamps
        transcript = transcribe_audio(audio_path)

        if not transcript["words"]:
            return {
                "annotated_text": "",
                "raw_text": "",
                "word_count": 0,
                "duration_seconds": 0,
                "error": "No speech detected"
            }

        # Step 2: Extract prosodic features for each word
        prosody_data = extract_prosody(audio_path, transcript["words"])

        # Step 3: Format with stage direction annotations
        annotated_text = format_annotations(prosody_data)

        return {
            "annotated_text": annotated_text,
            "raw_text": transcript["text"],
            "word_count": len(transcript["words"]),
            "duration_seconds": transcript["duration"]
        }

    finally:
        # Clean up temp file
        if os.path.exists(audio_path):
            os.unlink(audio_path)


@app.function(image=image)
@modal.fastapi_endpoint(method="GET")
def health() -> dict:
    """
    @description Health check endpoint for monitoring.

    @returns dict with status and version info
    """
    return {
        "status": "ok",
        "version": "1.0.0",
        "capabilities": ["transcription", "prosody", "annotation"]
    }


# For local testing
if __name__ == "__main__":
    # Test with a sample audio file
    import sys
    if len(sys.argv) > 1:
        with open(sys.argv[1], "rb") as f:
            result = process.local(f.read())
            print(result)
    else:
        print("Usage: python modal_app.py <audio_file>")
