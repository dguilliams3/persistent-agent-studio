/**
 * Trajectory View for Semantic Identity Monitor
 *
 * @module tabs/SemanticMonitorTab/views/TrajectoryView
 * @description Time-series visualization of embedding distances from the semantic basin centroid.
 * Uses interactive Plotly charts with a side panel for viewing full entry content.
 *
 * This view renders a scatter/line chart showing how Clio's entries drift relative to her
 * established semantic identity. Each point represents an embedded entry, with:
 * - X-axis: Time (timestamps)
 * - Y-axis: Distance from centroid
 * - Point colors: Z-score severity (green/amber/red)
 * - Reference lines: Mean and ±2σ thresholds (adaptive to filtered data)
 * - Side panel: Full content on point click
 *
 * @upstream Called by:
 *   - SemanticMonitorTab/index.jsx - Main tab component
 * @downstream Calls:
 *   - ../../../ui/charts/TimeSeriesChart.jsx - Plotly time series
 *   - ../../../ui/charts/ChartDetailPanel.jsx - Side panel
 *   - ../../../ui/TypeFilterDropdown.jsx - Multi-select filter
 *   - ../hooks/useSIMData.js - Data access and actions
 *   - ../../../ui/Icon.jsx - Lucide icons
 */

import { useEffect, useState, useCallback, useMemo } from 'react';
import { Icon, TypeFilterDropdown } from '../../../ui';
import { TimeSeriesChart, ChartDetailPanel } from '../../../ui/charts';
import { useSIMData } from '../hooks/useSIMData';
import { Z_SCORE_COLORS } from '../utils/colorScales';

/**
 * Entry type filter options with Lucide icons
 * art_result/user_art excluded (base64 images not embedded)
 */
const ENTRY_TYPE_OPTIONS = [
  { value: 'thought', label: 'Thoughts', icon: 'MessageCircle' },
  { value: 'message_to_user', label: 'Messages to User', icon: 'Send' },
  { value: 'user_message', label: 'Messages from User', icon: 'User' },
  { value: 'search_query', label: 'Search Queries', icon: 'Search' },
  { value: 'search_result', label: 'Search Results', icon: 'FileText' },
  { value: 'art_request', label: 'Art Requests', icon: 'Palette' },
  { value: 'curiosity', label: 'Curiosities', icon: 'HelpCircle' },
  { value: 'cold_storage', label: 'Cold Storage', icon: 'Snowflake' },
  { value: 'note_saved', label: 'Notes Saved', icon: 'BookOpen' },
];

/**
 * Limit options for trajectory query
 */
const LIMIT_OPTIONS = [
  { value: 50, label: 'Last 50' },
  { value: 100, label: 'Last 100' },
  { value: 200, label: 'Last 200' },
  { value: 500, label: 'Last 500' },
];

interface TrajectoryViewProps {
  autoFetch?: boolean;
}

/**
 * @description Main trajectory view component for the Semantic Identity Monitor
 *
 * Displays an interactive Plotly chart of embedding distances with:
 * - Professional dropdown filter for entry types with checkboxes
 * - Adaptive reference lines based on filtered data
 * - Click-to-select points with side panel details
 *
 * @upstream Called by: SemanticMonitorTab/index.jsx
 * @downstream Calls: useSIMData, TimeSeriesChart, ChartDetailPanel, TypeFilterDropdown, Icon
 *
 * @param {Object} props - Component props
 * @param {boolean} [props.autoFetch=false] - Whether to fetch trajectory on mount
 * @returns {JSX.Element} The trajectory view
 */
