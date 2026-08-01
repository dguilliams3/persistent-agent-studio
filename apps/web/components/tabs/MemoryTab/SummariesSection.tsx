/**
 * Summaries Section Component
 *
 * @module components/tabs/MemoryTab/SummariesSection
 * @description Memory summaries organized by tier with consolidation, promotion,
 * drag-and-drop reordering, and tier configuration controls.
 *
 * @upstream Called by: MemoryTab index
 * @downstream Calls: SummaryItem, DraggableSummary, useSummaryConfig, useAppStore
 */

import { useState, useMemo, useCallback, useEffect } from 'react';
import { DndContext, closestCenter, DragOverlay } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import {
  Snowflake,
  ScrollText,
  Library,
  ChevronRight,
  Layers,
} from 'lucide-react';
import { BLOCK_STYLES } from '../../../constants/blockStyles';
import { useAppStore } from '../../../store';
import { useSummaryConfig } from '../../../hooks/useSummaryConfig';
import { SummaryItem, DraggableSummary } from './SummaryItem';
import SectionCard from './SectionCard';
import {
  estimateTokens,
  DEFAULT_CONTEXT_SIZE,
  DEFAULT_BUFFER_SIZE,
  DEFAULT_TAIL_THRESHOLD,
  DEFAULT_TAIL_TARGET,
} from './constants';

// =============================================================================
// TYPES
// =============================================================================

interface SummariesSectionProps {
  summaries: any[];
  archivedSummaries: any[];
  selectedSummaries: Set<number>;
  setSelectedSummaries: (s: Set<number>) => void;
  isMetasummarizing: boolean;
  triggerMetasummarize: () => void;
  toggleSummarySelection: (id: number) => void;
  totalSummarizedEntries: number;
  formatTime: (time: string) => string;
}

// =============================================================================
// COMPONENT
// =============================================================================

