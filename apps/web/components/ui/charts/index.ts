/**
 * @module ui/charts
 * @description Barrel export for chart components built on Plotly.js.
 *
 * This module exports reusable chart components that provide interactive
 * visualizations with consistent theming across the application. All charts
 * are built on react-plotly.js with dark theme styling.
 *
 * @upstream Called by:
 *   - SemanticMonitorTab views (TrajectoryView, DirectionalityExplorer)
 *   - Any component needing data visualization
 * @downstream Calls:
 *   - Individual chart component modules
 *   - react-plotly.js for rendering
 *
 * Components exported:
 * - PlotlyChart: Base wrapper with theming, resize handling, and events
 * - TimeSeriesChart: 2D line/scatter for temporal data (trajectory)
 * - ProjectionChart: 1D horizontal projection for directionality
 * - ChartDetailPanel: Side panel for viewing selected point content
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

export { PlotlyChart, PLOTLY_THEME } from './PlotlyChart';
export { TimeSeriesChart } from './TimeSeriesChart';
export { ProjectionChart } from './ProjectionChart';
export { ChartDetailPanel } from './ChartDetailPanel';
