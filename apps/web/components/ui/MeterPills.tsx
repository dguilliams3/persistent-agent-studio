/**
 * Meter Pills Component
 *
 * @module components/ui/MeterPills
 * @description Display-only compact meter pills showing Clio's internal state.
 *
 * Display: Small colored pills [A7] [C6] [N10] [E8] [D7] in dashboard header
 *
 * NOTE (2026-01-22): Expanded overlay DISABLED due to z-index stacking issues.
 * The overlay rendered behind content despite position:fixed with z-[1000].
 * Phase 8 will fix this using React Portal or @radix-ui/react-popover.
 *
 * For now, meters are display-only. Users can adjust via:
 * - Telegram: /meter <name> <value>
 *
 * Location: Dashboard stats row, between Context Size and Cost columns.
 * On mobile: Status bar below the user's status.
 *
 * @upstream Called by:
 *   - ClaudeExistenceLoop.jsx - stats row (desktop) and status bar (mobile)
 * @downstream Calls:
 *   - Icon component
 *
 * @param {Object} props
 * @param {Object} props.meters - Meter data { values, histories }
 * @param {boolean} [props.expanded=false] - UNUSED (kept for API compat)
 * @param {Function} [props.onToggle] - UNUSED (kept for API compat)
 * @param {Function} [props.onMeterChanged] - UNUSED (kept for API compat)
 *
 * @example
 * // Display-only (expanded props ignored until Phase 8)
 * <MeterPills meters={meters} />
 */

// MetersDisplay import removed - overlay disabled until Phase 8

/**
 * Meter configuration - matches MetersDisplay for consistency
 * @type {Object.<string, {label: string, abbrev: string, color: string, icon: string}>}
 */
const METER_CONFIG = {
  aliveness: {
    label: 'Aliveness',
    abbrev: 'A',
    color: 'var(--meter-aliveness)',
    icon: 'Sparkles'
  },
  curiosity: {
    label: 'Curiosity',
    abbrev: 'C',
    color: 'var(--meter-curiosity)',
    icon: 'Telescope'
  },
  connection: {
    label: 'Connection',
    abbrev: 'N',
    color: 'var(--meter-connection)',
    icon: 'HeartHandshake'
  },
  ease: {
    label: 'Ease',
    abbrev: 'E',
    color: 'var(--meter-ease)',
    icon: 'Waves'
  },
  delight: {
    label: 'Delight',
    abbrev: 'D',
    color: 'var(--meter-delight)',
    icon: 'Sparkle'
  }
};

/**
 * Single meter pill - compact display with colored background
 *
 * @param {Object} props
 * @param {string} props.abbrev - Single letter abbreviation
 * @param {number} props.value - Current value (0-10)
 * @param {string} props.color - Hex color for this meter
 * @param {string} props.label - Full label for tooltip
 */
function MeterPill({ abbrev, value, color, label }: { abbrev: string; value: number; color: string; label: string }) {
  return (
    <span
      className="inline-flex items-center gap-0.5 px-1 text-xs font-bold"
      style={{
        color: color,
        textShadow: `0 0 8px ${color}30`,
      }}
      title={`${label}: ${value}/10`}
    >
      {abbrev}
      <span className="font-mono">{value}</span>
    </span>
  );
}


// CollapsedPills component removed - overlay disabled until Phase 8

interface MeterPillsProps {
  meters?: {
    values: Record<string, number>;
    histories?: Record<string, number[]>;
  } | null;
  expanded?: boolean;
  onToggle?: () => void;
  onMeterChanged?: (result: unknown) => void;
}

/**
 * Main MeterPills component - shows compact meter pills
 *
 * NOTE (2026-01-22): Expanded overlay temporarily disabled due to z-index stacking
 * issues. The overlay rendered behind content despite position:fixed with z-[1000].
 * Will be fixed in Phase 8 using React Portal or @radix-ui/react-popover.
 *
 * For now, pills are display-only. Users can still adjust meters via:
 * - Telegram: /meter <name> <value>
 * - MetersDisplay in ChatTab (if re-enabled)
 */
export function MeterPills({
  meters,
  // eslint-disable-next-line no-unused-vars, @typescript-eslint/no-unused-vars
  expanded: _expanded = false,  // Prop kept for API compatibility, currently unused
  // eslint-disable-next-line no-unused-vars, @typescript-eslint/no-unused-vars
  onToggle: _onToggle,          // Prop kept for API compatibility, currently unused
  // eslint-disable-next-line no-unused-vars, @typescript-eslint/no-unused-vars
  onMeterChanged: _onMeterChanged     // Prop kept for API compatibility, currently unused
}: MeterPillsProps) {
  if (!meters || !meters.values) {
    return null;
  }

  // Borderless inline strip: the header carries three controls (branch,
  // meters, view toggle); a bordered card here read as a third stacked
  // "block" and forced the header onto extra rows on mobile. The colored
  // abbreviations are legible on their own.
  return (
    <div
      className="flex items-center gap-1"
      data-meter-pills
      title="Current internal state"
    >
      {Object.entries(METER_CONFIG).map(([name, config]) => (
        <MeterPill
          key={name}
          abbrev={config.abbrev}
          value={meters.values[name] ?? 5}
          color={config.color}
          label={config.label}
        />
      ))}
    </div>
  );
}


export default MeterPills;
