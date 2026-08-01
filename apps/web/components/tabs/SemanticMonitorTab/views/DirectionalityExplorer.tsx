/**
 * Directionality Explorer View
 *
 * @module tabs/SemanticMonitorTab/views/DirectionalityExplorer
 * @description Provides UI for exploring semantic directions between anchor poles.
 * Users browse a searchable/filterable history list, select multiple entries per pole,
 * and compute direction vectors between pole centroids.
 *
 * UI Flow:
 * 1. Set entry limit (100/500/1000/All) to load more embedded entries
 * 2. Search/filter entries via text input and type dropdown
 * 3. Check entries with checkboxes, then assign to Pole A or Pole B
 * 4. Click "Compute Direction" to calculate direction vector between pole centroids
 * 5. View results on an interactive 1D projection chart
 *
 * Multi-select allows defining robust poles (e.g., 10 geopolitics entries vs 10 exist entries)
 * by computing centroids (average embeddings) for each pole.
 *
 * @upstream Called by:
 *   - SemanticMonitorTab/index.jsx - Main tab orchestrator
 * @downstream Calls:
 *   - ../../../ui/charts/ProjectionChart.jsx - 1D projection visualization
 *   - ../../../ui/charts/ChartDetailPanel.jsx - Side panel for selected point
 *   - ../../../ui/historyUtils.js - Type constants and formatters
 *   - ../../../ui/TypeFilterDropdown.jsx - Multi-select type filter dropdown
 *   - ../../../../store/index.js - For history data and fetchTrajectory
 *   - ../../../ui/Icon.jsx - For Lucide icons
 *   - ../../../../api/client.js - For POST /sim/direction/compute endpoint
 */

import { useState, useMemo, useCallback, useEffect } from 'react';
import { Icon, TypeFilterDropdown } from '../../../ui';
import { ProjectionChart, ChartDetailPanel } from '../../../ui/charts';
import {
  SELECTABLE_TYPES,
  TYPE_ICONS,
  TYPE_LABELS,
  formatTime,
} from '../../../ui/historyUtils';
import { useAppStore } from '../../../../store';
import api from '../../../../api/client';

/**
 * @description Filter options for the type dropdown
 */
const TYPE_FILTER_OPTIONS = SELECTABLE_TYPES.map((type: string) => ({
  value: type,
  label: (TYPE_LABELS as any)[type] || type,
  icon: (TYPE_ICONS as any)[type] || 'Circle',
}));

/**
 * @description Limit options for entry loading
 */
const LIMIT_OPTIONS = [
  { value: 100, label: '100' },
  { value: 500, label: '500' },
  { value: 1000, label: '1000' },
  { value: 10000, label: 'All' },
];

interface DirectionalityExplorerProps {
  trajectoryPoints?: Array<{
    id?: number | string;
    table?: string;
    type?: string;
    content?: string;
    timestamp?: string;
    [key: string]: unknown;
  }>;
  loading?: boolean;
}

/**
 * @description Main component for exploring semantic directions between poles
 *
 * @param {Object} props - Component props
 * @param {Array<Object>} props.trajectoryPoints - Available entries with embeddings
 * @param {boolean} props.loading - Whether trajectory data is loading
 * @returns {JSX.Element} The directionality explorer UI
 */
