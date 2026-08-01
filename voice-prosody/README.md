# Voice Prosody - Prosodic Annotation Service

A Modal-based service that transcribes voice messages and annotates them with prosodic information (tone, volume, pauses) using stage direction format.

## What It Does

**Input:** Raw audio (OGG/Opus from Telegram, WAV, MP3)

**Output:** Annotated transcript like:
```
[softly, trailing off] I don't know if... [pause, 2.1s] ...that makes sense [rising, questioning]
```

## Architecture

```
Audio → WhisperX (transcription + word timestamps)
     → Parselmouth (pitch, intensity per word)
     → Heuristics (stage direction formatting)
     → Annotated text
```

## Deployment

### Prerequisites

1. Modal account (free at https://modal.com)
2. Modal CLI installed and authenticated:
   ```bash
   pip install modal
   modal token new
   ```

### Deploy

```bash
cd voice-prosody
modal deploy modal_app.py
```

This will output your endpoint URL:
```
https://your-username--voice-prosody-process.modal.run
```

### Test

```bash
# Health check
curl https://your-username--voice-prosody-health.modal.run

# Process audio
curl -X POST https://your-username--voice-prosody-process.modal.run \
    -H "Content-Type: audio/ogg" \
    --data-binary @audio.ogg
```

## Local Development

```bash
# Serve locally (hot reload)
modal serve modal_app.py

# Test with a file
python modal_app.py test_audio.ogg
```

## Cost

- **Free tier:** $30/month of compute credits
- **Per-minute:** ~$0.02/min of audio (T4 GPU)
- **Typical usage:** 500 voice notes/month = ~$5

## Integration with Cloudflare Worker

The Cloudflare worker calls this endpoint when `/voice prosody on` is enabled:

```javascript
const response = await fetch(env.VOICE_PROCESSOR_URL, {
    method: 'POST',
    body: audioBytes,
    headers: { 'Content-Type': 'audio/ogg' }
});
const { annotated_text } = await response.json();
```

## Files

| File | Purpose |
|------|---------|
| `modal_app.py` | Main Modal app with HTTP endpoints |
| `processor/transcribe.py` | WhisperX wrapper for word timestamps |
| `processor/prosody.py` | Parselmouth feature extraction |
| `processor/annotate.py` | Heuristic annotation formatting |

## Annotation Vocabulary

| Feature | Annotations |
|---------|-------------|
| Volume | softly, emphatically |
| Pitch | rising, falling |
| Pattern | questioning, declarative |
| Timing | trailing off, [pause, Xs] |
