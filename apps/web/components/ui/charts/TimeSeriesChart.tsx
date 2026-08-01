/**
 * Time Series Chart Component
 *
 * @module ui/charts/TimeSeriesChart
 * @description Interactive 2D scatter/line chart for temporal data visualization.
 * Designed for the trajectory view showing embedding distances over time.
 *
 * Features:
 * - X-axis: Timestamps (auto-formatted by Plotly)
 * - Y-axis: Configurable metric (distance, z-score, etc.)
 * - Points colored by category (z-score severity)
 * - Optional threshold reference line
 * - Click-to-select point highlighting
 * - Responsive sizing
 *
 * @upstream Called by:
 *   - SemanticMonitorTab/views/TrajectoryView.jsx - Main consumer
 * @downstream Calls:
 *   - ./PlotlyChart.jsx - Base chart wrapper
 *   - ../../../tabs/SemanticMonitorTab/utils/colorScales.js - Z-score colors
 */

import { useMemo, useCallback } from 'react';
import { PlotlyChart, PLOTLY_THEME } from './PlotlyChart';

/**
 * Z-score to color mapping (matches existing colorScales.js)
 */
const Z_SCORE_COLORS = {
  normal: '#10b981',  // emerald-500 (< 1σ)
  warning: '#f59e0b', // amber-500 (1-2σ)
  danger: '#ef4444',  // red-500 (> 2σ)
};

/**
 * @description Get color for a z-score value
 *
 * @param {number|null} zScore - Z-score value
 * @returns {string} Hex color code
 */
function getZScoreColor(zScore: any) {
  if (zScore == null) return Z_SCORE_COLORS.normal;
  const absZ = Math.abs(zScore);
  if (absZ >= 2) return Z_SCORE_COLORS.danger;
  if (absZ >= 1) return Z_SCORE_COLORS.warning;
  return Z_SCORE_COLORS.normal;
}

interface TimeSeriesChartProps {
  points?: Array<{
    id: number | string;
    timestamp: string;
    value: number;
    zScore?: number;
    type?: string;
    table?: string;
    content?: string;
  }>;
  threshold?: number;
  mean?: number;
  stdDev?: number;
  showRangeSlider?: boolean;
  yAxisLabel?: string;
  onPointClick?: (pointData: Record<string, unknown>) => void;
  selectedId?: number | string | null;
  loading?: boolean;
  height?: number;
}

/**
 * @description Time series chart component for trajectory visualization
 *
 * @param {Object} props - Component props
 * @param {Array} props.points - Array of data points
 * @param {string|number} props.points[].id - Unique point identifier
 * @param {string} props.points[].timestamp - ISO timestamp
 * @param {number} props.points[].value - Y-axis value (e.g., distance)
 * @param {number} [props.points[].zScore] - Optional z-score for coloring
 * @param {string} [props.points[].type] - Entry type for metadata
 * @param {string} [props.points[].table] - Source table for metadata
 * @param {string} [props.points[].content] - Entry content for detail panel
 * @param {number} [props.threshold] - Optional upper threshold line (2σ above mean)
 * @param {number} [props.mean] - Optional mean value for reference line
 * @param {number} [props.stdDev] - Optional standard deviation (used to compute lower threshold)
 * @param {boolean} [props.showRangeSlider=true] - Show Plotly range slider for time axis
 * @param {string} [props.yAxisLabel='Value'] - Label for Y-axis
 * @param {Function} [props.onPointClick] - Click handler, receives full point data
 * @param {string|number|null} [props.selectedId] - Currently selected point ID for highlighting
 * @param {boolean} [props.loading=false] - Loading state
 * @param {number} [props.height=320] - Chart height in pixels
 * @returns {JSX.Element} Time series chart
 *
 * @example
 * <TimeSeriesChart
 *   points={trajectoryData.map(p => ({
 *     id: p.id,
 *     timestamp: p.timestamp,
 *     value: p.distance,
 *     zScore: p.zScore,
 *     content: p.content,
 *   }))}
 *   threshold={basin?.outlierThreshold}
 *   yAxisLabel="Distance from Centroid"
 *   onPointClick={setSelectedPoint}
 *   selectedId={selectedPoint?.id}
 * />
 */
