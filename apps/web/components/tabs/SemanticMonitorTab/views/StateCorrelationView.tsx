/**
 * State Correlation View
 *
 * @module tabs/SemanticMonitorTab/views/StateCorrelationView
 * @description Correlates entity activity types and meter states with semantic
 * embedding position. Shows how different kinds of activity (thoughts, messages,
 * curiosities) cluster in embedding space relative to the basin centroid.
 *
 * @upstream Called by:
 *   - SemanticMonitorTab/index.jsx - Main tab orchestrator
 * @downstream Calls:
 *   - ../hooks/useSIMData.js - Data access hook
 *   - ../../../ui/Icon.jsx - Lucide icons
 *   - ../../../../api/client.js - For meters data
 */

import { useEffect, useState, useMemo, useCallback } from 'react';
import { Icon } from '../../../ui';
import { useSIMData } from '../hooks/useSIMData';
import api from '../../../../api/client';
import { getZScoreColor } from '../utils/colorScales';

interface MeterValues {
  [key: string]: number;
}

interface MeterHistoryEntry {
  value: number;
  timestamp: string;
}

interface MetersResponse {
  values: MeterValues;
  histories: Record<string, MeterHistoryEntry[]>;
}

interface TypeStats {
  type: string;
  count: number;
  meanDistance: number;
  stdDistance: number;
  meanZScore: number;
  minDistance: number;
  maxDistance: number;
}

const METER_LABELS: Record<string, string> = {
  aliveness: 'Aliveness',
  curiosity: 'Curiosity',
  connection: 'Connection',
  ease: 'Ease',
  delight: 'Delight',
};

const TYPE_LABELS: Record<string, string> = {
  thought: 'Thoughts',
  message_to_user: 'Messages to User',
  user_message: "User's Messages",
  search_query: 'Search Queries',
  search_result: 'Search Results',
  art_request: 'Art Requests',
  curiosity: 'Curiosities',
  note_saved: 'Notes',
  exist: 'Existence Reflections',
};

/**
 * Compute per-type statistics from trajectory points
 */
function computeTypeStats(points: Array<{type: string; distance: number; zScore: number}>): TypeStats[] {
  const byType: Record<string, number[]> = {};
  const zByType: Record<string, number[]> = {};

  for (const p of points) {
    const t = p.type || 'unknown';
    if (!byType[t]) {
      byType[t] = [];
      zByType[t] = [];
    }
    if (Number.isFinite(p.distance)) {
      byType[t].push(p.distance);
    }
    if (Number.isFinite(p.zScore)) {
      zByType[t].push(p.zScore);
    }
  }

  const stats: TypeStats[] = [];
  for (const [type, distances] of Object.entries(byType)) {
    if (distances.length === 0) continue;
    const n = distances.length;
    const mean = distances.reduce((a, b) => a + b, 0) / n;
    const variance = distances.reduce((a, b) => a + (b - mean) ** 2, 0) / n;
    const std = Math.sqrt(variance);
    const zScores = zByType[type] || [];
    const meanZ = zScores.length > 0 ? zScores.reduce((a, b) => a + b, 0) / zScores.length : 0;

    stats.push({
      type,
      count: n,
      meanDistance: mean,
      stdDistance: std,
      meanZScore: meanZ,
      minDistance: Math.min(...distances),
      maxDistance: Math.max(...distances),
    });
  }

  stats.sort((a, b) => b.count - a.count);
  return stats;
}

