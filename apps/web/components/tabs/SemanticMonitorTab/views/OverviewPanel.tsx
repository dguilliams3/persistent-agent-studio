/**
 * Overview Panel for Semantic Identity Monitor
 *
 * @module tabs/SemanticMonitorTab/views/OverviewPanel
 * @description Displays basin metrics summary with refresh controls and quick stats.
 *
 * This panel provides a high-level view of the semantic identity basin:
 * - Basin metrics card showing distance, z-score, trend
 * - Quick stats row: outlier count (from /sim/anomalies), last computed
 *   (sample count lives on BasinMetricsCard's own tile — stated once)
 * - Three Voices per-type basins with cross-type centroid distances
 * - Weekly Drift bars from /sim/basin/weekly (the settling arc, by ISO week)
 * - Refresh and compute buttons for manual data updates
 *
 * The panel uses useSIMData hook for all data access, keeping state management
 * decoupled from the view layer.
 *
 * @upstream Called by:
 *   - SemanticMonitorTab/index.jsx - Main tab component
 * @downstream Calls:
 *   - hooks/useSIMData.js - Data access and actions
 *   - components/BasinMetricsCard.jsx - Basin visualization
 *   - ui/Icon - Lucide icons
 *   - utils/formatters.js - formatRelativeTime
 */

import { useEffect } from 'react';
import { Icon } from '../../../ui';
import BasinMetricsCard from '../components/BasinMetricsCard';
import { useSIMData } from '../hooks/useSIMData';
import { formatRelativeTime } from '../utils/formatters';
import { usePersonaName } from '../../../../hooks/usePersonaName';

/**
 * @description Quick stats summary row showing key basin metrics at a glance
 *
 * Shows only the stats BasinMetricsCard (rendered directly above) does NOT
 * already print: outlier count (from /sim/anomalies) and computation
 * freshness. A Samples tile used to sit here too, duplicating the card's own
 * Samples tile a few pixels up — the same number stated twice on one screen.
 *
 * @param {Object} props - Component props
 * @param {number|null} props.outlierCount - Count of outliers detected
 * @param {string|null} props.lastComputed - ISO timestamp of last computation
 * @returns {JSX.Element} Stats row with two metric cards
 */
function QuickStatsRow({ outlierCount, lastComputed }: { outlierCount?: number | null; lastComputed?: string | null }) {
  return (
    <div className="grid grid-cols-2 gap-3 mt-4">
      <div className="rounded border border-border-subtle bg-surface p-3 text-center">
        <div className="text-xs text-content-muted uppercase mb-1">Outliers</div>
        <div className="text-lg font-semibold text-danger">
          {outlierCount ?? '--'}
        </div>
      </div>
      <div className="rounded border border-border-subtle bg-surface p-3 text-center">
        <div className="text-xs text-content-muted uppercase mb-1">Last Computed</div>
        <div className="text-sm font-medium text-content-secondary">
          {lastComputed ? formatRelativeTime(lastComputed) : '--'}
        </div>
      </div>
    </div>
  );
}


interface OverviewPanelProps {
  autoRefresh?: boolean;
}

/**
 * @description Main overview panel component for the Semantic Identity Monitor
 *
 * Provides a comprehensive view of basin metrics with:
 * - Header with refresh and compute buttons
 * - BasinMetricsCard for detailed metrics visualization
 * - Quick stats row for at-a-glance information
 *
 * @upstream Called by: SemanticMonitorTab/index.jsx
 * @downstream Calls: useSIMData, BasinMetricsCard, QuickStatsRow, Icon
 *
 * @param {Object} props - Component props
 * @param {boolean} [props.autoRefresh=true] - Whether to fetch data on mount
 * @returns {JSX.Element} The overview panel
 *
 * @example
 * function SemanticMonitorTab() {
 *   return (
 *     <div className="grid grid-cols-2 gap-4">
 *       <OverviewPanel />
 *       <TrajectoryView />
 *     </div>
 *   );
 * }
 */
