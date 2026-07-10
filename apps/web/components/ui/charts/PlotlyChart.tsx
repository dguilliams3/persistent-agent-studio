/**
 * Base Plotly Chart Wrapper
 *
 * @module ui/charts/PlotlyChart
 * @description Base wrapper component for Plotly.js charts with consistent theming,
 * responsive sizing, and normalized event handling. This component serves as the
 * foundation for all chart types in the application.
 *
 * Features:
 * - Dark theme matching the application design system
 * - Automatic resize handling via useResizeObserver
 * - Loading state overlay
 * - Normalized click/hover events that return point data
 * - Configurable modebar (zoom, pan, reset, download)
 *
 * @upstream Called by:
 *   - TimeSeriesChart.jsx - For trajectory visualization
 *   - ProjectionChart.jsx - For directionality visualization
 *   - Any future chart components
 * @downstream Calls:
 *   - react-plotly.js - Core Plotly React binding
 *   - ../Icon.jsx - For loading spinner
 */

import { useRef, useEffect, useState, useCallback, useMemo } from 'react';
// @ts-ignore - no type declarations for react-plotly.js
import Plot from 'react-plotly.js';
import { Icon } from '../Icon';

/**
 * Dark theme configuration for Plotly charts
 * Matches application design system colors
 */
export const PLOTLY_THEME = {
  paper_bgcolor: 'transparent',
  plot_bgcolor: 'rgba(0,0,0,0.2)',
  font: {
    family: 'Inter, system-ui, sans-serif',
    color: '#94a3b8', // content-secondary
    size: 11,
  },
  // Grid styling
  xaxis: {
    gridcolor: 'rgba(148,163,184,0.1)',
    linecolor: 'rgba(148,163,184,0.2)',
    zerolinecolor: 'rgba(148,163,184,0.3)',
    tickfont: { color: '#94a3b8' },
  },
  yaxis: {
    gridcolor: 'rgba(148,163,184,0.1)',
    linecolor: 'rgba(148,163,184,0.2)',
    zerolinecolor: 'rgba(148,163,184,0.3)',
    tickfont: { color: '#94a3b8' },
  },
  // Hover styling
  hoverlabel: {
    bgcolor: 'rgba(30,41,59,0.95)', // surface-200
    bordercolor: 'rgba(148,163,184,0.3)',
    font: { color: '#e2e8f0', size: 12 }, // content-primary
  },
  // Legend styling
  legend: {
    bgcolor: 'transparent',
    font: { color: '#94a3b8' },
  },
  // Colorway for multiple traces
  colorway: [
    '#22d3ee', // cyan-400
    '#f59e0b', // amber-500
    '#10b981', // emerald-500
    '#ef4444', // red-500
    '#8b5cf6', // violet-500
    '#ec4899', // pink-500
  ],
};

/**
 * Default modebar configuration
 * Shows essential controls, hides less useful ones
 */
const DEFAULT_CONFIG = {
  displayModeBar: true,
  displaylogo: false,
  modeBarButtonsToRemove: [
    'select2d',
    'lasso2d',
    'autoScale2d',
    'hoverClosestCartesian',
    'hoverCompareCartesian',
    'toggleSpikelines',
  ],
  modeBarButtonsToAdd: [],
  responsive: true,
  scrollZoom: true,
};

interface PlotlyChartProps {
  data: Array<Record<string, unknown>>;
  layout?: Record<string, any>;
  config?: Record<string, any>;
  onClick?: (event: { point: Record<string, unknown>; points: unknown[]; event: unknown }) => void;
  onHover?: (event: { point: Record<string, unknown>; points: unknown[]; event: unknown }) => void;
  onUnhover?: () => void;
  loading?: boolean;
  className?: string;
  height?: number;
  useContainerHeight?: boolean;
}

