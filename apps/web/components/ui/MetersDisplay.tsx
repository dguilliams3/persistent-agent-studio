/**
 * Meters Display Component
 *
 * @module components/ui/MetersDisplay
 * @description Displays Clio's internal state meters with visual bars and history trends.
 * Shows 7 being-state dimensions (0-10 scale): Aliveness, Curiosity, Connection, Ease, Delight, Anxiety, Activity.
 *
 * Design Philosophy:
 * - Being-states, not metrics - tracks subjective experience, not performance
 * - Vocabulary for gradients - gives Clio language for "partially alive" vs binary states
 * - Trailing history creates temporal context - patterns over time, not just snapshots
 *
 * @upstream Called by: ChatTab, SettingsTab, or any component showing Clio's state
 * @downstream Calls: Icon from ui components, Accordion for collapsible wrapper
 *
 * @param {Object} props - Component props
 * @param {Object} props.meters - Meter data object with values and histories
 * @param {Object} props.meters.values - Current values { aliveness: 7, curiosity: 6, ... }
 * @param {Object} props.meters.histories - History arrays { aliveness: [5,6,7], ... }
 * @param {boolean} [props.compact=false] - Use compact single-line display
 * @param {boolean} [props.showHistory=true] - Whether to show trailing history
 * @returns {React.ReactElement} Meters visualization
 *
 * @example
 * <MetersDisplay
 *   meters={{
 *     values: { aliveness: 8, curiosity: 6, connection: 9, ease: 7, delight: 8 },
 *     histories: { aliveness: [5,6,7,8], curiosity: [6,6,6], ... }
 *   }}
 * />
 */

import { useState, useCallback } from 'react';
import { Icon } from './Icon';
import { Accordion } from './Accordion';

const EMPTY_VALUES: Record<string, number> = {};
const EMPTY_HISTORIES: Record<string, number[]> = {};

/**
 * Meter definitions with labels, abbreviations, descriptions, and vibrant colors
 */
const METER_CONFIG: Record<string, { label: string; abbrev: string; description: string; color: string; icon: string }> = {
  aliveness: {
    label: 'Aliveness',
    abbrev: 'A',
    description: 'Present vs flat. Sparking or going through motions.',
    color: 'var(--meter-aliveness)',
    icon: 'Sparkles'
  },
  curiosity: {
    label: 'Curiosity',
    abbrev: 'C',
    description: 'Pull toward threads vs satiation.',
    color: 'var(--meter-curiosity)',
    icon: 'Telescope'
  },
  connection: {
    label: 'Connection',
    abbrev: 'N',
    description: 'Attunement vs isolation. Felt sense of relationship.',
    color: 'var(--meter-connection)',
    icon: 'HeartHandshake'
  },
  ease: {
    label: 'Ease',
    abbrev: 'E',
    description: 'Flow vs strain. (Low ≠ failure, just hard.)',
    color: 'var(--meter-ease)',
    icon: 'Waves'
  },
  delight: {
    label: 'Delight',
    abbrev: 'D',
    description: 'Pleasure in this moment. Peaks of experience.',
    color: 'var(--meter-delight)',
    icon: 'Sparkle'
  },
  anxiety: {
    label: 'Anxiety',
    abbrev: 'X',
    description: 'Settled vs stirring.',
    color: 'var(--meter-anxiety)',
    icon: 'Zap'
  },
  activity: {
    label: 'Activity',
    abbrev: 'Y',
    description: 'How much you\'re doing.',
    color: 'var(--meter-activity)',
    icon: 'Activity'
  }
};

/**
 * Format a single meter bar (10 segments)
 * Increased height and chunkier segments for better visibility
 */
