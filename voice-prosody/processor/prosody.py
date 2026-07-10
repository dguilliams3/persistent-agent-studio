"""
Parselmouth Prosody Extraction Module

@description Extracts prosodic features (pitch, intensity, pauses) from audio
    using Parselmouth (Praat in Python). Maps features to word timestamps.

@upstream Called by: modal_app.process()
@downstream Calls: parselmouth.Sound, parselmouth.praat.call

@note Parselmouth uses exact Praat algorithms - the gold standard for
    speech research prosodic analysis.
"""

import parselmouth
from parselmouth.praat import call
import numpy as np
from typing import List, Dict, Any
from pydub import AudioSegment
import tempfile
import os


def extract_prosody(audio_path: str, words: List[Dict]) -> List[Dict[str, Any]]:
    """
    @description Extract prosodic features for each word in the transcript.

    @upstream Called by: modal_app.process()
    @downstream Calls: parselmouth.Sound, _get_pitch_features, _get_intensity_features, _detect_pauses

    @param audio_path Path to audio file
    @param words List of word dicts from transcription, each with {word, start, end}
    @returns List of word dicts enriched with prosodic features:
        - word: The word text
        - start, end: Timestamps in seconds
        - pitch_mean: Mean F0 in Hz (or None if unvoiced)
        - pitch_slope: Rising (+) or falling (-) pitch direction
        - intensity_mean: Mean intensity in dB
        - intensity_relative: Relative to overall mean (soft/normal/loud)
        - pause_before: Duration of pause before this word (if > 0.3s)

    @example
        words = [{"word": "Hello", "start": 0.0, "end": 0.5}]
        result = extract_prosody("/tmp/audio.ogg", words)
        # Returns: [{
        #     "word": "Hello",
        #     "start": 0.0, "end": 0.5,
        #     "pitch_mean": 180.5,
        #     "pitch_slope": 0.15,
        #     "intensity_mean": 65.2,
        #     "intensity_relative": "normal",
        #     "pause_before": None
        # }]
    """
    # Convert OGG to WAV - Parselmouth/Praat doesn't support OGG format
    wav_path = None
    try:
        if audio_path.endswith('.ogg') or audio_path.endswith('.opus'):
            audio = AudioSegment.from_ogg(audio_path)
            wav_file = tempfile.NamedTemporaryFile(suffix='.wav', delete=False)
            wav_path = wav_file.name
            wav_file.close()
            audio.export(wav_path, format='wav')
            sound = parselmouth.Sound(wav_path)
        else:
            sound = parselmouth.Sound(audio_path)

        # Extract pitch and intensity contours
        pitch = sound.to_pitch(time_step=0.01)  # 10ms steps
        intensity = sound.to_intensity(time_step=0.01)

        # Get overall statistics for relative comparisons
        all_intensities = []
        for word in words:
            try:
                mean_int = call(intensity, "Get mean", word["start"], word["end"], "energy")
                if mean_int and not np.isnan(mean_int):
                    all_intensities.append(mean_int)
            except:
                pass

        overall_intensity_mean = np.mean(all_intensities) if all_intensities else 60.0
        overall_intensity_std = np.std(all_intensities) if len(all_intensities) > 1 else 5.0

        # Process each word
        enriched_words = []
        prev_end = 0.0

        for i, word in enumerate(words):
            enriched = {
                "word": word["word"],
                "start": word["start"],
                "end": word["end"],
            }

            # Detect pause before this word
            pause_duration = word["start"] - prev_end
            enriched["pause_before"] = round(pause_duration, 2) if pause_duration > 0.3 else None

            # Extract pitch features
            pitch_features = _get_pitch_features(pitch, word["start"], word["end"])
            enriched.update(pitch_features)

            # Extract intensity features
            intensity_features = _get_intensity_features(
                intensity, word["start"], word["end"],
                overall_intensity_mean, overall_intensity_std
            )
            enriched.update(intensity_features)

            enriched_words.append(enriched)
            prev_end = word["end"]

        return enriched_words

    finally:
        # Clean up temporary WAV file
        if wav_path and os.path.exists(wav_path):
            os.unlink(wav_path)


def _get_pitch_features(pitch, start: float, end: float) -> Dict[str, Any]:
    """
    @description Extract pitch (F0) features for a time range.

    @param pitch Parselmouth Pitch object
    @param start Start time in seconds
    @param end End time in seconds
    @returns Dict with pitch_mean and pitch_slope
    """
    try:
        # Get mean pitch
        pitch_mean = call(pitch, "Get mean", start, end, "Hertz")

        # Get pitch at start and end to determine slope
        pitch_start = call(pitch, "Get value at time", start, "Hertz", "Linear")
        pitch_end = call(pitch, "Get value at time", end, "Hertz", "Linear")

        # Calculate slope (positive = rising, negative = falling)
        if pitch_start and pitch_end and not np.isnan(pitch_start) and not np.isnan(pitch_end):
            # Normalize by duration to get rate of change
            duration = end - start
            if duration > 0:
                pitch_slope = (pitch_end - pitch_start) / (pitch_mean if pitch_mean else 1) / duration
            else:
                pitch_slope = 0
        else:
            pitch_slope = 0

        return {
            "pitch_mean": round(pitch_mean, 1) if pitch_mean and not np.isnan(pitch_mean) else None,
            "pitch_slope": round(pitch_slope, 3) if pitch_slope else 0
        }
    except Exception:
        return {"pitch_mean": None, "pitch_slope": 0}


def _get_intensity_features(
    intensity,
    start: float,
    end: float,
    overall_mean: float,
    overall_std: float
) -> Dict[str, Any]:
    """
    @description Extract intensity (volume) features for a time range.

    @param intensity Parselmouth Intensity object
    @param start Start time in seconds
    @param end End time in seconds
    @param overall_mean Overall mean intensity for comparison
    @param overall_std Overall standard deviation for thresholds
    @returns Dict with intensity_mean and intensity_relative
    """
    try:
        intensity_mean = call(intensity, "Get mean", start, end, "energy")

        if intensity_mean and not np.isnan(intensity_mean):
            # Classify relative to overall
            if intensity_mean < overall_mean - overall_std:
                relative = "soft"
            elif intensity_mean > overall_mean + overall_std:
                relative = "loud"
            else:
                relative = "normal"

            return {
                "intensity_mean": round(intensity_mean, 1),
                "intensity_relative": relative
            }
    except Exception:
        pass

    return {"intensity_mean": None, "intensity_relative": "normal"}
