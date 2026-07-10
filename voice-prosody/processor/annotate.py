"""
Annotation Formatting Module

@description Converts prosodic features into human-readable stage direction
    annotations. Uses a rich, configurable vocabulary for theatrical/expressive
    annotations that give Clio context about HOW something was said.

@upstream Called by: modal_app.process()
@downstream Calls: (pure Python, no external dependencies)

@note The annotation vocabulary is designed to be theatrical/expressive.
    Rules are data-driven and can be extended by adding to ANNOTATION_RULES.
"""

from typing import List, Dict, Any, Optional
import json
import os


# =============================================================================
# CONFIGURABLE ANNOTATION RULES
# =============================================================================
# Each rule defines conditions and the resulting annotation.
# Rules are evaluated in order; first match wins for each category.
#
# Format:
#   {
#     "name": "rule_name",           # For identification/removal
#     "category": "volume|pitch|...", # What aspect it annotates
#     "conditions": {...},            # Feature thresholds to match
#     "annotation": "text",           # The stage direction text
#     "priority": 1-10                # Higher = checked first
#   }
# =============================================================================

ANNOTATION_RULES = [
    # =========================================================================
    # VOLUME/INTENSITY RULES
    # =========================================================================
    {
        "name": "whisper",
        "category": "volume",
        "conditions": {"intensity_relative": "soft", "intensity_db_below_mean": 10},
        "annotation": "whispering",
        "priority": 10
    },
    {
        "name": "very_soft",
        "category": "volume",
        "conditions": {"intensity_relative": "soft"},
        "annotation": "softly",
        "priority": 5
    },
    {
        "name": "very_loud",
        "category": "volume",
        "conditions": {"intensity_relative": "loud", "intensity_db_above_mean": 8},
        "annotation": "loudly",
        "priority": 10
    },
    {
        "name": "emphatic",
        "category": "volume",
        "conditions": {"intensity_relative": "loud"},
        "annotation": "emphatically",
        "priority": 5
    },

    # =========================================================================
    # PITCH CONTOUR RULES (sentence-level patterns)
    # =========================================================================
    {
        "name": "rising_question",
        "category": "pitch_final",
        "conditions": {"pitch_slope": ">0.5"},
        "annotation": "rising, questioning",
        "priority": 5
    },
    {
        "name": "falling_declarative",
        "category": "pitch_final",
        "conditions": {"pitch_slope": "<-0.3"},
        "annotation": "falling, declarative",
        "priority": 5
    },
    {
        "name": "high_pitch_excited",
        "category": "pitch_register",
        "conditions": {"pitch_relative": "high", "intensity_relative": "loud"},
        "annotation": "excitedly",
        "priority": 8
    },
    {
        "name": "low_pitch_subdued",
        "category": "pitch_register",
        "conditions": {"pitch_relative": "low", "intensity_relative": "soft"},
        "annotation": "subdued",
        "priority": 8
    },

    # =========================================================================
    # RHYTHM/TEMPO RULES
    # =========================================================================
    {
        "name": "trailing_off",
        "category": "rhythm",
        "conditions": {"intensity_trend": "decreasing", "min_words": 3},
        "annotation": "trailing off",
        "priority": 7
    },
    {
        "name": "building_up",
        "category": "rhythm",
        "conditions": {"intensity_trend": "increasing", "min_words": 3},
        "annotation": "building",
        "priority": 7
    },
    {
        "name": "rushed",
        "category": "tempo",
        "conditions": {"speaking_rate": ">5.0"},  # words per second
        "annotation": "quickly",
        "priority": 6
    },
    {
        "name": "deliberate",
        "category": "tempo",
        "conditions": {"speaking_rate": "<2.0"},
        "annotation": "slowly, deliberately",
        "priority": 6
    },

    # =========================================================================
    # PAUSE RULES
    # =========================================================================
    {
        "name": "dramatic_pause",
        "category": "pause",
        "conditions": {"pause_duration": ">3.0"},
        "annotation": "long, dramatic pause",
        "priority": 10
    },
    {
        "name": "thoughtful_pause",
        "category": "pause",
        "conditions": {"pause_duration": ">1.5"},
        "annotation": "thoughtful pause",
        "priority": 8
    },
    {
        "name": "brief_pause",
        "category": "pause",
        "conditions": {"pause_duration": ">0.5"},
        "annotation": "pause",
        "priority": 5
    },

    # =========================================================================
    # COMPOUND EMOTIONAL STATES
    # =========================================================================
    {
        "name": "hesitant",
        "category": "emotional",
        "conditions": {"pause_frequency_category": "high", "intensity_relative": "soft"},
        "annotation": "hesitantly",
        "priority": 9
    },
    {
        "name": "urgent",
        "category": "emotional",
        "conditions": {"speaking_rate": ">4.0", "intensity_relative": "loud", "pause_frequency_category": "low"},
        "annotation": "urgently",
        "priority": 9
    },
    {
        "name": "thoughtful",
        "category": "emotional",
        "conditions": {"speaking_rate": "<2.5", "pause_frequency_category": "medium"},
        "annotation": "thoughtfully",
        "priority": 7
    },
    {
        "name": "weary",
        "category": "emotional",
        "conditions": {"intensity_trend": "decreasing", "pitch_relative": "low"},
        "annotation": "wearily",
        "priority": 8
    },
    {
        "name": "warm",
        "category": "emotional",
        "conditions": {"intensity_relative": "normal", "pitch_variation": "moderate"},
        "annotation": "warmly",
        "priority": 6
    },
    {
        "name": "matter_of_fact",
        "category": "emotional",
        "conditions": {"pitch_variation": "low", "intensity_relative": "normal"},
        "annotation": "matter-of-factly",
        "priority": 5
    },

    # =========================================================================
    # LAUGHTER/VOCAL EFFECTS (detected via pitch/intensity irregularities)
    # =========================================================================
    {
        "name": "laugh_loud",
        "category": "vocal_effect",
        "conditions": {"pitch_irregular": True, "intensity_relative": "loud", "duration_short": True},
        "annotation": "laughing",
        "priority": 10
    },
    {
        "name": "laugh_medium",
        "category": "vocal_effect",
        "conditions": {"pitch_irregular": True, "intensity_relative": "normal", "duration_short": True},
        "annotation": "chuckling",
        "priority": 10
    },
    {
        "name": "laugh_soft",
        "category": "vocal_effect",
        "conditions": {"pitch_irregular": True, "intensity_relative": "soft", "duration_short": True},
        "annotation": "giggling softly",
        "priority": 10
    },
    {
        "name": "sigh",
        "category": "vocal_effect",
        "conditions": {"pitch_falling_rapid": True, "intensity_trend": "decreasing"},
        "annotation": "sighing",
        "priority": 9
    },
    {
        "name": "breath",
        "category": "vocal_effect",
        "conditions": {"unvoiced_segment": True, "duration": ">0.3"},
        "annotation": "takes breath",
        "priority": 8
    },
]