export function TimeSeriesChart({
  points,
  threshold,
  mean,
  stdDev,
  showRangeSlider = true,
  yAxisLabel = 'Value',
  onPointClick,
  selectedId = null,
  loading = false,
  height = 320,
}: TimeSeriesChartProps) {
  // Compute lower threshold if we have mean and stdDev
  const lowerThreshold = (mean != null && stdDev != null) ? Math.max(0, mean - 2 * stdDev) : null;
  /**
   * @description Transform points into Plotly trace format
   */
  const trace = useMemo(() => {
    if (!points || points.length === 0) {
      return null;
    }

    // Sort by timestamp for proper line rendering
    const sorted = [...points].sort(
      (a: any, b: any) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    // Generate colors array based on z-scores
    const colors = sorted.map((p) => getZScoreColor(p.zScore));

    // Generate sizes - larger for selected point
    const sizes = sorted.map((p) => (p.id === selectedId ? 14 : 10));

    // Generate line widths for selected point outline
    const lineWidths = sorted.map((p) => (p.id === selectedId ? 3 : 1));
    const lineColors = sorted.map((p) =>
      p.id === selectedId ? '#ffffff' : 'rgba(255,255,255,0.3)'
    );

    return {
      type: 'scatter',
      mode: 'lines+markers',
      x: sorted.map((p) => p.timestamp),
      y: sorted.map((p) => p.value),
      customdata: sorted.map((p) => ({
        id: p.id,
        type: p.type,
        table: p.table,
        content: p.content,
        timestamp: p.timestamp,
        distance: p.value,
        zScore: p.zScore,
      })),
      marker: {
        color: colors,
        size: sizes,
        line: {
          color: lineColors,
          width: lineWidths,
        },
      },
      line: {
        color: 'rgba(16,185,129,0.4)', // emerald with opacity
        width: 2,
      },
      hoverinfo: 'text',
      hovertext: sorted.map((p) => {
        const zText = p.zScore != null
          ? `Z: ${p.zScore >= 0 ? '+' : ''}${p.zScore.toFixed(2)}σ`
          : '';
        const preview = p.content
          ? p.content.slice(0, 60) + (p.content.length > 60 ? '...' : '')
          : '';
        return [
          `<b>${p.type || p.table || 'Entry'}</b> #${p.id}`,
          `Value: ${p.value.toFixed(4)}`,
          zText,
          preview ? `<i>${preview}</i>` : '',
        ].filter(Boolean).join('<br>');
      }),
    };
  }, [points, selectedId]);

  /**
   * @description Create reference line shapes (mean, upper threshold, lower threshold)
   */
  const shapes = useMemo(() => {
    const result = [];

    // Mean line (solid cyan)
    if (mean != null) {
      result.push({
        type: 'line',
        x0: 0,
        x1: 1,
        xref: 'paper',
        y0: mean,
        y1: mean,
        line: {
          color: '#22d3ee', // cyan-400
          width: 2,
        },
      });
    }

    // Upper threshold (+2σ, dashed red)
    if (threshold != null) {
      result.push({
        type: 'line',
        x0: 0,
        x1: 1,
        xref: 'paper',
        y0: threshold,
        y1: threshold,
        line: {
          color: Z_SCORE_COLORS.danger,
          width: 2,
          dash: 'dash',
        },
      });
    }

    // Lower threshold (-2σ, dashed red) - only show if above 0
    if (lowerThreshold != null && lowerThreshold > 0) {
      result.push({
        type: 'line',
        x0: 0,
        x1: 1,
        xref: 'paper',
        y0: lowerThreshold,
        y1: lowerThreshold,
        line: {
          color: Z_SCORE_COLORS.danger,
          width: 2,
          dash: 'dash',
        },
      });
    }

    return result;
  }, [threshold, mean, lowerThreshold]);

  /**
   * @description Create annotations for reference lines
   */
  const annotations = useMemo(() => {
    const result = [];

    // Mean annotation
    if (mean != null) {
      result.push({
        x: 1,
        xref: 'paper',
        y: mean,
        text: 'mean',
        showarrow: false,
        xanchor: 'left',
        font: {
          color: '#22d3ee', // cyan-400
          size: 10,
        },
      });
    }

    // Upper threshold annotation
    if (threshold != null) {
      result.push({
        x: 1,
        xref: 'paper',
        y: threshold,
        text: '+2σ',
        showarrow: false,
        xanchor: 'left',
        font: {
          color: Z_SCORE_COLORS.danger,
          size: 10,
        },
      });
    }

    // Lower threshold annotation
    if (lowerThreshold != null && lowerThreshold > 0) {
      result.push({
        x: 1,
        xref: 'paper',
        y: lowerThreshold,
        text: '-2σ',
        showarrow: false,
        xanchor: 'left',
        font: {
          color: Z_SCORE_COLORS.danger,
          size: 10,
        },
      });
    }

    return result;
  }, [threshold, mean, lowerThreshold]);

  /**
   * @description Handle click event and extract point data
   */
  const handleClick = useCallback(
    ({ point }: any) => {
      if (!onPointClick || !point.customdata) return;

      // Pass the full point data to the handler
      onPointClick(point.customdata);
    },
    [onPointClick]
  );

  // Layout configuration
  const layout = useMemo(
    () => ({
      xaxis: {
        ...PLOTLY_THEME.xaxis,
        title: {
          text: 'Time',
          font: { size: 11, color: '#94a3b8' },
        },
        tickformat: '%b %d',
        hoverformat: '%b %d, %Y %H:%M',
        // Range slider for time selection
        rangeslider: showRangeSlider ? {
          visible: true,
          bgcolor: 'rgba(0,0,0,0.2)',
          bordercolor: 'rgba(148,163,184,0.3)',
          thickness: 0.08,
        } : { visible: false },
        // Quick range selector buttons
        rangeselector: showRangeSlider ? {
          buttons: [
            { count: 1, label: '1d', step: 'day', stepmode: 'backward' },
            { count: 3, label: '3d', step: 'day', stepmode: 'backward' },
            { count: 7, label: '1w', step: 'day', stepmode: 'backward' },
            { step: 'all', label: 'All' }
          ],
          bgcolor: 'rgba(30,41,59,0.9)',
          activecolor: 'rgba(34,211,238,0.3)',
          bordercolor: 'rgba(148,163,184,0.3)',
          font: { color: '#94a3b8', size: 10 },
          x: 0,
          y: 1.12,
        } : undefined,
      },
      yaxis: {
        ...PLOTLY_THEME.yaxis,
        title: {
          text: yAxisLabel,
          font: { size: 11, color: '#94a3b8' },
        },
        rangemode: 'tozero',
      },
      shapes,
      annotations,
      hovermode: 'closest',
      dragmode: 'pan',
    }),
    [yAxisLabel, shapes, annotations, showRangeSlider]
  );

  // Empty state
  if (!trace) {
    return (
      <div
        className="flex items-center justify-center rounded-lg border border-border-subtle bg-surface text-content-muted"
        style={{ height }}
      >
        <p className="text-sm">No trajectory data available</p>
      </div>
    );
  }

  return (
    <PlotlyChart
      data={[trace]}
      layout={layout}
      onClick={handleClick}
      loading={loading}
      height={height}
      className="rounded-lg border border-border-subtle"
    />
  );
}


export default TimeSeriesChart;
