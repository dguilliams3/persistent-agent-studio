/**
 * Semantic Identity Monitor Data Hook
 *
 * @module tabs/SemanticMonitorTab/hooks/useSIMData
 * @description Custom hook that wraps Zustand SIM slice for convenient access
 * to basin metrics, trajectory data, concept axes, anomalies, and export actions.
 *
 * @upstream Called by:
 *   - SemanticMonitorTab/index.jsx - Main tab orchestrator
 *   - views/OverviewPanel.jsx - Basin metrics display
 *   - views/TrajectoryView.jsx - Timeline visualization
 *   - views/AxisManager.tsx - Concept axis CRUD
 *   - views/StateCorrelationView.tsx - State correlation
 * @downstream Calls:
 *   - store/slices/sim.js via useAppStore selectors
 */

import { useCallback, useMemo } from 'react';
import { useAppStore } from '../../../../store';

/**
 * @description Hook providing basin metrics, trajectory, axes, anomalies, and actions for SIM tab
 *
 * @upstream Called by: SemanticMonitorTab components
 * @downstream Calls: useAppStore selectors for SIM slice
 *
 * @returns {Object} SIM data and actions
 */
export function useSIMData() {
  // Zustand selectors - each returns only when that slice changes
  const simBasinMetrics = useAppStore((s) => s.simBasinMetrics);
  const simTrajectoryPoints = useAppStore((s) => s.simTrajectoryPoints);
  const simLoading = useAppStore((s) => s.simLoading);
  const simError = useAppStore((s) => s.simError);

  // Axes
  const simAxes = useAppStore((s) => s.simAxes);
  const simAxesLoading = useAppStore((s) => s.simAxesLoading);

  // Anomalies
  const simAnomalies = useAppStore((s) => s.simAnomalies);

  // Actions from store
  const fetchBasinMetrics = useAppStore((s) => s.fetchBasinMetrics);
  const computeBasin = useAppStore((s) => s.computeBasin);
  const fetchTrajectory = useAppStore((s) => s.fetchTrajectory);
  const fetchAxes = useAppStore((s) => s.fetchAxes);
  const createAxis = useAppStore((s) => s.createAxis);
  const updateAxisAction = useAppStore((s) => s.updateAxisAction);
  const deleteAxisAction = useAppStore((s) => s.deleteAxisAction);
  const fetchAnomalies = useAppStore((s) => s.fetchAnomalies);
  const exportSIMData = useAppStore((s) => s.exportSIMData);

  /**
   * @description Refresh basin metrics from server
   */
  const refresh = useCallback(async () => {
    return fetchBasinMetrics();
  }, [fetchBasinMetrics]);

  /**
   * @description Derived state: whether basin data has been loaded
   */
  const hasBasinData = useMemo(() => {
    return !!(simBasinMetrics?.global);
  }, [simBasinMetrics]);

  /**
   * @description Derived state: is the latest entry an outlier? (now per type via latestByType)
   */
  const isCurrentOutlier = useMemo(() => {
    // For global view, check if any type has outlier, or use first
    const byType = simBasinMetrics?.latestByType;
    if (byType) {
      return Object.values(byType).some((e: unknown) => (e as {isOutlier?: boolean})?.isOutlier) ?? false;
    }
    return false;
  }, [simBasinMetrics]);

  return {
    // Data
    basin: simBasinMetrics,
    trajectory: simTrajectoryPoints,
    axes: simAxes,
    anomalies: simAnomalies,

    // Derived state
    hasBasinData,
    isCurrentOutlier,

    // Loading/error
    loading: simLoading,
    axesLoading: simAxesLoading,
    error: simError,

    // Actions
    refresh,
    computeBasin,
    fetchTrajectory,
    fetchAxes,
    createAxis,
    updateAxisAction,
    deleteAxisAction,
    fetchAnomalies,
    exportSIMData,
  };
}

export default useSIMData;
