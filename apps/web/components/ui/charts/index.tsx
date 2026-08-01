/**
 * @module ui/charts
 * @description Barrel for chart components built on Plotly.js — lazy at the
 * module boundary so Plotly stays off the critical path.
 *
 * Plotly.js is multi-megabyte. Before RUN-20260731-1953 this barrel exported
 * the chart components eagerly AND components/ui/index.ts re-exported them,
 * so every visitor — chat-only included — downloaded Plotly in the main
 * chunk (~5.4 MB). Now:
 *
 * - TimeSeriesChart / ProjectionChart are React.lazy wrappers with a built-in
 *   Suspense fallback: the underlying modules (and Plotly with them) land in
 *   their own async chunk, fetched the first time a chart actually renders
 *   (SIM Trajectory / Directionality views).
 * - ChartDetailPanel stays eager — a plain side panel (Icon only, no Plotly).
 * - PlotlyChart / PLOTLY_THEME are intentionally NOT exported here: they are
 *   internal to the chart implementations. New chart modules should import
 *   them from './PlotlyChart' — a barrel export would drag Plotly back into
 *   every importer's chunk.
 *
 * @upstream Called by:
 *   - SemanticMonitorTab views (TrajectoryView, DirectionalityExplorer)
 * @downstream Calls:
 *   - Dynamic import() of chart component modules (the Plotly chunk)
 *   - ../Spinner for the loading fallback
 *
 * @example
 * import { TimeSeriesChart, ChartDetailPanel } from '../ui/charts';
 *
 * function TrajectoryView() {
 *   const [selected, setSelected] = useState(null);
 *   return (
 *     <div className="flex">
 *       <TimeSeriesChart points={data} onPointClick={setSelected} />
 *       <ChartDetailPanel entry={selected} onClose={() => setSelected(null)} />
 *     </div>
 *   );
 * }
 */

import { lazy, Suspense, type ComponentProps } from 'react';
import { Spinner } from '../Spinner';

const LazyTimeSeriesChart = lazy(() => import('./TimeSeriesChart'));
const LazyProjectionChart = lazy(() => import('./ProjectionChart'));

/**
 * @description Loading placeholder shown while the Plotly chunk downloads.
 * Matches the incoming chart's height so the layout doesn't jump, and uses
 * the design language's surface + accent Spinner (same pairing as
 * LoadingSkeleton's spinner variant). Spinner carries role="status" and
 * sr-only "Loading..." for accessibility.
 */
function ChartLoadingFallback({ height }: { height: number }) {
  return (
    <div className="flex items-center justify-center bg-surface" style={{ height }}>
      <Spinner size={28} />
    </div>
  );
}

/**
 * @description Lazy TimeSeriesChart — same props as the underlying component
 * (see ./TimeSeriesChart). Fallback height mirrors the component's own
 * default (320) unless a height prop is passed.
 */
export function TimeSeriesChart(props: ComponentProps<typeof LazyTimeSeriesChart>) {
  return (
    <Suspense fallback={<ChartLoadingFallback height={props.height ?? 320} />}>
      <LazyTimeSeriesChart {...props} />
    </Suspense>
  );
}

/**
 * @description Lazy ProjectionChart — same props as the underlying component
 * (see ./ProjectionChart). Fallback height mirrors the component's own
 * default (200) unless a height prop is passed.
 */
export function ProjectionChart(props: ComponentProps<typeof LazyProjectionChart>) {
  return (
    <Suspense fallback={<ChartLoadingFallback height={props.height ?? 200} />}>
      <LazyProjectionChart {...props} />
    </Suspense>
  );
}

export { ChartDetailPanel } from './ChartDetailPanel';