export function StateCorrelationView() {
  const { trajectory, loading, error, fetchTrajectory } = useSIMData();
  const [meters, setMeters] = useState<MetersResponse | null>(null);
  const [metersLoading, setMetersLoading] = useState(false);

  // Fetch trajectory data on mount
  useEffect(() => {
    fetchTrajectory({ limit: 500 });
  }, [fetchTrajectory]);

  // Fetch meters data
  useEffect(() => {
    async function loadMeters() {
      setMetersLoading(true);
      try {
        const data = await api.getMeters();
        setMeters(data as any);
      } catch {
        // Meters are optional for correlation view
      } finally {
        setMetersLoading(false);
      }
    }
    loadMeters();
  }, []);

  const handleRefresh = useCallback(() => {
    fetchTrajectory({ limit: 500 });
  }, [fetchTrajectory]);

  // Compute type-level statistics
  const typeStats = useMemo(() => {
    if (!trajectory || trajectory.length === 0) return [];
    return computeTypeStats(trajectory);
  }, [trajectory]);

  // Find the global max distance for bar scaling
  const maxMeanDistance = useMemo(() => {
    if (typeStats.length === 0) return 1;
    return Math.max(...typeStats.map(s => s.meanDistance + s.stdDistance));
  }, [typeStats]);

  const hasData = typeStats.length > 0;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-full bg-accent/10">
            <Icon name="Activity" size={20} className="text-accent" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-content-primary">
              State Correlation
            </h2>
            <p className="text-xs text-content-muted">
              How different activity types relate to semantic position
            </p>
          </div>
        </div>

        <button
          onClick={handleRefresh}
          disabled={loading}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium
                     rounded border border-border-subtle bg-surface
                     text-content-secondary hover:bg-surface
                     disabled:opacity-50 disabled:cursor-not-allowed
                     transition-colors"
        >
          <Icon
            name="RefreshCw"
            size={14}
            className={loading ? 'animate-spin' : ''}
          />
          Refresh
        </button>
      </div>

      {/* Error state */}
      {error && (
        <div className="rounded border border-danger/50 bg-danger/10 p-3">
          <p className="text-sm text-danger">{error}</p>
        </div>
      )}

      {/* Loading state */}
      {loading && !hasData && (
        <div className="rounded-lg border border-border-subtle bg-surface p-8 text-center">
          <Icon name="Loader2" size={24} className="mx-auto animate-spin text-content-muted mb-2" />
          <p className="text-sm text-content-secondary">Loading trajectory data...</p>
        </div>
      )}

      {/* No data state */}
      {!loading && !hasData && (
        <div className="rounded-lg border border-border-subtle bg-surface p-8 text-center">
          <Icon name="BarChart3" size={32} className="mx-auto text-content-muted mb-3" />
          <p className="text-sm text-content-secondary mb-1">No trajectory data available</p>
          <p className="text-xs text-content-muted">
            Compute basin metrics and load trajectory data first
          </p>
        </div>
      )}

      {/* Main content */}
      {hasData && (
        <>
          {/* Type correlation chart */}
          <div className="rounded-lg border border-border-subtle bg-surface p-4">
            <h3 className="text-sm font-semibold text-content-primary mb-3">
              Distance from Centroid by Activity Type
            </h3>
            <p className="text-xs text-content-muted mb-4">
              Shows mean distance (bar) with standard deviation (whisker) for each entry type.
              Lower distance = closer to identity center.
            </p>

            <div className="space-y-2">
              {typeStats.map((stat) => {
                const barWidth = maxMeanDistance > 0
                  ? (stat.meanDistance / maxMeanDistance) * 100
                  : 0;
                const whiskerEnd = maxMeanDistance > 0
                  ? ((stat.meanDistance + stat.stdDistance) / maxMeanDistance) * 100
                  : 0;

                return (
                  <div key={stat.type} className="group">
                    <div className="flex items-center gap-3">
                      {/* Label */}
                      <div className="w-36 text-right">
                        <span className="text-xs font-medium text-content-secondary">
                          {TYPE_LABELS[stat.type] || stat.type}
                        </span>
                        <span className="text-[10px] text-content-muted ml-1">
                          ({stat.count})
                        </span>
                      </div>

                      {/* Bar */}
                      <div className="flex-1 relative h-5">
                        {/* Background */}
                        <div className="absolute inset-0 rounded bg-surface" />

                        {/* Mean distance bar */}
                        <div
                          className="absolute top-0 left-0 h-full rounded transition-all"
                          style={{
                            width: `${Math.min(barWidth, 100)}%`,
                            backgroundColor: getZScoreColor(stat.meanZScore),
                            opacity: 0.7,
                          }}
                        />

                        {/* Std deviation whisker */}
                        {stat.stdDistance > 0 && (
                          <div
                            className="absolute top-1/2 -translate-y-1/2 h-0.5 bg-content-muted"
                            style={{
                              left: `${Math.min(barWidth, 100)}%`,
                              width: `${Math.min(whiskerEnd - barWidth, 100 - barWidth)}%`,
                            }}
                          />
                        )}
                      </div>

                      {/* Value */}
                      <div className="w-20 text-right">
                        <span className="text-xs font-mono text-content-secondary">
                          {stat.meanDistance.toFixed(3)}
                        </span>
                        <span className="text-[10px] text-content-muted ml-0.5">
                          ±{stat.stdDistance.toFixed(3)}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Current meter values (if available) */}
          {meters?.values && (
            <div className="rounded-lg border border-border-subtle bg-surface p-4">
              <h3 className="text-sm font-semibold text-content-primary mb-3">
                Current Being-State Meters
              </h3>
              <p className="text-xs text-content-muted mb-4">
                Subjective state dimensions at time of analysis.
                Future work: track how these correlate with basin distance over time.
              </p>

              <div className="grid grid-cols-5 gap-3">
                {Object.entries(METER_LABELS).map(([key, label]) => {
                  const value = meters.values[key];
                  if (value === undefined) return null;

                  return (
                    <div key={key} className="rounded border border-border-subtle bg-surface p-3 text-center">
                      <div className="text-xs text-content-muted uppercase mb-1">{label}</div>
                      <div className="text-xl font-semibold text-content-primary">{value}</div>
                      <div className="w-full h-1 rounded-full bg-surface-raised mt-2">
                        <div
                          className="h-full rounded-full bg-accent transition-all"
                          style={{ width: `${(value / 10) * 100}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Summary statistics */}
          <div className="rounded-lg border border-border-subtle bg-surface p-4">
            <h3 className="text-sm font-semibold text-content-primary mb-3">
              Correlation Summary
            </h3>
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center">
                <div className="text-xs text-content-muted uppercase mb-1">Total Samples</div>
                <div className="text-lg font-semibold text-content-primary">
                  {trajectory?.length || 0}
                </div>
              </div>
              <div className="text-center">
                <div className="text-xs text-content-muted uppercase mb-1">Activity Types</div>
                <div className="text-lg font-semibold text-content-primary">
                  {typeStats.length}
                </div>
              </div>
              <div className="text-center">
                <div className="text-xs text-content-muted uppercase mb-1">
                  Most Central Type
                </div>
                <div className="text-sm font-semibold text-content-primary">
                  {typeStats.length > 0
                    ? TYPE_LABELS[typeStats.reduce((a, b) => a.meanDistance < b.meanDistance ? a : b).type] || 'Unknown'
                    : '--'}
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default StateCorrelationView;
