/**
 * Voice History Card Component
 *
 * @module components/tabs/VoiceTab/components/VoiceHistoryCard
 * @description Individual voice history entry card with play/stop button,
 * metadata display (date, model, chars), and text preview with prosody styling.
 *
 * Pure presentational component - receives all data via props.
 *
 * Prosody annotations (e.g., [softly], [pause, 2s], [rising]) are styled
 * as distinct badges to differentiate emotional/temporal markers from text.
 *
 * @upstream Called by:
 *   - VoiceTab/index.jsx - Renders in voice history list
 * @downstream Calls:
 *   - formatDate (internal helper)
 *   - getStabilityDisplay (internal helper)
 *   - formatTextWithProsody (internal helper) - Styles bracketed annotations
 */

/**
 * @description Format date in Eastern timezone for display
 *
 * @param {string} isoString - ISO date string from database (stored as UTC)
 * @returns {string} Formatted date string (e.g., "Jan 14, 6:30 PM")
 *
 * @note Appends 'Z' to ensure UTC interpretation before timezone conversion
 */
function formatDate(isoString: any) {
  const date = new Date(isoString + 'Z');
  return date.toLocaleString('en-US', {
    timeZone: 'America/New_York',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

/**
 * @description Get stability display string for v3 model
 *
 * @param {number|null} stability - Stability value (0, 0.5, or 1)
 * @returns {string} Display string (C=Creative, N=Natural, R=Robust)
 *
 * @example
 * getStabilityDisplay(0)   // Returns 'C'
 * getStabilityDisplay(0.5) // Returns 'N'
 * getStabilityDisplay(1)   // Returns 'R'
 * getStabilityDisplay(null) // Returns ''
 */
function getStabilityDisplay(stability: any) {
  if (stability === null || stability === undefined) return '';
  if (stability === 0) return 'C';
  if (stability === 0.5) return 'N';
  return 'R';
}

/**
 * @description Format text with prosody annotations styled as badges
 *
 * Prosody annotations follow patterns like [softly], [pause, 2s], [rising tone].
 * These are emotional/temporal markers from WhisperX prosody analysis that should
 * be visually distinct from the actual speech content.
 *
 * @param {string} text - Text that may contain bracketed prosody annotations
 * @returns {JSX.Element[]} Array of text spans and styled prosody badges
 *
 * @example
 * formatTextWithProsody("Hello [softly] world")
 * // Returns: ["Hello ", <span className="prosody-badge">[softly]</span>, " world"]
 */
function formatTextWithProsody(text: any) {
  if (!text) return null;

  // Match bracketed annotations: [word], [word, detail], [multiple words]
  const prosodyRegex = /(\[[^\]]+\])/g;
  const parts = text.split(prosodyRegex);

  return parts.map((part: any, index: any) => {
    if (prosodyRegex.test(part)) {
      // Reset regex lastIndex since we're reusing it
      prosodyRegex.lastIndex = 0;
      return (
        <span
          key={index}
          className="inline-block px-1.5 py-0.5 mx-0.5 text-xs rounded bg-accent/20 text-accent italic"
          title="Prosody annotation"
        >
          {part}
        </span>
      );
    }
    return part;
  });
}

/**
 * @description Voice history card with play button and metadata
 *
 * @upstream Called by: VoiceTab/index.jsx (history list)
 * @downstream Calls: formatDate, getStabilityDisplay
 *
 * @param {Object} props
 * @param {Object} props.item - Voice history entry
 * @param {number} props.item.id - Entry ID
 * @param {string} props.item.created_at - ISO timestamp (UTC)
 * @param {string} props.item.model - TTS model used ('v2'|'v3'|'flash'|'turbo')
 * @param {number|null} props.item.stability - Stability value (v3 only)
 * @param {number} props.item.char_count - Character count
 * @param {string} props.item.text - Text that was spoken
 * @param {boolean} props.isPlaying - Whether this entry is currently playing
 * @param {Function} props.onPlay - Callback to play/stop this entry
 * @returns {JSX.Element} Voice history card
 *
 * @example
 * <VoiceHistoryCard
 *   item={{ id: 1, created_at: '2026-01-15T12:00:00', model: 'v3', stability: 0.5, char_count: 42, text: 'Hello' }}
 *   isPlaying={false}
 *   onPlay={() => handlePlay(1)}
 * />
 */
export default function VoiceHistoryCard({ item, isPlaying, onPlay }: any) {
  const modelDisplay = item.model?.toUpperCase() || 'V2';
  const stabilityStr = item.model === 'v3' ? getStabilityDisplay(item.stability) : '';

  return (
    <div className="card-elevated hover-card p-3 flex items-start gap-3">
      {/* Play Button */}
      <button
        onClick={onPlay}
        className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors flex-shrink-0 ${
          isPlaying
            ? 'bg-danger text-white'
            : 'bg-success text-white hover:bg-success/80'
        }`}
        title={isPlaying ? 'Stop' : 'Play'}
      >
        {isPlaying ? '\u23F9' : '\u25B6'}
      </button>

      {/* Content */}
      <div className="flex-1 min-w-0">
        {/* Meta row */}
        <div className="flex items-center gap-2 text-xs text-content-muted mb-1">
          <span>{formatDate(item.created_at)}</span>
          <span className="bg-depth px-2 py-0.5 rounded text-accent">
            {modelDisplay}
            {stabilityStr && ` (${stabilityStr})`}
          </span>
          <span>{item.char_count} chars</span>
        </div>

        {/* Text Preview (with prosody styling) */}
        <p className="text-sm text-content-secondary line-clamp-2">
          {formatTextWithProsody(item.text)}
        </p>
      </div>
    </div>
  );
}

// Export helpers for potential reuse
export { formatDate, getStabilityDisplay, formatTextWithProsody };
