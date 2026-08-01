/**
 * Projection Chart Component
 *
 * @module ui/charts/ProjectionChart
 * @description 1D horizontal projection chart for visualizing entries on a semantic axis.
 * Points are positioned along a -1 to +1 horizontal axis with vertical jitter to avoid overlap.
 *
 * Features:
 * - Horizontal axis from -1 (Anchor A) to +1 (Anchor B)
 * - Anchor labels at endpoints
 * - Vertical jitter for point separation
 * - Color by projection value (amber for negative, cyan for positive)
 * - Click-to-select point highlighting
 * - Hover shows entry preview
 *
 * @upstream Called by:
 *   - SemanticMonitorTab/views/DirectionalityExplorer.jsx - Main consumer
 * @downstream Calls:
 *   - ./PlotlyChart.jsx - Base chart wrapper
 */

import { useMemo, useCallback } from 'react';
import { PlotlyChart, PLOTLY_THEME } from './PlotlyChart';

/**
 * Color scale for projection values
 */
const PROJECTION_COLORS = {
  negative: '#f59e0b', // amber-500 (closer to Anchor A)
  neutral: '#94a3b8',  // content-secondary (near center)
  positive: '#22d3ee', // cyan-400 (closer to Anchor B)
};

/**
 * @description Get color for a projection value
 *
 * @param {number} projection - Projection value (-1 to +1)
 * @returns {string} Hex color code
 */
function getProjectionColor(projection: any) {
  if (projection < -0.3) return PROJECTION_COLORS.negative;
  if (projection > 0.3) return PROJECTION_COLORS.positive;
  return PROJECTION_COLORS.neutral;
}

/**
 * @description Generate deterministic jitter for y-position based on index
 *
 * @param {number} index - Point index
 * @param {number} total - Total number of points
 * @returns {number} Y position with jitter (0 to 1 range)
 */
function getJitteredY(index: any, total: any) {
  // Use sine wave for more organic distribution
  const baseY = 0.5;
  const amplitude = 0.35;
  // Create multiple rows based on proximity of x values
  const row = index % 3;
  const offset = (row - 1) * amplitude;
  return baseY + offset + (Math.sin(index * 2.7) * amplitude * 0.3);
}

interface ProjectionChartProps {
  points?: Array<{
    id: number | string;
    projection: number;
    content?: string;
    type?: string;
    table?: string;
    timestamp?: string;
  }>;
  anchorA?: { label?: string };
  anchorB?: { label?: string };
  onPointClick?: (pointData: Record<string, unknown>) => void;
  selectedId?: number | string | null;
  loading?: boolean;
  height?: number;
}

/**
 * @description 1D projection chart for directionality visualization
 *
 * @param {Object} props - Component props
 * @param {Array} props.points - Array of projected points
 * @param {string|number} props.points[].id - Unique point identifier
 * @param {number} props.points[].projection - Projection value (-1 to +1)
 * @param {string} [props.points[].content] - Entry content
 * @param {string} [props.points[].type] - Entry type
 * @param {string} [props.points[].table] - Source table
 * @param {string} [props.points[].timestamp] - ISO timestamp
 * @param {Object} [props.anchorA] - Left anchor configuration
 * @param {string} [props.anchorA.label='Anchor A'] - Label for left anchor
 * @param {Object} [props.anchorB] - Right anchor configuration
 * @param {string} [props.anchorB.label='Anchor B'] - Label for right anchor
 * @param {Function} [props.onPointClick] - Click handler, receives full point data
 * @param {string|number|null} [props.selectedId] - Currently selected point ID
 * @param {boolean} [props.loading=false] - Loading state
 * @param {number} [props.height=200] - Chart height in pixels
 * @returns {JSX.Element} Projection chart
 *
 * @example
 * <ProjectionChart
 *   points={projections}
 *   anchorA={{ label: 'Playful' }}
 *   anchorB={{ label: 'Serious' }}
 *   onPointClick={setSelectedPoint}
 *   selectedId={selectedPoint?.id}
 * />
 */