export function OverviewPanel({ autoRefresh = true }: OverviewPanelProps) {
  const {
    basin,
    loading,
    error,
    hasBasinData,
    refresh,
    computeBasin,
    anomalies,
    fetchAnomalies,
    weekly,
    weeklyType,
    weeklyLoading,
    fetchWeeklyBasin,
  } = useSIMData();

  const personaName = usePersonaName();

  /**
   * Human titles for the three voices — the machine type stays visible as
   * muted subtext (the honest data-contract name, demoted not hidden).
   * Persona-name-aware: titles follow the active persona, never a
   * hardcoded name.
   */
  const voiceTitles: Record<string, string> = {
    thought: `${personaName}'s thoughts`,
    message_to_user: `${personaName}'s voice out`,
    user_message: 'your voice in',
  };

  // Auto-fetch on mount if enabled
  useEffect(() => {
    if (autoRefresh) {
      refresh();
    }
  }, [autoRefresh, refresh]);

  // Weekly drift buckets (inner voice) + anomaly flags always load on mount:
  // both are cheap cached reads and feed sections of this panel directly.
  useEffect(() => {
    void fetchWeeklyBasin('thought');
    void fetchAnomalies();
  }, [fetchWeeklyBasin, fetchAnomalies]);

  /**
   * @description Handle refresh button click
   * Fetches latest basin metrics from the server
   */
  const handleRefresh = async () => {
    await refresh();
  };

  /**
   * @description Handle compute button click
   * Triggers full basin recomputation on the server
   */
  const handleCompute = async () => {
    await computeBasin();
    // Refresh to get updated metrics after compute
    await refresh();
  };

  // Extract quick stats from basin data. GET /sim/basin carries no outlier
  // count — the flags live in /sim/anomalies — so the tile counts those rows.
  // (Sample count is BasinMetricsCard's tile; not repeated here.)
  const outlierCount = basin?.outlierCount ?? anomalies.length;
  const lastComputed = basin?.global?.computedAt ?? null;

  return (
    <div className="space-y-4">
      {/* Header with actions */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-content-primary">
          Basin Overview
        </h2>
        <div className="flex items-center gap-2">
          <button
            onClick={handleRefresh}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium
                       rounded border border-border-subtle bg-surface
                       text-content-secondary hover:bg-surface
                       disabled:opacity-50 disabled:cursor-not-allowed
                       transition-colors"
            title="Refresh basin metrics"
          >
            <Icon
              name="RefreshCw"
              size={14}
              className={loading ? 'animate-spin' : ''}
            />
            Refresh
          </button>
          <button
            onClick={handleCompute}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium
                       rounded border border-accent/50 bg-accent/10
                       text-accent hover:bg-accent/20
                       disabled:opacity-50 disabled:cursor-not-allowed
                       transition-colors"
            title="Recompute basin metrics from all embeddings"
          >
            <Icon name="Zap" size={14} />
            Compute
          </button>
        </div>
      </div>

      {/* Main basin metrics card */}
      <BasinMetricsCard
        basinData={basin}
        loading={loading}
        error={error}
        onRecompute={handleCompute}
      />

      {/* Quick stats - only show when we have data */}
      {hasBasinData && (
        <QuickStatsRow outlierCount={outlierCount} lastComputed={lastComputed} />
      )}

      {/* Three-voices basins — GET /sim/basin perType + crossType */}
      <div className="mt-4">
        <h3 className="text-sm font-semibold mb-2 text-content-primary">Three Voices (per-type basins)</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {['thought', 'message_to_user', 'user_message'].map((type) => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const typeData = ((basin as any)?.perType as Record<string, unknown> | undefined) || ((basin as any)?.typeBasinReference as Record<string, unknown> | undefined) || {};
            const v = (typeData[type] as Record<string, unknown>) || {};
            // Cross-type pair keys are `a<->b` strings (computeCrossTypeCentroidDistances);
            // each card shows the mean centroid distance to the other voices.
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const crossPairs = (((basin as any)?.crossType as Record<string, unknown>)?.pairs as Record<string, unknown>) || {};
            const pairsInvolving = Object.entries(crossPairs).filter(
              ([pairKey, pairValue]) =>
                pairKey.split('<->').includes(type) && typeof pairValue === 'number',
            ) as Array<[string, number]>;
            const crossMean = pairsInvolving.length
              ? pairsInvolving.reduce((sum, [, value]) => sum + value, 0) / pairsInvolving.length
              : null;
            return (
              <div key={type} className="rounded border border-border-subtle bg-surface p-3 min-h-[44px]">
                <div className="text-sm font-medium text-content-primary">{voiceTitles[type] ?? type}</div>
                <div className="text-[10px] font-mono text-content-muted mb-1">{type}</div>
                <div className="text-base font-semibold">{((v.meanDistance ?? v.mean ?? 0) as number).toFixed(3)} mean dist</div>
                <div className="text-xs">{(v.sampleCount ?? v.count ?? '--') as unknown as string} samples</div>
                <div
                  className="text-xs mt-1 text-content-muted"
                  title={pairsInvolving.map(([pairKey, value]) => `${pairKey}: ${value}`).join('\n')}
                >
                  cross-dist: {crossMean === null ? '--' : crossMean.toFixed(3)}
                </div>
              </div>
            );
          })}
        </div>
        <div className="text-xs text-content-muted mt-1">
          Mean distance of each voice from its own centroid; cross-dist averages that voice&apos;s centroid distance to the other two.
        </div>
      </div>

      {/* Weekly drift — GET /sim/basin/weekly buckets for the inner voice */}
      <div className="mt-4">
        <h3 className="text-sm font-semibold mb-2 text-content-primary">Weekly Drift</h3>
        {weekly.length > 0 ? (
          <>
            <div className="flex items-end gap-2 h-24">
              {weekly.map((bucket) => {
                const maxRate = Math.max(...weekly.map((b) => b.outlierRate), 0.001);
                const ratePct = Math.round(bucket.outlierRate * 100);
                const barHeight = Math.max(6, Math.round((bucket.outlierRate / maxRate) * 64));
                return (
                  <div
                    key={bucket.week}
                    className="flex-1 flex flex-col items-center justify-end gap-1 min-w-0"
                    title={`${bucket.week} — outlier rate ${ratePct}%, mean dist ${bucket.meanDistFromGlobal}, n=${bucket.n}`}
                  >
                    <div className="text-[10px] text-content-secondary">{ratePct}%</div>
                    {/* Inline token fill, NOT a Tailwind opacity-modifier class:
                        bg-accent/70 silently compiles to nothing here (accent is
                        a plain var() color — no alpha channel to modify), which
                        rendered floating labels with invisible bars on phones.
                        Guaranteed min height/width so nonzero weeks always read
                        as bars at 390px. */}
                    <div
                      className="w-full max-w-10 rounded-t"
                      style={{
                        height: `${barHeight}px`,
                        minHeight: '6px',
                        minWidth: '12px',
                        backgroundColor: 'var(--accent)',
                      }}
                    />
                    <div className="text-[10px] text-content-muted truncate w-full text-center">
                      {bucket.week.slice(5)}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="text-xs text-content-muted mt-1">
              Outlier rate per ISO week ({weeklyType}) — a falling rate is the persona settling into its own basin.
            </div>
          </>
        ) : (
          <div className="text-xs text-content-muted">
            {weeklyLoading
              ? 'Loading weekly buckets…'
              : 'Weekly buckets appear once a voice has enough embedded history (10+ entries).'}
          </div>
        )}
      </div>

      {/* Empty state hint */}
      {!hasBasinData && !loading && !error && (
        <div className="text-center py-4">
          <p className="text-sm text-content-muted">
            Click <span className="font-medium">Compute</span> to initialize the semantic basin
          </p>
        </div>
      )}
    </div>
  );
}


export default OverviewPanel;