# Sort rules by priority (highest first) for evaluation
ANNOTATION_RULES.sort(key=lambda r: r.get("priority", 5), reverse=True)


# =============================================================================
# THRESHOLD CONFIGURATION
# =============================================================================

THRESHOLDS = {
    # Pitch
    "pitch_slope_rising": 0.5,
    "pitch_slope_falling": -0.3,
    "pitch_high_hz_above_mean": 30,  # Hz above speaker's mean
    "pitch_low_hz_below_mean": 20,   # Hz below speaker's mean
    "pitch_variation_high": 40,      # Hz std dev
    "pitch_variation_low": 15,

    # Intensity
    "intensity_db_loud": 8,          # dB above mean
    "intensity_db_soft": 6,          # dB below mean
    "intensity_whisper": 10,         # dB below mean

    # Pauses
    "pause_brief": 0.5,
    "pause_thoughtful": 1.5,
    "pause_dramatic": 3.0,

    # Tempo
    "speaking_rate_fast": 5.0,       # words per second
    "speaking_rate_slow": 2.0,

    # Pattern detection
    "trend_min_words": 3,            # Minimum words to detect trend
    "pause_frequency_high": 0.4,     # Pauses per word
    "pause_frequency_low": 0.1,
}


# =============================================================================
# RULE MANAGEMENT FUNCTIONS
# =============================================================================

