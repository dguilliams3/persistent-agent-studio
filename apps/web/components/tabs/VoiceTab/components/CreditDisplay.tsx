/**
 * ElevenLabs Credit Display Component
 *
 * @module components/tabs/VoiceTab/components/CreditDisplay
 * @description Displays ElevenLabs TTS credit usage with a gradient progress bar.
 * Shows remaining characters, usage ratio, and days until reset.
 *
 * Pure presentational component - receives all data via props, no store access.
 *
 * @upstream Called by:
 *   - VoiceTab/index.jsx - Renders at top of voice tab
 * @downstream Calls:
 *   - None (pure presentation)
 */

/**
 * @description Display ElevenLabs TTS credit usage with progress bar
 *
 * @upstream Called by: VoiceTab/index.jsx
 * @downstream Calls: None
 *
 * @param {Object} props
 * @param {Object|null} props.credits - Credits object from store
 * @param {number} props.credits.remaining - Characters remaining
 * @param {number} props.credits.used - Characters used
 * @param {number} props.credits.limit - Total character limit
 * @param {number} props.credits.resetUnix - Unix timestamp for quota reset
 * @returns {JSX.Element|null} Credit display bar or null if no credits
 *
 * @example
 * <CreditDisplay credits={{ remaining: 5000, used: 5000, limit: 10000, resetUnix: 1737000000 }} />
 */
export default function CreditDisplay({ credits }: any) {
  if (!credits) return null;

  const percentUsed = (credits.used || 0) / (credits.limit || 1) * 100;
  const percentRemaining = Math.max(0, 100 - percentUsed);

  // Calculate days until reset
  const daysUntilReset = credits.resetUnix
    ? Math.ceil((credits.resetUnix * 1000 - Date.now()) / (1000 * 60 * 60 * 24))
    : null;

  return (
    <div
      className="rounded-xl p-4 text-white hover-lift"
      style={{ background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)' }}
    >
      <div className="flex justify-between items-center mb-2">
        <div>
          <div className="text-xl font-bold">
            {credits.remaining?.toLocaleString() || '—'}
          </div>
          <div className="text-xs opacity-85">characters remaining</div>
        </div>
        <div className="text-right text-xs opacity-75">
          {daysUntilReset !== null && (
            <div>Resets in {daysUntilReset} day{daysUntilReset !== 1 ? 's' : ''}</div>
          )}
          <div>
            {credits.used?.toLocaleString() || 0} / {credits.limit?.toLocaleString() || 0} used
          </div>
        </div>
      </div>
      <div className="h-1.5 bg-white/30 rounded-full overflow-hidden">
        <div
          className="h-full bg-white rounded-full transition-all duration-300"
          style={{ width: `${percentRemaining}%` }}
        />
      </div>
    </div>
  );
}
