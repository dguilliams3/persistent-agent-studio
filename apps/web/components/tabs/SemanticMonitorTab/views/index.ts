/**
 * @module tabs/SemanticMonitorTab/views
 * @description Barrel export for Semantic Identity Monitor view components.
 *
 * View components are the primary visual panels of the SIM tab:
 * - OverviewPanel: Basin metrics summary with refresh/compute controls
 * - TrajectoryView: Time-series chart of embedding distances (Plotly TimeSeriesChart)
 * - DirectionalityExplorer: Searchable history browser for anchor selection + ProjectionChart
 * - StateCorrelationView: Placeholder for state-embedding correlation (Phase 3+)
 *
 * @upstream Called by: SemanticMonitorTab/index.jsx
 * @downstream Calls: Individual view modules
 *
 * @example
 * import { OverviewPanel, TrajectoryView, DirectionalityExplorer } from './views';
 *
 * function SemanticMonitorTab() {
 *   return (
 *     <div className="grid grid-cols-2 gap-4">
 *       <OverviewPanel autoRefresh={false} />
 *       <TrajectoryView autoFetch={false} />
 *       <DirectionalityExplorer trajectoryPoints={trajectory} loading={loading} />
 *       <StateCorrelationView />
 *     </div>
 *   );
 * }
 */

// =============================================================================
// OVERVIEW PANEL
// =============================================================================
// The OverviewPanel displays basin metrics at a glance:
// - Header with refresh/compute buttons
// - BasinMetricsCard showing distance, z-score, trend
// - Quick stats row: sample count, outliers, last computed time
//
// Uses useSIMData hook for data - no direct API calls.
// =============================================================================
export { OverviewPanel } from './OverviewPanel';

// =============================================================================
// TRAJECTORY VIEW
// =============================================================================
// The TrajectoryView renders a time-series line chart showing how
// embeddings drift from the semantic basin centroid over time.
//
// Features:
// - Custom SVG-based chart (no external charting library)
// - Interactive hover tooltips
// - Filter controls for entry type and result limit
// - Reference line at outlier threshold (2σ)
// - Color-coded points by z-score severity
//
// Uses useSIMData hook for trajectory data.
// =============================================================================
export { TrajectoryView } from './TrajectoryView';

// =============================================================================
// DIRECTIONALITY EXPLORER
// =============================================================================
// The DirectionalityExplorer provides a searchable/filterable history browser
// for selecting two "anchor" entries, computing the semantic direction vector
// between them, and projecting other entries along that axis.
//
// Features:
// - Searchable history list with text filter
// - TypeFilterDropdown for multi-select type filtering
// - Click-to-select anchor pattern (first click = A, second = B)
// - Direction computation via POST /sim/direction/compute
// - ProjectionChart visualization of results
// - ChartDetailPanel for viewing full entry content
// =============================================================================
export { DirectionalityExplorer } from './DirectionalityExplorer';

// =============================================================================
// STATE CORRELATION VIEW
// =============================================================================
// Correlates activity types and meter states with semantic embedding position.
// Shows how different kinds of activity cluster in embedding space.
// =============================================================================
export { StateCorrelationView } from './StateCorrelationView';

// =============================================================================
// AXIS MANAGER
// =============================================================================
// CRUD interface for SIM concept axes. Researchers define measurement
// dimensions with positive and negative examples.
// =============================================================================
export { AxisManager } from './AxisManager';

// =============================================================================
// DATA EXPORT PANEL
// =============================================================================
// Export SIM data as JSON or CSV for external analysis in Python/R.
// Critical for publishability of research findings.
// =============================================================================
export { DataExportPanel } from './DataExportPanel';
