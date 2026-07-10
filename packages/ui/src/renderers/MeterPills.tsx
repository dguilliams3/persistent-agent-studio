/**
 * Colored Meter Pills — Visual Bars for All Active Meters
 *
 * @module packages/ui/renderers/MeterPills
 * @description Shows all active meters (core + involuntary) as colored visual bars.
 * Each meter gets its own color from CSS custom properties defined in tokens.css.
 *
 * Meter scale: 0-10 integer values, rendered as percentage fills.
 * Core meters: aliveness, curiosity, connection, ease, delight
 * Involuntary meters: anxiety, activity
 *
 * @antipattern Do NOT import Zustand or any store — pure renderer.
 * @antipattern Do NOT use raw hex colors — use CSS custom properties.
 * @antipattern Do NOT use inline transition shorthand — use the CSS class
 *   `.meter-fill-transition` so prefers-reduced-motion works reliably.
 *
 * @upstream Called by: ExpandedThinking, ChatView, or any component showing meter state
 * @downstream Calls: None (leaf renderer)
 */

/** CSS for meter fill transition + reduced-motion. */
const METER_FILL_STYLES = `
.meter-fill-transition {
  transition: width var(--duration-normal) ease-out;
}
@media (prefers-reduced-motion: reduce) {
  .meter-fill-transition {
    transition: none !important;
  }
}
`;

/** Configuration for a single meter. */
interface MeterConfig {
  /** Full display label */
  label: string;
  /** Single-letter abbreviation */
  abbrev: string;
  /** CSS custom property for this meter's color */
  colorVar: string;
}

/**
 * All known meters with their display config.
 * Order reflects display priority: core meters first, then involuntary.
 */
const METER_CONFIGS: Record<string, MeterConfig> = {
  aliveness:  { label: 'Aliveness',  abbrev: 'A', colorVar: 'var(--meter-aliveness)' },
  curiosity:  { label: 'Curiosity',  abbrev: 'C', colorVar: 'var(--meter-curiosity)' },
  connection: { label: 'Connection', abbrev: 'N', colorVar: 'var(--meter-connection)' },
  ease:       { label: 'Ease',       abbrev: 'E', colorVar: 'var(--meter-ease)' },
  delight:    { label: 'Delight',    abbrev: 'D', colorVar: 'var(--meter-delight)' },
  anxiety:    { label: 'Anxiety',    abbrev: 'X', colorVar: 'var(--meter-anxiety)' },
  activity:   { label: 'Activity',   abbrev: 'V', colorVar: 'var(--meter-activity)' },
};

/** Display order for meters. Known meters come first in defined order, then unknowns. */
const METER_ORDER = Object.keys(METER_CONFIGS);

export interface MeterPillsProps {
  /** Meter values: { aliveness: 7, curiosity: 6, ... } (0-10 scale) */
  meters?: Record<string, number> | null;
  /** Compact mode: show abbreviations instead of labels */
  compact?: boolean;
}

/**
 * Single meter bar with label, colored fill, and value display.
 */
function MeterBar({
  label,
  abbrev,
  value,
  colorVar,
  compact,
}: {
  label: string;
  abbrev: string;
  value: number;
  colorVar: string;
  compact: boolean;
}) {
  const percentage = Math.round(Math.min(10, Math.max(0, value)) * 10);

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--spacing-xs)',
        minHeight: compact ? undefined : '24px',
      }}
      title={`${label}: ${value}/10`}
    >
      {/* Label or abbreviation */}
      <span
        style={{
          fontSize: compact ? '0.6875rem' : '0.75rem',
          color: colorVar,
          fontWeight: 600,
          minWidth: compact ? '14px' : '72px',
          flexShrink: 0,
          textAlign: compact ? 'center' : 'left',
        }}
      >
        {compact ? abbrev : label}
      </span>

      {/* Visual bar track */}
      <div
        style={{
          flex: 1,
          minWidth: compact ? '32px' : '48px',
          height: '6px',
          borderRadius: '3px',
          backgroundColor: 'var(--surface-raised)',
          overflow: 'hidden',
        }}
      >
        {/* Colored fill */}
        <div
          className="meter-fill-transition"
          style={{
            width: `${percentage}%`,
            height: '100%',
            borderRadius: '3px',
            backgroundColor: colorVar,
          }}
        />
      </div>

      {/* Value */}
      <span
        style={{
          fontSize: '0.6875rem',
          color: 'var(--text-muted)',
          fontFamily: "'JetBrains Mono', monospace",
          minWidth: '18px',
          textAlign: 'right',
          flexShrink: 0,
        }}
      >
        {value}
      </span>
    </div>
  );
}

/**
 * MeterPills — colored visual bars for all active meters.
 *
 * Renders every meter present in the `meters` prop. Known meters
 * are displayed in a consistent order; unknown meters appear at the end
 * with a fallback color.
 */
export function MeterPills({ meters, compact = false }: MeterPillsProps) {
  if (!meters || Object.keys(meters).length === 0) {
    return null;
  }

  /** Sort entries: known meters in defined order, unknowns alphabetically at end. */
  const entries = Object.entries(meters)
    .filter(([, value]) => value != null)
    .sort(([a], [b]) => {
      const aIdx = METER_ORDER.indexOf(a);
      const bIdx = METER_ORDER.indexOf(b);
      if (aIdx >= 0 && bIdx >= 0) return aIdx - bIdx;
      if (aIdx >= 0) return -1;
      if (bIdx >= 0) return 1;
      return a.localeCompare(b);
    });

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: compact ? 'row' : 'column',
        gap: compact ? 'var(--spacing-sm)' : 'var(--spacing-xs)',
        flexWrap: compact ? 'wrap' : undefined,
      }}
    >
      <style>{METER_FILL_STYLES}</style>
      {entries.map(([name, value]) => {
        const config = METER_CONFIGS[name];
        return (
          <MeterBar
            key={name}
            label={config?.label || name}
            abbrev={config?.abbrev || name.charAt(0).toUpperCase()}
            value={value}
            colorVar={config?.colorVar || 'var(--text-secondary)'}
            compact={compact}
          />
        );
      })}
    </div>
  );
}

export default MeterPills;