/**
 * @description Base Plotly wrapper component with consistent theming and behavior
 *
 * @param {Object} props - Component props
 * @param {Array} props.data - Plotly data array (traces)
 * @param {Object} [props.layout={}] - Plotly layout config (merged with theme)
 * @param {Object} [props.config={}] - Plotly config (merged with defaults)
 * @param {Function} [props.onClick] - Click handler, receives {points, event}
 * @param {Function} [props.onHover] - Hover handler, receives {points, event}
 * @param {Function} [props.onUnhover] - Unhover handler
 * @param {boolean} [props.loading=false] - Show loading overlay
 * @param {string} [props.className=''] - Additional CSS classes for container
 * @param {number} [props.height] - Fixed height in pixels (optional)
 * @param {boolean} [props.useContainerHeight=false] - Fill container height
 * @returns {JSX.Element} Plotly chart with wrapper
 *
 * @example
 * <PlotlyChart
 *   data={[{ x: [1,2,3], y: [4,5,6], type: 'scatter', mode: 'markers' }]}
 *   layout={{ title: 'My Chart' }}
 *   onClick={({ points }) => console.log('Clicked:', points[0])}
 *   loading={isLoading}
 * />
 */
export function PlotlyChart({
  data,
  layout = {},
  config = {},
  onClick,
  onHover,
  onUnhover,
  loading = false,
  className = '',
  height,
  useContainerHeight = false,
}: PlotlyChartProps) {
  const containerRef = useRef(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  /**
   * @description Handle container resize via ResizeObserver
   */
  useEffect(() => {
    if (!containerRef.current) return;

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height: observedHeight } = entry.contentRect;
        setDimensions({
          width,
          height: useContainerHeight ? observedHeight : (height || 300),
        });
      }
    });

    resizeObserver.observe(containerRef.current);
    return () => resizeObserver.disconnect();
  }, [height, useContainerHeight]);

  /**
   * @description Merge theme with user layout
   */
  const mergedLayout = useMemo(() => ({
    ...PLOTLY_THEME,
    ...layout,
    width: dimensions.width || undefined,
    height: dimensions.height || height || 300,
    margin: {
      l: 50,
      r: 20,
      t: layout.title ? 40 : 20,
      b: 40,
      ...layout.margin,
    },
    xaxis: {
      ...PLOTLY_THEME.xaxis,
      ...layout.xaxis,
    },
    yaxis: {
      ...PLOTLY_THEME.yaxis,
      ...layout.yaxis,
    },
    hoverlabel: {
      ...PLOTLY_THEME.hoverlabel,
      ...layout.hoverlabel,
    },
  }), [layout, dimensions, height]);

  /**
   * @description Merge config with defaults
   */
  const mergedConfig = useMemo(() => ({
    ...DEFAULT_CONFIG,
    ...config,
  }), [config]);

  /**
   * @description Normalize click event and forward point data
   */
  const handleClick = useCallback((event: any) => {
    if (!onClick || !event.points || event.points.length === 0) return;

    // Extract the first clicked point with its custom data
    const point = event.points[0];
    const pointData = {
      x: point.x,
      y: point.y,
      pointIndex: point.pointIndex,
      curveNumber: point.curveNumber,
      // Include custom data if attached to point
      customdata: point.customdata,
      text: point.text,
      data: point.data,
    };

    onClick({ point: pointData, points: event.points, event });
  }, [onClick]);

  /**
   * @description Normalize hover event
   */
  const handleHover = useCallback((event: any) => {
    if (!onHover || !event.points || event.points.length === 0) return;

    const point = event.points[0];
    const pointData = {
      x: point.x,
      y: point.y,
      pointIndex: point.pointIndex,
      curveNumber: point.curveNumber,
      customdata: point.customdata,
      text: point.text,
    };

    onHover({ point: pointData, points: event.points, event });
  }, [onHover]);

  /**
   * @description Handle unhover
   */
  const handleUnhover = useCallback(() => {
    if (onUnhover) onUnhover();
  }, [onUnhover]);

  // Container style based on height mode
  const containerStyle = useContainerHeight
    ? { height: '100%', minHeight: 200 }
    : { height: height || 300 };

  return (
    <div
      ref={containerRef}
      className={`relative ${className}`}
      style={containerStyle}
    >
      {/* Loading overlay */}
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-surface/80 z-20 rounded">
          <Icon name="Loader2" size={24} className="animate-spin text-accent" />
        </div>
      )}

      {/* Render Plotly once we have dimensions */}
      {dimensions.width > 0 && (
        <Plot
          data={data}
          layout={mergedLayout}
          config={mergedConfig}
          onClick={handleClick}
          onHover={handleHover}
          onUnhover={handleUnhover}
          style={{ width: '100%', height: '100%' }}
          useResizeHandler
        />
      )}
    </div>
  );
}


export default PlotlyChart;