export function DirectionalityExplorer({ trajectoryPoints, loading }: DirectionalityExplorerProps) {
  // Get fetchTrajectory from store (trajectoryPoints comes from props, not history)
  const fetchTrajectory = useAppStore((s) => s.fetchTrajectory);

  // Entry limit state
  const [entryLimit, setEntryLimit] = useState(500);

  // Collapsible explanation card state
  const [showExplanation, setShowExplanation] = useState(false);

  // Refetch when limit changes
  useEffect(() => {
    fetchTrajectory({ limit: entryLimit });
  }, [entryLimit, fetchTrajectory]);

  // Search and filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTypes, setSelectedTypes] = useState<string[] | null>(null);

  // Multi-select state: arrays of full entry objects per pole
  const [poleA, setPoleA] = useState<any[]>([]);
  const [poleB, setPoleB] = useState<any[]>([]);

  // Checkbox selection (entries checked but not yet assigned to a pole)
  const [checkedIds, setCheckedIds] = useState<Set<any>>(new Set());

  // Compute state
  const [computing, setComputing] = useState(false);
  const [directionResult, setDirectionResult] = useState<any>(null);
  const [computeError, setComputeError] = useState<string | null>(null);
  const [selectedPoint, setSelectedPoint] = useState<any>(null);

  /**
   * @description Filter trajectory entries for display
   * Uses trajectoryPoints directly (not history) since it has all embedded entries with content
   */
  const filteredEntries = useMemo(() => {
    if (!trajectoryPoints?.length) return [];

    return trajectoryPoints.filter((entry) => {
      // Filter by selectable types
      if (!SELECTABLE_TYPES.includes(entry.type as any)) return false;

      // Filter by selected types (if any selected)
      if (selectedTypes !== null && !selectedTypes.includes(entry.type as any)) {
        return false;
      }

      // Filter by search query
      if (searchQuery.trim()) {
        const content = entry.content || '';
        if (!content.toLowerCase().includes(searchQuery.toLowerCase())) {
          return false;
        }
      }

      return true;
    });
  }, [trajectoryPoints, selectedTypes, searchQuery]);

  /**
   * @description Compute type counts for filter dropdown
   */
  const typeCounts = useMemo(() => {
    if (!trajectoryPoints?.length) return {};
    const counts: Record<string, number> = {};
    trajectoryPoints.forEach((entry) => {
      if (SELECTABLE_TYPES.includes(entry.type as any)) {
        counts[entry.type as string] = (counts[entry.type as string] || 0) + 1;
      }
    });
    return counts;
  }, [trajectoryPoints]);

  /**
   * @description Get which pole an entry is assigned to
   * @param {number} entryId - Entry ID
   * @returns {'A' | 'B' | null}
   */
  const getEntryPole = useCallback(
    (entryId: any) => {
      if (poleA.some((e) => e.id === entryId)) return 'A';
      if (poleB.some((e) => e.id === entryId)) return 'B';
      return null;
    },
    [poleA, poleB]
  );

  /**
   * @description Toggle checkbox for an entry
   */
  const handleCheckToggle = useCallback((entryId: any) => {
    setCheckedIds((prev) => {
      const next = new Set(prev);
      if (next.has(entryId)) {
        next.delete(entryId);
      } else {
        next.add(entryId);
      }
      return next;
    });
  }, []);

  /**
   * @description Assign all checked entries to a pole
   */
  const assignToPole = useCallback(
    (pole: any) => {
      const entries = filteredEntries.filter((e) => checkedIds.has(e.id));
      if (entries.length === 0) return;

      if (pole === 'A') {
        // Remove from pole B if present, add to pole A
        setPoleB((prev) => prev.filter((e) => !checkedIds.has(e.id)));
        setPoleA((prev) => {
          const existing = new Set(prev.map((e) => e.id));
          const newEntries = entries.filter((e) => !existing.has(e.id));
          return [...prev, ...newEntries];
        });
      } else {
        // Remove from pole A if present, add to pole B
        setPoleA((prev) => prev.filter((e) => !checkedIds.has(e.id)));
        setPoleB((prev) => {
          const existing = new Set(prev.map((e) => e.id));
          const newEntries = entries.filter((e) => !existing.has(e.id));
          return [...prev, ...newEntries];
        });
      }

      // Clear checked after assignment
      setCheckedIds(new Set());
    },
    [checkedIds, filteredEntries]
  );

  /**
   * @description Remove an entry from its pole
   */
  const removeFromPole = useCallback((entryId: any, pole: any) => {
    if (pole === 'A') {
      setPoleA((prev) => prev.filter((e) => e.id !== entryId));
    } else {
      setPoleB((prev) => prev.filter((e) => e.id !== entryId));
    }
  }, []);

  /**
   * @description Clear all pole assignments
   */
  const handleClear = useCallback(() => {
    setPoleA([]);
    setPoleB([]);
    setCheckedIds(new Set());
    setDirectionResult(null);
    setComputeError(null);
    setSelectedPoint(null);
  }, []);

  /**
   * @description Compute direction between pole centroids
   */
  const handleComputeDirection = useCallback(async () => {
    if (poleA.length === 0 || poleB.length === 0) return;

    setComputing(true);
    setComputeError(null);
    setDirectionResult(null);
    setSelectedPoint(null);

    try {
      const result: any = await api.post('/sim/direction/compute', {
        poleA: poleA.map((e) => ({ table: 'history', id: e.id })),
        poleB: poleB.map((e) => ({ table: 'history', id: e.id })),
        projectLimit: 200,
      });

      if (result.success) {
        setDirectionResult(result);
      } else {
        setComputeError(result.error || 'Failed to compute direction');
      }
    } catch (err: any) {
      setComputeError(err.message || 'An error occurred');
    } finally {
      setComputing(false);
    }
  }, [poleA, poleB]);

  const handlePointClick = useCallback((pointData: any) => {
    setSelectedPoint(pointData);
  }, []);

  const handleClosePanel = useCallback(() => {
    setSelectedPoint(null);
  }, []);

  const canCompute = poleA.length > 0 && poleB.length > 0 && !computing;
  const hasChecked = checkedIds.size > 0;

  return (
    <div className="space-y-4">
      {/* Compact Explanation Toggle */}
      <button
        type="button"
        onClick={() => setShowExplanation(!showExplanation)}
        className="w-full flex items-center gap-2 px-3 py-2 rounded-lg border border-border-subtle
                   bg-surface hover:bg-surface transition-colors text-left"
      >
        <Icon name="Compass" size={14} className="text-cyan-500 flex-shrink-0" />
        <span className="text-xs text-content-secondary flex-1">
          {showExplanation ? 'Hide instructions' : 'How to use: Select entries for Pole A and B, then compute direction'}
        </span>
        <Icon
          name={showExplanation ? 'ChevronUp' : 'ChevronDown'}
          size={12}
          className="text-content-muted"
        />
      </button>

      {showExplanation && (
        <div className="rounded-lg border border-cyan-500/30 bg-cyan-500/5 p-3 text-xs text-content-secondary leading-relaxed">
          Select multiple entries for each pole to define a semantic direction. For example,
          add 10 <span className="text-cyan-400">geopolitics</span> thoughts to Pole A and 10{' '}
          <span className="text-amber-400">exist</span> entries to Pole B, then see where other
          memories fall along that spectrum.
        </div>
      )}

      {/* Main Explorer Card */}
      <div className="rounded-lg border border-border-subtle bg-surface p-4">
        {/* Header with Clear button */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-base font-semibold text-content-primary">
              Build Direction Poles
            </h3>
            <p className="text-xs text-content-muted mt-1">
              Check entries below, then assign to Pole A or Pole B
            </p>
          </div>
          {(poleA.length > 0 || poleB.length > 0 || directionResult) && (
            <button
              type="button"
              onClick={handleClear}
              className="text-xs text-content-secondary hover:text-content-primary transition-colors flex items-center gap-1"
            >
              <Icon name="X" size={12} />
              Clear All
            </button>
          )}
        </div>

        {/* Pole summary badges */}
        <div className="flex flex-wrap gap-2 mb-4">
          {/* Pole A badge */}
          <div
            className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs ${
              poleA.length > 0
                ? 'border-cyan-500/50 bg-cyan-500/10 text-cyan-400'
                : 'border-border-subtle bg-surface text-content-muted'
            }`}
          >
            <span className="font-medium">Pole A:</span>
            <span>{poleA.length} entries</span>
          </div>

          {/* Pole B badge */}
          <div
            className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs ${
              poleB.length > 0
                ? 'border-amber-500/50 bg-amber-500/10 text-amber-400'
                : 'border-border-subtle bg-surface text-content-muted'
            }`}
          >
            <span className="font-medium">Pole B:</span>
            <span>{poleB.length} entries</span>
          </div>

          {/* Compute button */}
          <button
            type="button"
            onClick={handleComputeDirection}
            disabled={!canCompute}
            className={`
              flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-medium
              transition-all duration-150
              ${
                canCompute
                  ? 'bg-accent text-white hover:bg-accent-light'
                  : 'bg-surface-raised text-content-muted cursor-not-allowed'
              }
            `}
          >
            {computing ? (
              <>
                <Icon name="Loader2" size={12} className="animate-spin" />
                Computing...
              </>
            ) : (
              <>
                <Icon name="Zap" size={12} />
                Compute Direction
              </>
            )}
          </button>
        </div>

        {/* Assignment buttons (when entries are checked) */}
        {hasChecked && (
          <div className="flex items-center gap-2 mb-3 p-2 bg-surface rounded-lg">
            <span className="text-xs text-content-secondary">
              {checkedIds.size} selected:
            </span>
            <button
              type="button"
              onClick={() => assignToPole('A')}
              className="flex items-center gap-1 px-3 py-1 text-xs font-medium rounded bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30 transition-colors"
            >
              <Icon name="ArrowRight" size={12} />
              Pole A
            </button>
            <button
              type="button"
              onClick={() => assignToPole('B')}
              className="flex items-center gap-1 px-3 py-1 text-xs font-medium rounded bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 transition-colors"
            >
              <Icon name="ArrowRight" size={12} />
              Pole B
            </button>
            <button
              type="button"
              onClick={() => setCheckedIds(new Set())}
              className="ml-auto text-xs text-content-muted hover:text-content-primary"
            >
              Clear
            </button>
          </div>
        )}

        {/* Controls row: Search, Type Filter, Limit */}
        <div className="flex items-center gap-3 mb-3">
          {/* Search input */}
          <div className="relative flex-1">
            <Icon
              name="Search"
              size={14}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-content-muted"
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search entries..."
              className="w-full pl-8 pr-3 py-1.5 text-sm rounded-md border border-border-subtle bg-surface
                         text-content-primary placeholder:text-content-muted
                         focus:border-cyan-500 focus:outline-none transition-colors"
            />
          </div>

          {/* Type filter dropdown */}
          <TypeFilterDropdown
            options={TYPE_FILTER_OPTIONS}
            selected={selectedTypes}
            onChange={setSelectedTypes}
            counts={typeCounts}
            placeholder="All types"
          />

          {/* Limit selector */}
          <select
            value={entryLimit}
            onChange={(e) => setEntryLimit(Number(e.target.value))}
            className="px-3 py-1.5 text-sm rounded-md border-2 border-border-subtle bg-surface-raised
                       text-content-primary cursor-pointer
                       hover:bg-surface hover:border-border-subtle
                       focus:outline-none focus:ring-2 focus:ring-primary-500/50 shadow-md"
          >
            {LIMIT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value} className="bg-surface-raised">
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {/* Entry count */}
        <div className="text-xs text-content-muted mb-2">
          Showing {filteredEntries.length} of {trajectoryPoints?.length || 0} embedded entries
        </div>

        {/* Loading state */}
        {loading && (
          <div className="flex items-center gap-2 text-sm text-content-secondary py-4">
            <Icon name="Loader2" size={16} className="animate-spin" />
            <span>Loading embedded entries...</span>
          </div>
        )}

        {/* No data state */}
        {!loading && filteredEntries.length === 0 && (
          <div className="py-6 text-center">
            <div className="w-12 h-12 rounded-full bg-surface mx-auto mb-3 flex items-center justify-center">
              <Icon name="Database" size={24} className="text-content-muted" />
            </div>
            <p className="text-sm text-content-secondary mb-2">
              {history.length === 0
                ? 'No history entries available'
                : trajectoryPoints?.length === 0
                ? 'No embedded entries yet'
                : 'No entries match your filters'}
            </p>
          </div>
        )}

        {/* Scrollable entry list with checkboxes */}
        {!loading && filteredEntries.length > 0 && (
          <div
            className="border border-border-subtle rounded-lg bg-surface"
            style={{ height: '400px', overflowY: 'scroll' }}
          >
            <div className="divide-y divide-surface-200">
              {filteredEntries.map((entry) => {
                const pole = getEntryPole(entry.id);
                const isChecked = checkedIds.has(entry.id);

                return (
                  <div
                    key={entry.id}
                    className={`group flex items-center gap-3 px-3 py-2.5 transition-colors ${
                      pole === 'A'
                        ? 'bg-cyan-500/10 border-l-2 border-l-cyan-500'
                        : pole === 'B'
                        ? 'bg-amber-500/10 border-l-2 border-l-amber-500'
                        : 'hover:bg-surface border-l-2 border-l-transparent'
                    }`}
                  >
                    {/* Checkbox */}
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => handleCheckToggle(entry.id)}
                      disabled={!!pole}
                      className="h-4 w-4 rounded border-border-subtle text-accent
                                 focus:ring-primary-500 focus:ring-offset-0 disabled:opacity-50
                                 flex-shrink-0"
                    />

                    {/* Type icon */}
                    <Icon
                      name={(TYPE_ICONS as any)[entry.type as any] || 'Circle'}
                      size={14}
                      className={`flex-shrink-0 ${
                        entry.type === 'thought'
                          ? 'text-purple-400'
                          : entry.type === 'user_message'
                          ? 'text-emerald-400'
                          : entry.type === 'message_to_user'
                          ? 'text-blue-400'
                          : 'text-content-muted'
                      }`}
                    />

                    {/* Time */}
                    <span className="text-content-muted text-xs flex-shrink-0 w-14">
                      {formatTime(entry.timestamp)}
                    </span>

                    {/* Content - primary focus */}
                    <p className="flex-1 min-w-0 text-sm text-content-primary truncate">
                      {entry.content || ''}
                    </p>

                    {/* Pole badge or remove button */}
                    {pole ? (
                      <button
                        type="button"
                        onClick={() => removeFromPole(entry.id, pole)}
                        className={`flex-shrink-0 flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium
                                    transition-colors ${
                          pole === 'A'
                            ? 'bg-cyan-500/30 text-cyan-400 hover:bg-cyan-500/40'
                            : 'bg-amber-500/30 text-amber-400 hover:bg-amber-500/40'
                        }`}
                        title="Click to remove from pole"
                      >
                        {pole}
                        <Icon name="X" size={10} className="opacity-60 group-hover:opacity-100" />
                      </button>
                    ) : (
                      <span className="text-[10px] text-content-muted flex-shrink-0 w-16 text-right opacity-0 group-hover:opacity-100 transition-opacity">
                        {(TYPE_LABELS as any)[entry.type as any] || entry.type}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Error display */}
        {computeError && (
          <div className="mt-4 rounded border border-danger/50 bg-danger/10 p-3">
            <p className="text-sm text-danger">{computeError}</p>
          </div>
        )}

        {/* Results display */}
        {directionResult && (
          <div className="mt-4 space-y-4">
            {/* Direction info */}
            <div className="rounded border border-border-subtle bg-surface p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-content-secondary">Direction Magnitude</span>
                <span className="text-lg font-mono font-semibold text-content-primary">
                  {directionResult.direction.magnitude.toFixed(4)}
                </span>
              </div>
              <p className="text-xs text-content-muted">
                Computed from {directionResult.direction.poleACount} Pole A entries and{' '}
                {directionResult.direction.poleBCount} Pole B entries (using centroids)
              </p>
            </div>

            {/* Projection Chart - caged to prevent bleed */}
            <div className="relative rounded-lg border border-border-subtle bg-surface overflow-hidden" style={{ maxHeight: '280px' }}>
              <div className="p-3 border-b border-border-subtle">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-medium text-content-primary">
                    Projections ({directionResult.projections.length} entries)
                  </h4>
                  <span className="text-xs text-content-muted">
                    Click a point to view details
                  </span>
                </div>
              </div>

              <div className={`transition-all duration-200 overflow-hidden ${selectedPoint ? 'mr-80' : ''}`} style={{ maxHeight: '220px' }}>
                <ProjectionChart
                  points={directionResult.projections}
                  anchorA={{ label: `Pole A (${poleA.length})` }}
                  anchorB={{ label: `Pole B (${poleB.length})` }}
                  onPointClick={handlePointClick}
                  selectedId={selectedPoint?.id}
                  height={220}
                />
              </div>

              <ChartDetailPanel
                entry={selectedPoint}
                onClose={handleClosePanel}
                isOpen={!!selectedPoint}
              />
            </div>

            {/* Legend */}
            <p className="text-xs text-content-muted text-center">
              Entries closer to <span className="text-amber-500 font-medium">amber</span> are similar to Pole A centroid.
              Entries closer to <span className="text-cyan-500 font-medium">cyan</span> are similar to Pole B centroid.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}


export default DirectionalityExplorer;
