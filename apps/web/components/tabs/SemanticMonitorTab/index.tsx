/**
 * Semantic Identity Monitor Tab
 *
 * @module components/tabs/SemanticMonitorTab
 * @description Main orchestrator for the Semantic Identity Monitor (SIM) feature.
 *
 * The SIM tab tracks Clio's semantic identity evolution through embedding space,
 * providing multiple viewing frames for understanding semantic movement:
 *
 * 1. **Overview** - Basin metrics, z-score, trend (BasinMetricsCard + quick stats)
 * 2. **Trajectory** - Time-series of semantic movement (TimeSeriesChart)
 * 3. **Directionality** - Explore directions between anchor pairs (ProjectionChart)
 * 4. **Correlation** - Self-reported states vs embeddings (Phase 3 placeholder)
 *
 * Uses tab-style sub-navigation to switch between views while maintaining
 * consistent header with refresh controls.
 *
 * @upstream Called by:
 *   - ClaudeExistenceLoop.jsx - Renders when activeTab === 'monitor'
 * @downstream Calls:
 *   - views/OverviewPanel.jsx - Basin metrics overview with compute button
 *   - views/TrajectoryView.jsx - Time-series visualization (Plotly TimeSeriesChart)
 *   - views/DirectionalityExplorer.jsx - Direction exploration with searchable history
 *   - views/StateCorrelationView.jsx - State correlation placeholder
 *   - hooks/useSIMData.js - Data access hook for basin/trajectory
 *   - ui/Icon - Lucide icons
 *
 * @example
 * // In ClaudeExistenceLoop.jsx
 * {activeTab === 'monitor' && <SemanticMonitorTab />}
 */

import { useState, useEffect, useCallback } from 'react';
import { Icon } from '../../ui';
import { useSIMData } from './hooks/useSIMData';
import {
  OverviewPanel,
  TrajectoryView,
  DirectionalityExplorer,
  StateCorrelationView,
  AxisManager,
  DataExportPanel,
} from './views';
import SyntheticMemory from './SyntheticMemory';
import './SemanticMonitorTab.css';

/**
 * View configuration for sub-navigation
 * Each view has an id, label, and icon (Lucide icon name)
 *
 * Views:
 * - overview: Basin metrics, z-score, trend (BasinMetricsCard + quick stats)
 * - trajectory: Time-series of semantic movement (TimeSeriesChart)
 * - directionality: Explore directions between anchor pairs (ProjectionChart)
 * - correlation: Self-reported states vs embeddings (Phase 3 placeholder)
 * - memory-lab: Synthetic memory injection for identity experimentation
 */
const VIEWS = [
  { id: 'overview', label: 'Overview', icon: 'BarChart3' },
  { id: 'trajectory', label: 'Trajectory', icon: 'TrendingUp' },
  { id: 'directionality', label: 'Directionality', icon: 'Compass' },
  { id: 'correlation', label: 'Correlation', icon: 'Activity' },
  { id: 'axes', label: 'Axes', icon: 'Ruler' },
  { id: 'export', label: 'Export', icon: 'Download' },
  { id: 'memory-lab', label: 'Memory Lab', icon: 'FlaskConical' },
];

/**
 * @description Main Semantic Identity Monitor tab component
 *
 * Orchestrates sub-views with a tabbed navigation pattern. Each view
 * represents a different semantic frame for understanding identity evolution.
 *
 * @upstream Called by: ClaudeExistenceLoop.jsx
 * @downstream Calls: OverviewPanel, TrajectoryView, DirectionalityExplorer, StateCorrelationView
 *
 * @returns {JSX.Element} The SIM tab UI
 */