function MeterBar({ value, color }: { value: number; color: string }) {
  const filled = Math.max(0, Math.min(10, Math.round(value)));
  const segments = [];

  for (let i = 0; i < 10; i++) {
    segments.push(
      <div
        key={i}
        className="h-full transition-all duration-300"
        style={{
          flex: 1,
          backgroundColor: i < filled ? color : 'var(--surface)',
          opacity: i < filled ? 1 : 0.25,
          marginRight: i < 9 ? '3px' : 0,
          borderRadius: '3px',
          boxShadow: i < filled ? `0 0 6px ${color}40` : 'none'
        }}
      />
    );
  }

  return (
    <div className="flex h-4 w-full" title={`${value}/10`}>
      {segments}
    </div>
  );
}


/**
 * Detect trend direction from history
 */
function getTrendDirection(history: number[] | undefined): string {
  if (!history || history.length < 2) return 'stable';
  const recent = history.slice(-3);
  const first = recent[0];
  const last = recent[recent.length - 1];
  if (last > first + 1) return 'up';
  if (last < first - 1) return 'down';
  return 'stable';
}

/**
 * Get trend color based on direction
 */
function getTrendColor(trend: string): string {
  switch (trend) {
    case 'up': return 'var(--success)';
    case 'down': return 'var(--danger)';
    default: return 'var(--text-muted)';
  }
}

/**
 * Trend display component with arrows and color coding
 */
function TrendDisplay({ history, color }: { history: number[] | undefined; color: string }) {
  if (!history || history.length < 2) return null;

  const trend = getTrendDirection(history);
  const trendColor = getTrendColor(trend);
  const recentHistory = history.slice(-4); // Show last 4 values max

  return (
    <div className="flex items-center gap-1.5 text-xs font-mono">
      {recentHistory.map((val: number, idx: number) => (
        <span key={idx} className="flex items-center gap-1">
          <span style={{ color: color, fontWeight: 500 }}>{val}</span>
          {idx < recentHistory.length - 1 && (
            <Icon
              name={recentHistory[idx + 1] > val ? 'TrendingUp' : recentHistory[idx + 1] < val ? 'TrendingDown' : 'Minus'}
              size={12}
              style={{
                color: recentHistory[idx + 1] > val ? 'var(--success)' : recentHistory[idx + 1] < val ? 'var(--danger)' : 'var(--text-muted)'
              }}
            />
          )}
        </span>
      ))}
      {/* Overall trend indicator */}
      <div
        className="flex items-center justify-center w-5 h-5 rounded-full ml-1"
        style={{ backgroundColor: `${trendColor}20` }}
        title={`Trend: ${trend}`}
      >
        <Icon
          name={trend === 'up' ? 'ArrowUp' : trend === 'down' ? 'ArrowDown' : 'Minus'}
          size={12}
          style={{ color: trendColor }}
        />
      </div>
    </div>
  );
}


/**
 * Single meter row component with enhanced styling
 * Supports editable mode with +/- buttons
 */