export default function SummariesSection({
  summaries,
  archivedSummaries,
  selectedSummaries,
  setSelectedSummaries,
  isMetasummarizing,
  triggerMetasummarize,
  toggleSummarySelection,
  totalSummarizedEntries,
  formatTime,
}: SummariesSectionProps) {
  const tierTokens = (arr: any[]) => arr.reduce((sum: number, s: any) => sum + estimateTokens(s.summary), 0);
  const [activeSummaryId, setActiveSummaryId] = useState<number | null>(null);
  const [configInputs, setConfigInputs] = useState({
    tailTokenThreshold: DEFAULT_TAIL_THRESHOLD,
    tailTokenTarget: DEFAULT_TAIL_TARGET,
    contextSize: DEFAULT_CONTEXT_SIZE,
    bufferSize: DEFAULT_BUFFER_SIZE,
  });

  const {
    config,
    loading: configLoading,
    error: configError,
    updateSetting,
    moveSummary,
    setSummaryTier,
    refetch: refetchConfig,
  } = useSummaryConfig(summaries.length);

  const [dragError, setDragError] = useState<string | null>(null);
  const [isMovingSummary, setIsMovingSummary] = useState(false);
  const [isPromotingSummary, setIsPromotingSummary] = useState(false);
  const [isArchivingSummary, setIsArchivingSummary] = useState(false);

  // Get promotion and archive actions from store
  const promoteSummary = useAppStore((s) => s.promoteSummary);
  const demoteSummary = useAppStore((s) => s.demoteSummary);
  const activateSummary = useAppStore((s) => s.activateSummary);
  const archiveSummary = useAppStore((s) => s.archiveSummary);
  const setSummaryPosition = useAppStore((s) => s.setSummaryPosition);
  const fetchSummaries = useAppStore((s) => s.fetchSummaries);

  useEffect(() => {
    if (config) {
      setConfigInputs({
        tailTokenThreshold: config.tailTokenThreshold ?? DEFAULT_TAIL_THRESHOLD,
        tailTokenTarget: config.tailTokenTarget ?? DEFAULT_TAIL_TARGET,
        contextSize: config.contextSize ?? DEFAULT_CONTEXT_SIZE,
        bufferSize: config.bufferSize ?? DEFAULT_BUFFER_SIZE,
      });
    }
  }, [config]);

  const contextSize = config?.contextSize ?? DEFAULT_CONTEXT_SIZE;
  const bufferSize = config?.bufferSize ?? DEFAULT_BUFFER_SIZE;

  // CANONICAL TIER MODEL - tier field is the SINGLE SOURCE OF TRUTH
  // Valid tiers: 2 (PROMOTED), 3 (STABLE/CACHED), 4 (FRESH/TAIL), 'archived'
  const block2Summaries = useMemo(() => summaries.filter((s) => s.tier === 2), [summaries]);
  const pinnedSummaries = useMemo(() => summaries.filter((s) => s.tier === 3), [summaries]);
  const dynamicSummaries = useMemo(() => summaries.filter((s) => s.tier === 4), [summaries]);

  // Get boundary ID from config to split dynamic summaries
  const boundaryId = config?.boundary?.id ?? null;

  const { autoRolledSummaries, tailSummaries } = useMemo(() => {
    if (!boundaryId) {
      return { autoRolledSummaries: [], tailSummaries: dynamicSummaries };
    }
    const boundaryNum = Number(boundaryId);
    return {
      autoRolledSummaries: dynamicSummaries.filter((s) => Number(s.id) <= boundaryNum),
      tailSummaries: dynamicSummaries.filter((s) => Number(s.id) > boundaryNum)
    };
  }, [dynamicSummaries, boundaryId]);

  const cachedSummaries = useMemo(() => [...pinnedSummaries, ...autoRolledSummaries], [pinnedSummaries, autoRolledSummaries]);

  const block2Tokens = tierTokens(block2Summaries);
  const cachedTokens = config?.cachedTokens ?? tierTokens(cachedSummaries);
  const tailTokens = config?.tailTokens ?? tierTokens(tailSummaries);
  const archivedTokens = tierTokens(archivedSummaries);
  const totalActiveTokens = tierTokens(summaries);
  const cachedCountDisplay = config?.cachedCount ?? cachedSummaries.length;
  const tailCountDisplay = config?.tailCount ?? tailSummaries.length;
  const tailThresholdValue = configInputs.tailTokenThreshold || DEFAULT_TAIL_THRESHOLD;
  const rollProgress = tailThresholdValue > 0
    ? Math.min(100, Math.round((tailTokens / tailThresholdValue) * 100))
    : 0;

  const sortableItems = useMemo(
    () => [...cachedSummaries, ...tailSummaries].map((s) => s.id),
    [cachedSummaries, tailSummaries]
  );

  const dragOverlaySummary = useMemo(
    () => summaries.find((s) => s.id === activeSummaryId) || null,
    [activeSummaryId, summaries]
  );

  const handleThresholdChange = (key: string, min = 0) => (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = Number.parseInt(event.target.value, 10);
    const safeValue = Number.isNaN(value) ? 0 : Math.max(min, value);
    setConfigInputs((prev) => ({ ...prev, [key]: safeValue }));
    updateSetting(key, safeValue);
  };

  const handleDragStart = (event: any) => {
    setActiveSummaryId(event.active?.id ?? null);
  };

  const handleDragCancel = () => {
    setActiveSummaryId(null);
  };

  // Move summary to cached tier (tier=3)
  const moveToCached = useCallback(async (summaryId: number) => {
    if (isMovingSummary) return;
    setIsMovingSummary(true);
    setDragError(null);
    try {
      const maxCachedPosition = cachedSummaries.reduce(
        (max, s) => Math.max(max, s.tier_position || 0), 0
      );
      const res = await moveSummary(summaryId, 3, maxCachedPosition + 100);
      if (res?.success) {
        await fetchSummaries();
      } else {
        setDragError(res?.error || 'Failed to move summary to cached block');
      }
    } finally {
      setIsMovingSummary(false);
    }
  }, [cachedSummaries, moveSummary, isMovingSummary, fetchSummaries]);

  // Move summary out of cached tier to tail (tier=4)
  const moveFromCached = useCallback(async (summaryId: number) => {
    if (isMovingSummary) return;
    setIsMovingSummary(true);
    setDragError(null);
    try {
      const minTailPosition = tailSummaries.reduce(
        (min, s) => Math.min(min, s.tier_position || Infinity), Infinity
      );
      const newPosition = minTailPosition === Infinity ? 100 : Math.max(0, minTailPosition - 100);
      const res = await moveSummary(summaryId, 4, newPosition);
      if (res?.success) {
        await fetchSummaries();
      } else {
        setDragError(res?.error || 'Failed to move summary to dynamic tail');
      }
    } finally {
      setIsMovingSummary(false);
    }
  }, [tailSummaries, moveSummary, isMovingSummary, fetchSummaries]);

  const handlePromote = useCallback(async (summaryId: number) => {
    if (isPromotingSummary) return;
    setIsPromotingSummary(true);
    try { await promoteSummary(summaryId); } catch {} finally { setIsPromotingSummary(false); }
  }, [promoteSummary, isPromotingSummary]);

  const handleDemote = useCallback(async (summaryId: number) => {
    if (isPromotingSummary) return;
    setIsPromotingSummary(true);
    try { await demoteSummary(summaryId); } catch {} finally { setIsPromotingSummary(false); }
  }, [demoteSummary, isPromotingSummary]);

  const [isPinningSummary, setIsPinningSummary] = useState(false);
  const handlePin = useCallback(async (summaryId: number) => {
    if (isPinningSummary) return;
    setIsPinningSummary(true);
    try { await setSummaryTier(summaryId, 3); await fetchSummaries(); } catch (err) { console.error('[MemoryTab] Pin failed:', err); } finally { setIsPinningSummary(false); }
  }, [setSummaryTier, fetchSummaries, isPinningSummary]);

  const handleUnpin = useCallback(async (summaryId: number) => {
    if (isPinningSummary) return;
    setIsPinningSummary(true);
    try { await setSummaryTier(summaryId, 4); await fetchSummaries(); } catch (err) { console.error('[MemoryTab] Unpin failed:', err); } finally { setIsPinningSummary(false); }
  }, [setSummaryTier, fetchSummaries, isPinningSummary]);

  const handleArchive = useCallback(async (summaryId: number) => {
    if (isArchivingSummary) return;
    setIsArchivingSummary(true);
    try { await archiveSummary(summaryId); } catch {} finally { setIsArchivingSummary(false); }
  }, [archiveSummary, isArchivingSummary]);

  const handleActivate = useCallback(async (summaryId: number) => {
    if (isArchivingSummary) return;
    setIsArchivingSummary(true);
    try { await activateSummary(summaryId); } catch {} finally { setIsArchivingSummary(false); }
  }, [activateSummary, isArchivingSummary]);

  const handleDragEnd = async (event: any) => {
    setActiveSummaryId(null);
    const { active, over } = event;
    if (!active || !over || active.id === over.id) return;

    const draggedSummary = summaries.find((s) => s.id === active.id);
    const targetSummary = summaries.find((s) => s.id === over.id);
    if (!draggedSummary || !targetSummary) return;

    const sourceTier = draggedSummary.tier;
    const targetTier = targetSummary.tier;

    setIsMovingSummary(true);
    setDragError(null);

    try {
      const targetPosition = targetSummary.tier_position || 0;
      let newPosition: number;

      if (sourceTier === targetTier) {
        newPosition = targetPosition;
      } else {
        const targetTierSummaries = targetTier === 3 ? cachedSummaries : tailSummaries;
        const targetIndex = targetTierSummaries.findIndex((s) => s.id === over.id);

        if (targetIndex <= 0) {
          const firstPos = targetTierSummaries[0]?.tier_position || 100;
          newPosition = Math.max(0, firstPos - 100);
        } else {
          const prevPos = targetTierSummaries[targetIndex - 1]?.tier_position || 0;
          newPosition = prevPos + 50;
        }
      }

      const res = await moveSummary(active.id, targetTier, newPosition);
      if (res?.success) {
        await fetchSummaries();
      } else {
        setDragError(res?.error || 'Failed to move summary');
      }
    } catch (err: any) {
      console.error('[MemoryTab] Drag failed:', err);
      setDragError(err?.message || 'Failed to move summary');
    } finally {
      setIsMovingSummary(false);
    }
  };

  return (
    <SectionCard
      title={
        <>
          Memory Summaries
          <span className="text-content-secondary font-normal text-sm ml-2">
            {summaries.length} active (~{totalActiveTokens.toLocaleString()} tok)
            {archivedSummaries.length > 0 && ` • ${archivedSummaries.length} archived`}
            {totalSummarizedEntries > 0 && ` • ${totalSummarizedEntries} history entries`}
          </span>
        </>
      }
    >
      <div className="p-3 bg-surface rounded-lg space-y-3">
        <div className="flex flex-col gap-3 md:flex-row">
          <div className="flex-1">
            <label htmlFor="tail-roll-threshold" className="text-xs text-content-secondary font-medium block mb-1">Tail Roll Threshold (tokens)</label>
            <input id="tail-roll-threshold" type="number" className="input-sm" value={configInputs.tailTokenThreshold} onChange={handleThresholdChange('tailTokenThreshold', 1000)} min={1000} step={100} placeholder="8000" />
            <p className="text-xs text-content-muted mt-1">Rolls when the dynamic tail exceeds this token count.</p>
          </div>
          <div className="flex-1">
            <label htmlFor="tail-target" className="text-xs text-content-secondary font-medium block mb-1">Tail Target After Roll (tokens)</label>
            <input id="tail-target" type="number" className="input-sm" value={configInputs.tailTokenTarget} onChange={handleThresholdChange('tailTokenTarget', 500)} min={500} step={100} placeholder="4000" />
            <p className="text-xs text-content-muted mt-1">Approximate tail size once the cached block refreshes.</p>
          </div>
        </div>
        <div className="flex flex-col gap-3 md:flex-row">
          <div className="flex-1">
            <label htmlFor="cache-window" className="text-xs text-content-secondary font-medium block mb-1">Cached window (summaries)</label>
            <input id="cache-window" type="number" className="input-sm" value={configInputs.contextSize} onChange={handleThresholdChange('contextSize', 1)} min={1} step={1} placeholder="4" />
            <p className="text-xs text-content-muted mt-1">Number of cached summaries kept in the frozen block.</p>
          </div>
          <div className="flex-1">
            <label htmlFor="buffer-window" className="text-xs text-content-secondary font-medium block mb-1">Buffer window (summaries)</label>
            <input id="buffer-window" type="number" className="input-sm" value={configInputs.bufferSize} onChange={handleThresholdChange('bufferSize', 1)} min={1} step={1} placeholder="5" />
            <p className="text-xs text-content-muted mt-1">Number of summaries held in the dynamic RAG buffer.</p>
          </div>
        </div>
        <div className="text-xs text-content-secondary flex flex-wrap gap-3">
          <span>Cached: {cachedCountDisplay} summaries (~{cachedTokens.toLocaleString()} tok)</span>
          <span>Tail: {tailCountDisplay} summaries (~{tailTokens.toLocaleString()} tok)</span>
          {configLoading && <span className="text-content-muted">Refreshing config…</span>}
        </div>
        {configError && <div className="text-danger text-xs">{configError}</div>}
        {dragError && <div className="text-danger text-xs">{dragError}</div>}
      </div>

      {/* Metasummarize controls */}
      {summaries.length >= 2 && (
        <div className="p-3 mt-4 border-t-2 border-surface bg-depth/50 flex items-center gap-3 flex-wrap">
          <span className="section-header">Select to consolidate:</span>
          <span className="text-accent text-xs">{selectedSummaries.size} selected</span>
          <button onClick={() => setSelectedSummaries(new Set(summaries.map((s) => s.id)))} className="btn-ghost px-2 py-1 text-xs rounded">All</button>
          <button onClick={() => setSelectedSummaries(new Set())} className="btn-ghost px-2 py-1 text-xs rounded">Clear</button>
          <button onClick={triggerMetasummarize} disabled={isMetasummarizing || selectedSummaries.size < 2} className="btn-primary px-3 py-1 text-xs disabled:opacity-50 disabled:cursor-not-allowed">
            {isMetasummarizing ? 'Consolidating...' : `Consolidate ${selectedSummaries.size}`}
          </button>
        </div>
      )}

      <div className="border-t border-border-subtle max-h-[80vh] overflow-y-auto resize-y min-h-48 space-y-2 p-2">
        {/* Block 2 - Promoted Summaries */}
        {block2Summaries.length > 0 && (
          <div className={`rounded-lg border-l-4 ${BLOCK_STYLES.promoted.border} border border-border-subtle bg-surface`}>
            <details open>
              <summary className={`p-2 cursor-pointer ${BLOCK_STYLES.promoted.bg} ${BLOCK_STYLES.promoted.text} text-sm font-medium flex items-center gap-2 rounded-tr-lg`}>
                <ChevronRight className="w-4 h-4 group-open:rotate-90 transition-transform duration-fast" />
                <Snowflake className="w-4 h-4" />
                Block 2 - Promoted ({block2Summaries.length})
                <span className={`${BLOCK_STYLES.promoted.textLight} font-normal`}>~{block2Tokens.toLocaleString()} tok</span>
                <span className="text-content-muted font-normal text-xs ml-auto">Pinned to stable context (always cached)</span>
              </summary>
              <div className="p-2 space-y-2">
                {block2Summaries.map((s) => (
                  <SummaryItem key={s.id} summary={s} isSelected={selectedSummaries.has(s.id)} onToggle={toggleSummarySelection} formatTime={formatTime} tier="block2" onDemote={handleDemote} isPromoting={isPromotingSummary} />
                ))}
              </div>
            </details>
          </div>
        )}

        <DndContext collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd} onDragCancel={handleDragCancel}>
          <SortableContext items={sortableItems} strategy={verticalListSortingStrategy}>
            {cachedSummaries.length > 0 && (
              <div className={`rounded-lg border-l-4 ${BLOCK_STYLES.stable.border} border border-border-subtle bg-surface transition`}>
                <details open>
                <summary className={`p-2 cursor-pointer ${BLOCK_STYLES.stable.bg} ${BLOCK_STYLES.stable.text} text-sm font-medium flex items-center gap-2 rounded-tr-lg`}>
                  <ChevronRight className="w-4 h-4 group-open:rotate-90 transition-transform duration-fast" />
                  <Layers className="w-4 h-4" />
                  Cached Block ({cachedSummaries.length})
                  <span className={`${BLOCK_STYLES.stable.textLight} font-normal`}>~{cachedTokens.toLocaleString()} tok</span>
                  <span className="text-content-muted font-normal text-xs ml-auto">
                    {pinnedSummaries.length > 0 && `${pinnedSummaries.length} pinned`}
                    {pinnedSummaries.length > 0 && autoRolledSummaries.length > 0 && ' + '}
                    {autoRolledSummaries.length > 0 && `${autoRolledSummaries.length} auto-rolled`}
                  </span>
                </summary>
                <div className="p-2 space-y-3">
                  {pinnedSummaries.length > 0 && (
                    <div className="border border-emerald-500/30 rounded-md bg-emerald-500/5">
                      <div className="px-2 py-1 text-xs font-medium text-emerald-400 border-b border-emerald-500/20 flex items-center gap-1">
                        <span>📌 Pinned ({pinnedSummaries.length})</span>
                        <span className="text-content-muted font-normal ml-auto">User froze these</span>
                      </div>
                      <div className="p-2 space-y-2">
                        {pinnedSummaries.map((s) => (
                          <DraggableSummary key={s.id} summary={s} tier={3} isSelected={selectedSummaries.has(s.id)} onToggle={toggleSummarySelection} formatTime={formatTime} isHighlighted={false} onMoveFromCached={handleUnpin} isMoving={isPinningSummary} onPromote={handlePromote} onDemote={handleDemote} isPromoting={isPromotingSummary} />
                        ))}
                      </div>
                    </div>
                  )}
                  {autoRolledSummaries.length > 0 && (
                    <div className="border border-sky-500/30 rounded-md bg-sky-500/5">
                      <div className="px-2 py-1 text-xs font-medium text-sky-400 border-b border-sky-500/20 flex items-center gap-1">
                        <span>🔄 Auto-rolled ({autoRolledSummaries.length})</span>
                        <span className="text-content-muted font-normal ml-auto">Boundary moved to prefix</span>
                      </div>
                      <div className="p-2 space-y-2">
                        {autoRolledSummaries.map((s) => (
                          <DraggableSummary key={s.id} summary={s} tier={4} isAutoRolled={true} isSelected={selectedSummaries.has(s.id)} onToggle={toggleSummarySelection} formatTime={formatTime} isHighlighted={false} onMoveToCached={handlePin} isMoving={isPinningSummary} onPromote={handlePromote} onDemote={handleDemote} isPromoting={isPromotingSummary} />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </details>
            </div>
            )}

            {/* Dynamic Tail */}
            <div className={`rounded-lg border-l-4 ${BLOCK_STYLES.fresh.border} border border-border-subtle bg-surface transition`}>
              <details open>
              <summary className={`p-2 cursor-pointer ${BLOCK_STYLES.fresh.bg} ${BLOCK_STYLES.fresh.text} text-sm font-medium flex items-center gap-2 rounded-tr-lg`}>
                <ChevronRight className="w-4 h-4 group-open:rotate-90 transition-transform duration-fast" />
                <ScrollText className="w-4 h-4" />
                Dynamic Tail ({tailSummaries.length})
                <span className={`${BLOCK_STYLES.fresh.textLight} font-normal`}>
                  {tailTokens.toLocaleString()} / {tailThresholdValue.toLocaleString()} tok
                  {rollProgress >= 80 && (
                    <span className="text-warning font-normal ml-1">Roll soon</span>
                  )}
                </span>
                <span className="text-content-muted font-normal text-xs ml-auto">
                  {tailSummaries.length === 0 ? 'All summaries in cached prefix' : 'Summaries after boundary (uncached)'}
                </span>
              </summary>
              <div className="p-2 space-y-2">
                {tailSummaries.length === 0 ? (
                  <div className="text-content-muted text-xs italic p-2 text-center">No summaries in tail - boundary has rolled all to prefix</div>
                ) : (
                  tailSummaries.map((s) => (
                    <DraggableSummary key={s.id} summary={s} tier={4} isSelected={selectedSummaries.has(s.id)} onToggle={toggleSummarySelection} formatTime={formatTime} isHighlighted={false} onMoveToCached={handlePin} isMoving={isPinningSummary} onPromote={handlePromote} onDemote={handleDemote} isPromoting={isPromotingSummary} onArchive={handleArchive} isArchiving={isArchivingSummary} />
                  ))
                )}
              </div>
            </details>
          </div>
          </SortableContext>
          <DragOverlay>
            {dragOverlaySummary && (
              <div className="max-w-xl">
                <SummaryItem summary={dragOverlaySummary} isSelected={false} onToggle={() => {}} formatTime={formatTime} showCheckbox={false} />
              </div>
            )}
          </DragOverlay>
        </DndContext>

        {archivedSummaries.length > 0 && (
          <details className={`rounded-lg border-l-4 ${BLOCK_STYLES.archive.border} border border-border-subtle bg-surface`}>
            <summary className={`p-2 cursor-pointer ${BLOCK_STYLES.archive.bg} ${BLOCK_STYLES.archive.text} text-sm font-medium flex items-center gap-2 rounded-tr-lg`}>
              <ChevronRight className="w-4 h-4 group-open:rotate-90 transition-transform duration-fast" />
              <Library className="w-4 h-4" />
              RAG Archive ({archivedSummaries.length})
              <span className={`${BLOCK_STYLES.archive.textLight} font-normal`}>~{archivedTokens.toLocaleString()} tok</span>
              <span className="text-content-muted font-normal text-xs ml-auto cursor-help" title="These consolidated summaries are searchable via RAG. When Claude's current context is semantically similar to an archived summary, it can be retrieved and included in the prompt.">
                Searchable via semantic similarity (RAG)
              </span>
            </summary>
            <div className="p-2 space-y-2">
              {archivedSummaries.map((s) => (
                <SummaryItem key={s.id} summary={s} isSelected={selectedSummaries.has(s.id)} onToggle={toggleSummarySelection} formatTime={formatTime} tier="archived" onActivate={handleActivate} isArchiving={isArchivingSummary} />
              ))}
            </div>
          </details>
        )}
        {summaries.length === 0 && archivedSummaries.length === 0 && (
          <div className="p-4 text-content-muted italic text-center">No summaries yet</div>
        )}
      </div>
    </SectionCard>
  );
}