def add_rule(rule: Dict) -> None:
    """Add a new annotation rule. Re-sorts by priority."""
    global ANNOTATION_RULES
    ANNOTATION_RULES.append(rule)
    ANNOTATION_RULES.sort(key=lambda r: r.get("priority", 5), reverse=True)


def remove_rule(name: str) -> bool:
    """Remove a rule by name. Returns True if found and removed."""
    global ANNOTATION_RULES
    original_len = len(ANNOTATION_RULES)
    ANNOTATION_RULES = [r for r in ANNOTATION_RULES if r.get("name") != name]
    return len(ANNOTATION_RULES) < original_len


def list_rules() -> List[Dict]:
    """Return all current rules."""
    return ANNOTATION_RULES.copy()


def load_rules_from_file(path: str) -> None:
    """Load rules from a JSON file, replacing current rules."""
    global ANNOTATION_RULES
    with open(path, 'r') as f:
        ANNOTATION_RULES = json.load(f)
    ANNOTATION_RULES.sort(key=lambda r: r.get("priority", 5), reverse=True)


def save_rules_to_file(path: str) -> None:
    """Save current rules to a JSON file."""
    with open(path, 'w') as f:
        json.dump(ANNOTATION_RULES, f, indent=2)


# =============================================================================
# FEATURE COMPUTATION
# =============================================================================