export function ProjectionChart({
  points,
  anchorA = { label: 'Anchor A' },
  anchorB = { label: 'Anchor B' },
  onPointClick,
  selectedId = null,
  loading = false,
  height = 200,
}: ProjectionChartProps) {
  /**
   * @description Transform points into Plotly trace format
   */
  const trace = useMemo(() => {
    if (!points || points.length === 0) {
      return null;
    }

    // Sort by projection for consistent ordering
    const sorted = [...points].sort((a, b) => a.projection - b.projection);

    // Generate colors based on projection values
    const colors = sorted.map((p) => getProjectionColor(p.projection));

    // Generate y positions with jitter
    const yPositions = sorted.map((p, i) => getJitteredY(i, sorted.length));

    // Generate sizes - larger for selected point
    const sizes = sorted.map((p) => (p.id === selectedId ? 16 : 10));

    // Generate outlines for selected point
    const lineWidths = sorted.map((p) => (p.id === selectedId ? 3 : 1));
    const lineColors = sorted.map((p) =>
      p.id === selectedId ? '#ffffff' : 'rgba(255,255,255,0.2)'
    );

    return {
      type: 'scatter',
      mode: 'markers',
      x: sorted.map((p) => p.projection),
      y: yPositions,
      customdata: sorted.map((p) => ({
        id: p.id,
        type: p.type,
        table: p.table,
        content: p.content,
        timestamp: p.timestamp,
        projection: p.projection,
      })),
      marker: {
        color: colors,
        size: sizes,
        line: {
          color: lineColors,
          width: lineWidths,
        },
        opacity: 0.85,
      },
      hoverinfo: 'text',
      hovertext: sorted.map((p) => {
        const projText = `${p.projection >= 0 ? '+' : ''}${p.projection.toFixed(3)}`;
        const preview = p.content
          ? p.content.slice(0, 60) + (p.content.length > 60 ? '...' : '')
          : '';
        return [
          `<b>${p.type || p.table || 'Entry'}</b> #${p.id}`,
          `Projection: ${projText}`,
          preview ? `<i>${preview}</i>` : '',
        ].filter(Boolean).join('<br>');
      }),
    };
  }, [points, selectedId]);

  /**
   * @description Create center line and endpoint markers
   */
  const shapes = useMemo(() => [
    // Center line (vertical at 0)
    {
      type: 'line',
      x0: 0,
      x1: 0,
      y0: 0,
      y1: 1,
      xref: 'x',
      yref: 'paper',
      line: {
        color: 'rgba(148,163,184,0.4)',
        width: 1,
        dash: 'dash',
      },
    },
    // Horizontal axis line
    {
      type: 'line',
      x0: -1,
      x1: 1,
      y0: 0.5,
      y1: 0.5,
      xref: 'x',
      yref: 'paper',
      line: {
        color: 'rgba(148,163,184,0.3)',
        width: 1,
      },
    },
  ], []);

  /**
   * @description Anchor label annotations
   */
  const annotations = useMemo(() => [
    // Left anchor label
    {
      x: -1,
      y: -0.15,
      xref: 'x',
      yref: 'paper',
      text: `← ${anchorA.label}`,
      showarrow: false,
      font: {
        color: PROJECTION_COLORS.negative,
        size: 11,
        weight: 600,
      },
      xanchor: 'left',
    },
    // Right anchor label
    {
      x: 1,
      y: -0.15,
      xref: 'x',
      yref: 'paper',
      text: `${anchorB.label} →`,
      showarrow: false,
      font: {
        color: PROJECTION_COLORS.positive,
        size: 11,
        weight: 600,
      },
      xanchor: 'right',
    },
    // Center label
    {
      x: 0,
      y: -0.15,
      xref: 'x',
      yref: 'paper',
      text: '0',
      showarrow: false,
      font: {
        color: 'rgba(148,163,184,0.6)',
        size: 10,
      },
      xanchor: 'center',
    },
  ], [anchorA.label, anchorB.label]);

  /**
   * @description Handle click event
   */
  const handleClick = useCallback(
    ({ point }: any) => {
      if (!onPointClick || !point.customdata) return;
      onPointClick(point.customdata);
    },
    [onPointClick]
  );

  // Layout configuration
  const layout = useMemo(
    () => ({
      xaxis: {
        ...PLOTLY_THEME.xaxis,
        range: [-1.15, 1.15],
        showgrid: false,
        zeroline: false,
        showticklabels: false,
        fixedrange: true,
      },
      yaxis: {
        ...PLOTLY_THEME.yaxis,
        range: [0, 1],
        showgrid: false,
        zeroline: false,
        showticklabels: false,
        fixedrange: true,
      },
      shapes,
      annotations,
      hovermode: 'closest',
      dragmode: false, // Disable panning for this chart
      margin: {
        l: 20,
        r: 20,
        t: 20,
        b: 40,
      },
    }),
    [shapes, annotations]
  );

  // Config - disable zoom/pan controls for this simple chart
  const config = useMemo(() => ({
    displayModeBar: false,
    staticPlot: false, // Allow hover, but no zoom/pan
  }), []);

  // Empty state
  if (!trace) {
    return (
      <div
        className="flex items-center justify-center rounded-lg border border-border-subtle bg-surface text-content-muted"
        style={{ height }}
      >
        <p className="text-sm">No projection data available</p>
      </div>
    );
  }

  return (
    <PlotlyChart
      data={[trace]}
      layout={layout}
      config={config}
      onClick={handleClick}
      loading={loading}
      height={height}
      className="rounded-lg border border-border-subtle"
    />
  );
}


export default ProjectionChart;