export function TrajectoryView({ autoFetch = false }: TrajectoryViewProps) {
  const {
    trajectory,
    loading,
    error,
    fetchTrajectory,
  } = useSIMData();

  // Filter state: null = all types, [] = none, [...] = specific selection
  const [selectedTypes, setSelectedTypes] = useState<string[] | null>(null);
  const [limit, setLimit] = useState(100);

  // Selected point for detail panel
  const [selectedPoint, setSelectedPoint] = useState<any>(null);

  // Fetch trajectory when filters change or on mount
  useEffect(() => {
    if (autoFetch || selectedTypes !== null || limit !== 100) {
      const entryTypes = selectedTypes && selectedTypes.length > 0
        ? selectedTypes.join(',')
        : undefined;
      fetchTrajectory({ limit, entryTypes });
    }
  }, [autoFetch, selectedTypes, limit, fetchTrajectory]);

  /**
   * @description Handle manual fetch button click
   */
  const handleFetch = useCallback(() => {
    const entryTypes = selectedTypes && selectedTypes.length > 0
      ? selectedTypes.join(',')
      : undefined;
    fetchTrajectory({ limit, entryTypes });
  }, [fetchTrajectory, limit, selectedTypes]);

  /**
   * @description Handle point click to show detail panel
   */
  const handlePointClick = useCallback((pointData: any) => {
    setSelectedPoint(pointData);
  }, []);

  /**
   * @description Close detail panel
   */
  const handleClosePanel = useCallback(() => {
    setSelectedPoint(null);
  }, []);

  /**
   * @description Transform trajectory data to chart format
   * Note: We store the raw distance value here; z-scores are recalculated below
   */
  const rawPoints = useMemo(() => {
    if (!trajectory || trajectory.length === 0) return [];

    return trajectory.map((p) => ({
      id: p.id,
      timestamp: p.timestamp,
      value: p.distance,
      type: p.type,
      table: p.table,
      content: p.content,
    }));
  }, [trajectory]);

  /**
   * @description Compute type counts from trajectory data
   */
  const typeCounts = useMemo(() => {
    if (!trajectory || trajectory.length === 0) return {};

    return trajectory.reduce((acc: Record<string, number>, p: any) => {
      const type = p.type || 'unknown';
      acc[type] = (acc[type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
  }, [trajectory]);

  /**
   * @description Compute filtered metrics (mean, stdDev) from displayed data
   * These adapt to what's actually being shown, not global basin metrics
   */
  const filteredMetrics = useMemo(() => {
    if (!rawPoints || rawPoints.length < 2) {
      return { mean: null, stdDev: null, threshold: null };
    }

    const values = rawPoints.map((p) => p.value);
    const n = values.length;
    const mean = values.reduce((a, b) => a + b, 0) / n;
    const variance = values.reduce((a, b) => a + (b - mean) ** 2, 0) / n;
    const stdDev = Math.sqrt(variance);

    return {
      mean,
      stdDev,
      threshold: mean + 2 * stdDev,
    };
  }, [rawPoints]);

  /**
   * @description Add recalculated z-scores to points based on filtered metrics
   * This ensures point colors match the reference lines shown
   */
  const chartPoints = useMemo(() => {
    if (!rawPoints || rawPoints.length === 0) return [];

    const { mean, stdDev } = filteredMetrics;

    // If we can't compute metrics, return points without z-scores
    if (mean === null || stdDev === null || stdDev === 0) {
      return rawPoints.map((p) => ({ ...p, zScore: 0 }));
    }

    // Recalculate z-scores relative to filtered data
    return rawPoints.map((p) => ({
      ...p,
      zScore: (p.value - mean) / stdDev,
    }));
  }, [rawPoints, filteredMetrics]);

  // Empty selection message
  const showEmptyMessage = selectedTypes !== null && selectedTypes.length === 0;

  return (
    <div className="space-y-3 h-full">
      {/* Header row */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-lg font-semibold text-content-primary">
          Identity Trajectory
        </h2>
        <div className="flex items-center gap-2">
          {/* Type filter dropdown */}
          <TypeFilterDropdown
            options={ENTRY_TYPE_OPTIONS}
            selected={selectedTypes}
            onChange={setSelectedTypes}
            counts={typeCounts}
            placeholder="All types"
          />

          {/* Limit filter - using inline style for bg since native select ignores Tailwind bg */}
          <select
            value={limit}
            onChange={(e) => setLimit(Number(e.target.value))}
            className="px-3 py-1.5 pr-8 text-sm rounded-md
                       border-2 border-border
                       text-content-primary
                       hover:border-border-subtle
                       focus:outline-none focus:ring-2 focus:ring-primary-500/50
                       transition-colors cursor-pointer shadow-md
                       appearance-none"
            style={{
              backgroundColor: 'rgb(55, 65, 81)',
              backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`,
              backgroundRepeat: 'no-repeat',
              backgroundPosition: 'right 8px center',
            }}
          >
            {LIMIT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value} style={{ backgroundColor: 'rgb(55, 65, 81)' }}>
                {opt.label}
              </option>
            ))}
          </select>

          {/* Fetch button */}
          <button
            onClick={handleFetch}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium
                       rounded-md border border-accent/50 bg-accent/20
                       text-accent-light hover:bg-accent/30
                       disabled:opacity-50 disabled:cursor-not-allowed
                       transition-colors"
            title="Load trajectory data"
          >
            <Icon
              name={loading ? 'Loader2' : 'RefreshCw'}
              size={14}
              className={loading ? 'animate-spin' : ''}
            />
            Load
          </button>
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="rounded border border-danger/50 bg-danger/10 p-3">
          <p className="text-sm text-danger">Failed to load trajectory: {error}</p>
        </div>
      )}

      {/* Empty selection message */}
      {showEmptyMessage && (
        <div className="rounded border border-amber-500/50 bg-amber-500/10 p-4 text-center">
          <Icon name="Filter" size={24} className="mx-auto text-amber-500 mb-2" />
          <p className="text-sm text-amber-500">
            No types selected. Use the filter dropdown to select entry types to display.
          </p>
        </div>
      )}

      {/* Chart container with side panel */}
      {!showEmptyMessage && (
        <div className="relative rounded-lg border border-border-subtle bg-surface overflow-hidden">
          {/* Main chart area */}
          <div className={`transition-all duration-200 ${selectedPoint ? 'mr-80' : ''}`}>
            <TimeSeriesChart
              points={chartPoints}
              threshold={filteredMetrics.threshold ?? undefined}
              mean={filteredMetrics.mean ?? undefined}
              stdDev={filteredMetrics.stdDev ?? undefined}
              showRangeSlider={true}
              yAxisLabel="Distance from Centroid"
              onPointClick={handlePointClick}
              selectedId={selectedPoint?.id}
              loading={loading}
              height={400}
            />
          </div>

          {/* Detail panel */}
          <ChartDetailPanel
            entry={selectedPoint}
            onClose={handleClosePanel}
            isOpen={!!selectedPoint}
          />

          {/* Legend */}
          <div className="flex items-center justify-center gap-4 py-3 border-t border-border-subtle text-xs text-content-muted">
            <div className="flex items-center gap-1.5">
              <span
                className="w-2.5 h-2.5 rounded-full"
                style={{ backgroundColor: Z_SCORE_COLORS.normal }}
              />
              <span>Normal (&lt;1σ)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span
                className="w-2.5 h-2.5 rounded-full"
                style={{ backgroundColor: Z_SCORE_COLORS.warning }}
              />
              <span>Warning (1-2σ)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span
                className="w-2.5 h-2.5 rounded-full"
                style={{ backgroundColor: Z_SCORE_COLORS.danger }}
              />
              <span>Outlier (&gt;2σ)</span>
            </div>
            <span className="text-content-muted">|</span>
            <span className="text-content-muted">Click point for details</span>
          </div>
        </div>
      )}

      {/* Stats summary */}
      {chartPoints.length > 0 && !showEmptyMessage && (
        <div className="text-sm text-content-muted text-center">
          Showing {chartPoints.length} point{chartPoints.length !== 1 ? 's' : ''}
          {filteredMetrics.mean !== null && (
            <span className="ml-2">
              (μ={filteredMetrics.mean.toFixed(3)}, σ={filteredMetrics.stdDev.toFixed(3)})
            </span>
          )}
        </div>
      )}
    </div>
  );
}


export default TrajectoryView;