def compute_utterance_features(prosody_data: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Compute utterance-level features from word-level prosody data.

    @param prosody_data List of word dicts with prosodic features
    @returns Dict of computed features for rule matching
    """
    if not prosody_data:
        return {}

    features = {}

    # Duration
    if prosody_data:
        total_duration = prosody_data[-1].get("end", 0) - prosody_data[0].get("start", 0)
        features["duration"] = total_duration
        features["word_count"] = len(prosody_data)
        features["speaking_rate"] = len(prosody_data) / total_duration if total_duration > 0 else 0

    # Pitch statistics
    pitches = [w.get("pitch_mean") for w in prosody_data if w.get("pitch_mean")]
    if pitches:
        import statistics
        features["pitch_mean"] = statistics.mean(pitches)
        features["pitch_std"] = statistics.stdev(pitches) if len(pitches) > 1 else 0
        features["pitch_variation"] = "high" if features["pitch_std"] > THRESHOLDS["pitch_variation_high"] else \
                                      "low" if features["pitch_std"] < THRESHOLDS["pitch_variation_low"] else "moderate"

    # Intensity statistics
    intensities = [w.get("intensity_mean") for w in prosody_data if w.get("intensity_mean")]
    if intensities:
        features["intensity_mean"] = statistics.mean(intensities)

        # Check for intensity trend (trailing off / building up)
        if len(intensities) >= THRESHOLDS["trend_min_words"]:
            # Linear regression slope
            n = len(intensities)
            x_mean = (n - 1) / 2
            slope = sum((i - x_mean) * (v - features["intensity_mean"])
                       for i, v in enumerate(intensities)) / max(1, sum((i - x_mean)**2 for i in range(n)))
            if slope < -1:
                features["intensity_trend"] = "decreasing"
            elif slope > 1:
                features["intensity_trend"] = "increasing"
            else:
                features["intensity_trend"] = "stable"

    # Pause frequency
    pauses = [w.get("pause_before") for w in prosody_data if w.get("pause_before")]
    features["pause_count"] = len(pauses)
    features["pause_frequency"] = len(pauses) / len(prosody_data) if prosody_data else 0
    if features["pause_frequency"] > THRESHOLDS["pause_frequency_high"]:
        features["pause_frequency_category"] = "high"
    elif features["pause_frequency"] < THRESHOLDS["pause_frequency_low"]:
        features["pause_frequency_category"] = "low"
    else:
        features["pause_frequency_category"] = "medium"

    return features


def compute_word_features(
    word_data: Dict[str, Any],
    all_words: List[Dict[str, Any]],
    index: int,
    utterance_features: Dict[str, Any]
) -> Dict[str, Any]:
    """
    Compute features for a single word relative to utterance context.

    @param word_data Current word's prosodic data
    @param all_words All words for context
    @param index Current word's index
    @param utterance_features Pre-computed utterance-level features
    @returns Dict of computed features for rule matching
    """
    features = dict(word_data)  # Start with raw prosody

    # Relative pitch (compared to utterance mean)
    if word_data.get("pitch_mean") and utterance_features.get("pitch_mean"):
        diff = word_data["pitch_mean"] - utterance_features["pitch_mean"]
        if diff > THRESHOLDS["pitch_high_hz_above_mean"]:
            features["pitch_relative"] = "high"
        elif diff < -THRESHOLDS["pitch_low_hz_below_mean"]:
            features["pitch_relative"] = "low"
        else:
            features["pitch_relative"] = "normal"

    # Relative intensity (already in word_data as intensity_relative)
    # Add more granular dB difference
    if word_data.get("intensity_mean") and utterance_features.get("intensity_mean"):
        diff = word_data["intensity_mean"] - utterance_features["intensity_mean"]
        features["intensity_db_above_mean"] = diff if diff > 0 else 0
        features["intensity_db_below_mean"] = -diff if diff < 0 else 0

    # Detect pitch irregularity (potential laugh/cry)
    # Look at variance in recent words
    if index >= 2:
        recent_pitches = [w.get("pitch_mean") for w in all_words[max(0, index-2):index+1] if w.get("pitch_mean")]
        if len(recent_pitches) >= 2:
            import statistics
            try:
                variance = statistics.variance(recent_pitches)
                features["pitch_irregular"] = variance > 500  # High variance indicates irregularity
            except:
                features["pitch_irregular"] = False

    # Word duration (for detecting short bursts like laughs)
    duration = word_data.get("end", 0) - word_data.get("start", 0)
    features["duration_short"] = duration < 0.2

    # Local intensity trend (for trailing off detection)
    if index >= THRESHOLDS["trend_min_words"] - 1:
        recent_intensities = [
            w.get("intensity_mean", 60) or 60
            for w in all_words[max(0, index - 2):index + 1]
        ]
        if all(recent_intensities[i] > recent_intensities[i + 1]
               for i in range(len(recent_intensities) - 1)):
            features["local_intensity_trend"] = "decreasing"
        elif all(recent_intensities[i] < recent_intensities[i + 1]
                 for i in range(len(recent_intensities) - 1)):
            features["local_intensity_trend"] = "increasing"

    return features


# =============================================================================
# RULE MATCHING
# =============================================================================

def match_rule(features: Dict[str, Any], rule: Dict) -> bool:
    """
    Check if features match a rule's conditions.

    Supports condition formats:
    - {"key": "value"} - exact match
    - {"key": ">N"} - greater than N
    - {"key": "<N"} - less than N
    - {"key": True/False} - boolean match
    """
    conditions = rule.get("conditions", {})

    for key, expected in conditions.items():
        actual = features.get(key)

        if actual is None:
            return False

        # Handle comparison operators
        if isinstance(expected, str):
            if expected.startswith(">"):
                try:
                    threshold = float(expected[1:])
                    if not (isinstance(actual, (int, float)) and actual > threshold):
                        return False
                except ValueError:
                    return False
            elif expected.startswith("<"):
                try:
                    threshold = float(expected[1:])
                    if not (isinstance(actual, (int, float)) and actual < threshold):
                        return False
                except ValueError:
                    return False
            else:
                # Exact string match
                if actual != expected:
                    return False
        elif isinstance(expected, bool):
            if actual != expected:
                return False
        else:
            # Numeric or other exact match
            if actual != expected:
                return False

    return True


def get_annotations_for_word(
    word_features: Dict[str, Any],
    utterance_features: Dict[str, Any]
) -> List[str]:
    """
    Get all applicable annotations for a word.

    @param word_features Computed features for this word
    @param utterance_features Computed features for full utterance
    @returns List of annotation strings
    """
    annotations = []
    matched_categories = set()

    # Merge features for matching
    combined = {**utterance_features, **word_features}

    for rule in ANNOTATION_RULES:
        category = rule.get("category", "other")

        # Skip if we already matched this category (first match wins per category)
        if category in matched_categories:
            continue

        if match_rule(combined, rule):
            annotations.append(rule["annotation"])
            matched_categories.add(category)

    return annotations


# =============================================================================
# MAIN FORMATTING FUNCTION
# =============================================================================

def format_annotations(prosody_data: List[Dict[str, Any]]) -> str:
    """
    @description Format prosodically-enriched words into annotated text.

    @upstream Called by: modal_app.process()
    @downstream Calls: compute_utterance_features, compute_word_features, get_annotations_for_word

    @param prosody_data List of word dicts with prosodic features from extract_prosody()
    @returns Formatted string with stage direction annotations

    @example
        data = [
            {"word": "I", "intensity_relative": "soft", "pitch_slope": 0, "pause_before": None},
            {"word": "don't", "intensity_relative": "soft", "pitch_slope": -0.4, "pause_before": None},
            {"word": "know", "intensity_relative": "soft", "pitch_slope": -0.5, "pause_before": None},
            {"word": "that", "intensity_relative": "normal", "pitch_slope": 0.6, "pause_before": 2.1},
        ]
        result = format_annotations(data)
        # Returns: "[softly, trailing off] I don't know... [thoughtful pause] ...that [rising, questioning]"
    """
    if not prosody_data:
        return ""

    # Compute utterance-level features once
    utterance_features = compute_utterance_features(prosody_data)

    output_parts = []
    current_annotations = []
    words_since_annotation = 0

    for i, word_data in enumerate(prosody_data):
        word = word_data["word"]

        # Compute features for this word
        word_features = compute_word_features(word_data, prosody_data, i, utterance_features)

        # Handle pause before this word
        pause = word_data.get("pause_before")
        if pause:
            # Get pause annotation
            pause_annotation = _format_pause(pause, utterance_features)
            output_parts.append(pause_annotation)
            current_annotations = []
            words_since_annotation = 0

        # Get annotations for this word
        word_annotations = get_annotations_for_word(word_features, utterance_features)

        # If we have new annotations that differ from current, start new group
        if word_annotations and word_annotations != current_annotations:
            current_annotations = word_annotations
            words_since_annotation = 0

            # Format annotation prefix
            annotation_str = ", ".join(current_annotations)
            output_parts.append(f"[{annotation_str}] {word}")
        else:
            # Just add the word
            output_parts.append(word)

        words_since_annotation += 1

    # Handle trailing intonation at the end
    if prosody_data:
        last_word = prosody_data[-1]
        trailing = _get_trailing_annotation(last_word)
        if trailing:
            output_parts.append(f"[{trailing}]")

    return " ".join(output_parts)


def _format_pause(duration: float, utterance_features: Dict[str, Any]) -> str:
    """
    Format a pause as a stage direction using rule-based matching.

    @param duration Pause duration in seconds
    @param utterance_features Context for pause interpretation
    @returns Formatted pause string
    """
    if duration >= THRESHOLDS["pause_dramatic"]:
        return f"... [{duration:.1f}s, dramatic pause] ..."
    elif duration >= THRESHOLDS["pause_thoughtful"]:
        return f"... [{duration:.1f}s, thoughtful pause] ..."
    else:
        return f"... [{duration:.1f}s] ..."


def _get_trailing_annotation(word_data: Dict[str, Any]) -> str:
    """
    Get final intonation annotation for sentence-final word.

    @param word_data Last word's prosodic data
    @returns Annotation string or empty string
    """
    pitch_slope = word_data.get("pitch_slope", 0)

    if pitch_slope > THRESHOLDS["pitch_slope_rising"]:
        return "rising, questioning"
    elif pitch_slope < THRESHOLDS["pitch_slope_falling"]:
        return "falling, declarative"

    return ""
