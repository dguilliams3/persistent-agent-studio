/**
 * Overview Panel for Semantic Identity Monitor
 *
 * @module tabs/SemanticMonitorTab/views/OverviewPanel
 * @description Displays basin metrics summary with refresh controls and quick stats.
 *
 * This panel provides a high-level view of the semantic identity basin:
 * - Basin metrics card showing distance, z-score, trend
 * - Quick stats row: sample count, outlier count, last computed timestamp
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

/**
 * @description Quick stats summary row showing key basin metrics at a glance
 *
 * @param {Object} props - Component props
 * @param {number|null} props.sampleCount - Total embedded samples in basin
 * @param {number|null} props.outlierCount - Count of outliers detected
 * @param {string|null} props.lastComputed - ISO timestamp of last computation
 * @returns {JSX.Element} Stats row with three metric cards
 */
function QuickStatsRow({ sampleCount, outlierCount, lastComputed }: { sampleCount?: number | null; outlierCount?: number | null; lastComputed?: string | null }) {
  return (
    <div className="grid grid-cols-3 gap-3 mt-4">
      <div className="rounded border border-border-subtle bg-surface p-3 text-center">
        <div className="text-xs text-content-muted uppercase mb-1">Samples</div>
        <div className="text-lg font-semibold text-content-primary">
          {sampleCount ?? '--'}
        </div>
      </div>
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
  } = useSIMData();

  // Auto-fetch on mount if enabled
  useEffect(() => {
    if (autoRefresh) {
      refresh();
    }
  }, [autoRefresh, refresh]);

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

  // Extract quick stats from basin data
  const sampleCount = basin?.global?.sampleCount ?? null;
  const outlierCount = basin?.outlierCount ?? null;
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
        <QuickStatsRow
          sampleCount={sampleCount}
          outlierCount={outlierCount}
          lastComputed={lastComputed}
        />
      )}

      {/* B2: Three-voices basins - now from real backend (typeBasinReference / perType) */}
      <div className="mt-4">
        <h3 className="text-sm font-semibold mb-2 text-content-primary">Three Voices (per-type basins)</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {['thought', 'message_to_user', 'user_message'].map((type) => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const typeData = ((basin as any)?.typeBasinReference as Record<string, unknown> | undefined) || ((basin as any)?.perType as Record<string, unknown> | undefined) || {};
            const v = (typeData[type] as Record<string, unknown>) || {};
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const crossPairs = ((basin as any)?.crossType as Record<string, unknown>)?.pairs as Record<string, unknown> || {};
            const cross = crossPairs[type] ?? 0;
            return (
              <div key={type} className="rounded border border-border-subtle bg-surface p-3 min-h-[44px]">
                <div className="text-xs text-content-muted">{type}</div>
                <div className="text-base font-semibold">{((v.meanDistance ?? v.mean ?? 0) as number).toFixed(3)} mean dist</div>
                <div className="text-xs">{(v.sampleCount ?? v.count ?? '--') as unknown as string} samples</div>
                <div className="text-xs mt-1 text-content-muted">cross-dist: {cross}</div>
              </div>
            );
          })}
        </div>
        <div className="text-xs text-content-muted mt-1">From backend typeBasinReference / perType + crossType</div>
      </div>

      {/* B3: Weekly drift - real data from /sim/basin/weekly (no fixtures) */}
      <div className="mt-4">
        <h3 className="text-sm font-semibold mb-2 text-content-primary">Weekly Drift</h3>
        <div className="text-xs text-content-muted">Weekly buckets from backend /sim/basin/weekly (tappable outliers will open trajectory content in full integration). Current: real endpoint expected.</div>
        {/* TODO after full contract: render bars from fetched weekly data, tap uses real content */}
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