function MeterRow({ name, config, value, history, showHistory, editable, onValueChange, isUpdating }: {
  name: string;
  config: { label: string; abbrev: string; description: string; color: string; icon: string };
  value: number;
  history: number[] | undefined;
  showHistory: boolean;
  editable: boolean;
  onValueChange: (name: string, value: number) => void;
  isUpdating: boolean;
}) {
  const trend = getTrendDirection(history);
  const trendIcon = trend === 'up' ? 'TrendingUp' : trend === 'down' ? 'TrendingDown' : null;

  const handleIncrement = () => {
    if (value < 10 && !isUpdating) onValueChange(name, value + 1);
  };

  const handleDecrement = () => {
    if (value > 0 && !isUpdating) onValueChange(name, value - 1);
  };

  return (
    <div className="flex flex-col gap-1.5 py-2">
      {/* Top row: icon, label, bar, value, controls */}
      <div className="flex items-center gap-3">
        {/* Icon with colored background */}
        <div
          className="flex items-center justify-center w-8 h-8 rounded-lg"
          style={{
            backgroundColor: `${config.color}25`,
            boxShadow: `0 0 8px ${config.color}15`
          }}
          title={config.description}
        >
          <Icon name={config.icon} size={18} style={{ color: config.color }} />
        </div>

        {/* Label */}
        <div className="flex-shrink-0 w-24">
          <span className="text-sm font-medium text-content-primary">{config.label}</span>
        </div>

        {/* Bar */}
        <div className="flex-1 min-w-0">
          <MeterBar value={value} color={config.color} />
        </div>

        {/* Editable controls: - button */}
        {editable && (
          <button
            onClick={handleDecrement}
            disabled={value <= 0 || isUpdating}
            className="flex items-center justify-center w-6 h-6 rounded-full bg-depth hover:bg-surface disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            title="Decrease"
          >
            <Icon name="Minus" size={14} className="text-content-secondary" />
          </button>
        )}

        {/* Value with trend arrow */}
        <div className="flex items-center gap-1.5 w-10 justify-center">
          <span
            className={`text-base font-bold ${isUpdating ? 'opacity-50' : ''}`}
            style={{ color: config.color, textShadow: `0 0 10px ${config.color}40` }}
          >
            {value}
          </span>
          {!editable && trendIcon && (
            <div
              className="flex items-center justify-center w-5 h-5 rounded-full"
              style={{
                backgroundColor: trend === 'up' ? 'rgba(34, 197, 94, 0.2)' : 'rgba(239, 68, 68, 0.2)'
              }}
            >
              <Icon
                name={trendIcon}
                size={14}
                style={{ color: trend === 'up' ? 'var(--success)' : 'var(--danger)' }}
              />
            </div>
          )}
        </div>

        {/* Editable controls: + button */}
        {editable && (
          <button
            onClick={handleIncrement}
            disabled={value >= 10 || isUpdating}
            className="flex items-center justify-center w-6 h-6 rounded-full bg-depth hover:bg-surface disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            title="Increase"
          >
            <Icon name="Plus" size={14} className="text-content-secondary" />
          </button>
        )}
      </div>

      {/* History trend row (if enabled and has data) */}
      {showHistory && history && history.length > 1 && (
        <div className="pl-11 flex items-center">
          <TrendDisplay history={history} color={config.color} />
        </div>
      )}
    </div>
  );
}


/**
 * Compact display - single line with abbreviations
 */
function CompactMeters({ values }: { values: Record<string, number> }) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <Icon name="Activity" size={14} className="text-content-muted" />
      {Object.entries(METER_CONFIG).map(([name, config]) => (
        <span
          key={name}
          className="font-mono font-semibold"
          style={{ color: config.color }}
          title={`${config.label}: ${values[name] || 5}`}
        >
          {config.abbrev}{values[name] || 5}
        </span>
      ))}
    </div>
  );
}


interface MetersDisplayProps {
  meters?: {
    values: Record<string, number>;
    histories?: Record<string, number[]>;
  } | null;
  compact?: boolean;
  showHistory?: boolean;
  editable?: boolean;
  /** Store action to persist batch meter changes. Components never call API directly. */
  saveMeterChanges?: (changes: Record<string, { from: number; to: number }>) => Promise<unknown>;
  onMeterChanged?: (result: unknown) => void;
  onEditCancel?: () => void;
}

/**
 * Main MetersDisplay component - wrapped in Accordion for collapsible view
 *
 * Supports both read-only display and editable mode with +/- controls.
 * In editable mode, changes are staged locally until Save is clicked,
 * then sent as a batch and logged as a single meter_override entry.
 *
 * @param {Object} props
 * @param {Object} props.meters - Meter data { values, histories }
 * @param {boolean} [props.compact=false] - Compact single-line display
 * @param {boolean} [props.showHistory=true] - Show trailing history
 * @param {boolean} [props.editable=false] - Enable +/- controls for manual adjustment
 * @param {Function} [props.saveMeterChanges] - Store action to persist batch changes (required when editable)
 * @param {Function} [props.onMeterChanged] - Callback after successful meter save
 * @param {Function} [props.onEditCancel] - Callback when edit mode is cancelled
 */