export default function SemanticMonitorTab() {
  const [activeView, setActiveView] = useState('overview');
  const { basin, trajectory, loading, error, refresh, fetchTrajectory } = useSIMData();

  // Initial data fetch on mount
  useEffect(() => {
    refresh();
  }, [refresh]);

  // Fetch trajectory when switching to trajectory or directionality views
  useEffect(() => {
    if (activeView === 'trajectory' || activeView === 'directionality') {
      fetchTrajectory({ limit: 100 });
    }
  }, [activeView, fetchTrajectory]);

  /**
   * @description Renders the active view component
   */
  const renderActiveView = useCallback(() => {
    switch (activeView) {
      case 'overview':
        return <OverviewPanel autoRefresh={false} />;
      case 'trajectory':
        return <TrajectoryView autoFetch={false} />;
      case 'directionality':
        return (
          <DirectionalityExplorer
            trajectoryPoints={trajectory}
            loading={loading}
          />
        );
      case 'correlation':
        return <StateCorrelationView />;
      case 'axes':
        return <AxisManager />;
      case 'export':
        return <DataExportPanel />;
      case 'memory-lab':
        return <SyntheticMemory />;
      default:
        return <OverviewPanel autoRefresh={false} />;
    }
  }, [activeView, trajectory, loading]);

  return (
    // h-full + overflow-y-auto: renders inside the shell's overflow:hidden
    // content area; without its own scroll container it clips below the fold
    // (same class of bug as SettingsTab — RUN-20260704-1520).
    <div className="sim-tab h-full overflow-y-auto p-4 space-y-4">
      {/* Tab Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-full bg-cyan-500/10">
            <Icon name="Brain" size={20} className="text-cyan-500" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-content-primary">
              Semantic Identity Monitor
            </h1>
            <p className="text-xs text-content-muted">
              Track identity evolution through embedding space
            </p>
          </div>
        </div>

        {/* Global refresh button */}
        <button
          onClick={() => refresh()}
          disabled={loading}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium
                     rounded border border-border-subtle bg-surface
                     text-content-secondary hover:bg-surface
                     disabled:opacity-50 disabled:cursor-not-allowed
                     transition-colors"
          title="Refresh all SIM data"
        >
          <Icon
            name="RefreshCw"
            size={14}
            className={loading ? 'animate-spin' : ''}
          />
          Refresh
        </button>
      </div>

      {/* Error banner */}
      {error && (
        <div className="rounded-lg border border-danger/50 bg-danger/10 p-3">
          <div className="flex items-center gap-2 text-sm text-danger">
            <Icon name="AlertTriangle" size={16} />
            <span>{error}</span>
          </div>
        </div>
      )}

      {/* Sub-navigation tabs */}
      <nav className="flex border-b border-border-subtle overflow-x-auto">
        {VIEWS.map((view) => (
          <button
            key={view.id}
            onClick={() => setActiveView(view.id)}
            className={`sim-nav-tab flex items-center gap-2 px-4 py-2.5 text-sm font-medium
                       border-b-2 transition-all whitespace-nowrap
                       ${
                         activeView === view.id
                           ? 'border-cyan-500 text-cyan-500'
                           : 'border-transparent text-content-muted hover:text-content-secondary hover:bg-surface/50'
                       }`}
          >
            <Icon name={view.icon} size={16} />
            {view.label}
          </button>
        ))}
      </nav>

      {/* Active view content */}
      <div className="sim-view-content">
        {renderActiveView()}
      </div>

      {/* Basin status indicator (always visible at bottom) */}
      {basin?.global && (
        <div className="sim-status-bar flex items-center justify-between text-xs text-content-muted
                        border-t border-border-subtle pt-3 mt-4">
          <div className="flex items-center gap-4">
            <span>
              <strong>{basin.global.sampleCount ?? 0}</strong> samples
            </span>
            <span>
              Mean distance: <strong>{basin.global.meanDistance?.toFixed(3) ?? '--'}</strong>
            </span>
            <span>
              Threshold (2σ): <strong>{basin.global.outlierThreshold?.toFixed(3) ?? '--'}</strong>
            </span>
          </div>
          {basin.global.computedAt && (
            <span>
              Last computed: {new Date(basin.global.computedAt).toLocaleString()}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
