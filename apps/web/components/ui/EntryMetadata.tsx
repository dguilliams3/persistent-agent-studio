/**
 * Entry Metadata — timestamps and meter snapshot chips
 *
 * @module ui/EntryMetadata
 * @description Renders timestamp and optional meter snapshot (A7 C6 N10 E8 D7)
 * as colored chips next to each history entry.
 *
 * @upstream Called by: ui/HistoryEntryRow
 * @downstream Calls: None — leaf presentational component
 * @pattern Decomposed sub-component — extracted from HistoryEntryRow (Wave 2C)
 */

interface EntryMetadataProps {
  createdAt: string;
  meterSnapshot?: string | null;
  showMeterSnapshot?: boolean;
  formatTimeShort: (time: string) => string;
}

/** Meter letter -> color mapping (uses CSS custom properties from tokens.css) */
const METER_COLORS: Record<string, string> = {
  A: 'var(--meter-aliveness)',
  C: 'var(--meter-curiosity)',
  N: 'var(--meter-connection)',
  E: 'var(--meter-ease)',
  D: 'var(--meter-delight)',
};

export function EntryMetadata({
  createdAt,
  meterSnapshot,
  showMeterSnapshot = true,
  formatTimeShort,
}: EntryMetadataProps) {
  return (
    <span className="text-content-muted mr-2 inline-flex items-center gap-1.5">
      <span>{formatTimeShort(createdAt)}</span>
      {showMeterSnapshot && meterSnapshot && (
        <span className="inline-flex gap-0.5" title={`State: ${meterSnapshot}`}>
          {meterSnapshot.split(' ').map((meter, idx) => {
            const letter = meter.charAt(0);
            const value = meter.slice(1);
            const color = METER_COLORS[letter] || 'var(--text-muted)';
            return (
              <span
                key={idx}
                className="text-[10px] font-mono font-semibold"
                style={{ color, opacity: 0.7 }}
              >
                {letter}{value}
              </span>
            );
          })}
        </span>
      )}
    </span>
  );
}

export default EntryMetadata;