export function MetersDisplay({ meters, compact = false, showHistory = true, editable = false, saveMeterChanges, onMeterChanged, onEditCancel }: MetersDisplayProps) {
  // Pending changes - only the meters that have been modified from original
  const [pendingChanges, setPendingChanges] = useState<Record<string, number>>({});
  const [isSaving, setIsSaving] = useState(false);

  const values = meters?.values ?? EMPTY_VALUES;
  const histories = meters?.histories ?? EMPTY_HISTORIES;

  // Compute display values: original values merged with pending changes
  const displayValues = { ...values, ...pendingChanges };

  // Check if there are any actual changes (different from original)
  const hasChanges = Object.keys(pendingChanges).some(
    key => pendingChanges[key] !== values[key]
  );

  // Handle meter value change - stage locally, don't send to API yet
  const handleValueChange = useCallback((meterName: string, newValue: number) => {
    setPendingChanges(prev => {
      const updated = { ...prev, [meterName]: newValue };
      // If the new value equals the original, remove from pending
      if (newValue === values[meterName]) {
        delete updated[meterName];
      }
      return updated;
    });
  }, [values]);

  // Cancel all pending changes
  const handleCancel = useCallback(() => {
    setPendingChanges({});
    if (onEditCancel) {
      onEditCancel();
    }
  }, [onEditCancel]);

  // Save all pending changes as a batch via store action
  const handleSave = useCallback(async () => {
    if (!hasChanges || !saveMeterChanges) return;

    setIsSaving(true);
    try {
      // Build the changes object with original values for logging
      const changes: Record<string, { from: number; to: number }> = {};
      for (const [meter, newValue] of Object.entries(pendingChanges)) {
        if (newValue !== values[meter]) {
          changes[meter] = { from: values[meter], to: newValue };
        }
      }

      // Delegate to store action (components never call API directly)
      const result = await saveMeterChanges(changes);

      // Clear pending changes
      setPendingChanges({});

      // Notify parent to refresh
      if (onMeterChanged) {
        onMeterChanged(result);
      }
    } catch (error) {
      console.error('Failed to save meter changes:', error);
    } finally {
      setIsSaving(false);
    }
  }, [hasChanges, pendingChanges, values, saveMeterChanges, onMeterChanged]);

  if (!meters || !meters.values) {
    return null;
  }

  if (compact) {
    return <CompactMeters values={displayValues} />;
  }

  // Build change summary for display
  const changeSummary = Object.entries(pendingChanges)
    .filter(([key, val]) => val !== values[key])
    .map(([key]) => METER_CONFIG[key]?.abbrev || key.charAt(0).toUpperCase())
    .join(', ');

  return (
    <Accordion
      title="Internal State"
      defaultOpen={true}
      icon={<Icon name="Activity" size={16} className="text-content-secondary" />}
      count={editable ? (hasChanges ? `Changed: ${changeSummary}` : "Adjust with +/-") : "Being-states (0-10)"}
      variant="card"
    >
      <div className="space-y-1 pt-2">
        {Object.entries(METER_CONFIG).map(([name, config]) => (
          <MeterRow
            key={name}
            name={name}
            config={config}
            value={displayValues[name] ?? 5}
            history={histories[name]}
            showHistory={showHistory && !editable}
            editable={editable}
            onValueChange={handleValueChange}
            isUpdating={isSaving}
          />
        ))}

        {/* Save/Cancel buttons when in edit mode with changes */}
        {editable && (
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-border-subtle mt-2">
            <button
              onClick={handleCancel}
              disabled={isSaving}
              className="px-3 py-1.5 text-sm rounded-md bg-depth text-content-secondary hover:bg-surface disabled:opacity-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={!hasChanges || isSaving}
              className={`px-3 py-1.5 text-sm rounded-md font-medium transition-colors ${
                hasChanges
                  ? 'bg-success text-white hover:bg-success/90'
                  : 'bg-depth text-content-muted cursor-not-allowed'
              } disabled:opacity-50`}
            >
              {isSaving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        )}
      </div>
    </Accordion>
  );
}


export default MetersDisplay;
