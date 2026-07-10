/**
 * Memory Tab Component — Slim Coordinator
 *
 * @module components/tabs/MemoryTab
 * @description Displays all memory-related data: summaries, notebook, cold storage,
 * reminders, observations, learnings, and questions.
 *
 * This is a read-mostly tab - displays data from the backend memory systems.
 * The only write operation is metasummarize (consolidating summaries).
 *
 * Decomposed from 2,063-line god file into:
 * - useMemoryTabState.ts — Store selectors, local state, effects
 * - SummariesSection.tsx — Tier management, DnD, consolidation (~300 lines)
 * - SummaryItem.tsx — Individual summary with metadata pills (~290 lines)
 * - MemorySections.tsx — Notebook, ColdStorage, Reminders, Observations, Learnings, Questions
 * - SectionCard.tsx — Shared section wrapper
 * - EmptySection.tsx — Empty state placeholder
 * - constants.ts — Metadata styles, helpers (estimateTokens, parseJsonArray, parseMetadata)
 *
 * @upstream Called by:
 *   - views/MemoryView.tsx - Renders in manage mode (activeView === 'memory')
 * @downstream Calls:
 *   - useMemoryTabState hook
 *   - Section sub-components
 *   - Existing: BlockVisualization, ContextBar, MemorySidebar, MemorySectionStrip, RAGPreview
 *
 * Layout modes:
 * - Full-screen (isPanel=false): vertical MemorySidebar on md+, horizontal
 *   MemorySectionStrip below md (mobile previously had NO section nav at all).
 * - Panel (isPanel=true, laptop SplitView 280-400px): no sidebar, strip always —
 *   the sidebar's `hidden md:block` keys off the VIEWPORT, which is >1024px in
 *   panel mode, so without this the 224px sidebar would cram the panel.
 *
 * @example
 * <MemoryTab formatTime={formatTime} isPanel={false} />
 */

import { Snowflake, Bell } from 'lucide-react';
import { Accordion } from '../../ui';
import { useMemoryTabState } from './useMemoryTabState';
import SummariesSection from './SummariesSection';
import {
  NotebookSection,
  ColdStorageSection,
  RemindersSection,
  ObservationsSection,
  LearningsSection,
  QuestionsSection,
} from './MemorySections';
import EmptySection from './EmptySection';
import BlockVisualization from './BlockVisualization';
import ContextBar from './ContextBar';
import MemorySidebar, { MemorySectionStrip } from './MemorySidebar';
import RAGPreview from './RAGPreview';

// =============================================================================
// MAIN COMPONENT
// =============================================================================

interface MemoryTabProps {
  formatTime: (time: string) => string;
  /** Narrow-panel mode (laptop SplitView): section strip instead of sidebar. */
  isPanel?: boolean;
}

/**
 * @description Memory tab showing all stored memories and knowledge.
 * Slim coordinator that delegates to useMemoryTabState hook and section components.
 *
 * @upstream Called by: ClaudeExistenceLoop.jsx
 * @downstream Calls: useMemoryTabState, section sub-components
 */
export default function MemoryTab({ formatTime, isPanel = false }: MemoryTabProps) {
  const {
    summaries,
    archivedSummaries,
    notebook,
    coldStorage,
    reminders,
    observations,
    learned,
    questions,
    deleteLearning,
    selectedSummaries,
    setSelectedSummaries,
    isMetasummarizing,
    triggerMetasummarize,
    toggleSummarySelection,
    tokenBreakdown,
    contextLoading,
    ragResults,
    ragEnabled,
    ragConfig,
    activeSection,
    handleSectionChange,
    totalSummarizedEntries,
    sectionCounts,
  } = useMemoryTabState();

  return (
    <div className="space-y-4">
      {/* Compact Context Bar - shows token allocation at a glance */}
      <ContextBar tokenBreakdown={tokenBreakdown} loading={contextLoading} />

      {/* Two-column layout: Sidebar + Main Content (sidebar suppressed in panel mode) */}
      <div className="flex gap-6">
        {/* Sidebar - full-screen mode only, md+ viewports */}
        {!isPanel && (
          <div className="hidden md:block w-56 flex-shrink-0">
            <div className="sticky top-4">
              <MemorySidebar
                activeSection={activeSection}
                onSectionChange={handleSectionChange}
                counts={sectionCounts}
              />
            </div>
          </div>
        )}

        {/* Main content area - shows ONLY the active section */}
        <div className="flex-1 min-w-0">
          {/* Horizontal section strip: always in panel mode; mobile fallback otherwise
              (the sidebar above is viewport-gated, so below md there was no nav) */}
          <div className={isPanel ? 'mb-4' : 'md:hidden mb-4'}>
            <MemorySectionStrip
              activeSection={activeSection}
              onSectionChange={handleSectionChange}
              counts={sectionCounts}
            />
          </div>
          {/* Detailed Block Visualization */}
          {activeSection === 'summaries' && tokenBreakdown && (
            <Accordion title="Cache Structure Details" defaultOpen={false} className="mb-4">
              <BlockVisualization tokenBreakdown={tokenBreakdown} />
            </Accordion>
          )}

          {activeSection === 'summaries' && (
            <SummariesSection
              summaries={summaries}
              archivedSummaries={archivedSummaries}
              selectedSummaries={selectedSummaries}
              setSelectedSummaries={setSelectedSummaries}
              isMetasummarizing={isMetasummarizing}
              triggerMetasummarize={triggerMetasummarize}
              toggleSummarySelection={toggleSummarySelection}
              totalSummarizedEntries={totalSummarizedEntries}
              formatTime={formatTime}
            />
          )}

          {activeSection === 'notebook' && (
            <NotebookSection notebook={notebook} formatTime={formatTime} />
          )}

          {activeSection === 'coldStorage' && (
            coldStorage.length > 0 ? (
              <ColdStorageSection coldStorage={coldStorage} />
            ) : (
              <EmptySection title="Cold Storage" icon={Snowflake} message="No frozen memories yet" />
            )
          )}

          {activeSection === 'learned' && (
            <LearningsSection learned={learned} formatTime={formatTime} onDelete={deleteLearning} />
          )}

          {activeSection === 'questions' && (
            <QuestionsSection questions={questions} formatTime={formatTime} />
          )}

          {activeSection === 'observations' && (
            <ObservationsSection observations={observations} formatTime={formatTime} />
          )}

          {activeSection === 'reminders' && (
            reminders.length > 0 ? (
              <RemindersSection reminders={reminders} />
            ) : (
              <EmptySection title="Reminders" icon={Bell} message="No active reminders" />
            )
          )}

          {activeSection === 'rag' && (
            <RAGPreview
              ragResults={ragResults}
              ragEnabled={ragEnabled}
              loading={contextLoading}
              mmrLambda={ragConfig.mmrLambda}
            />
          )}
        </div>
      </div>
    </div>
  );
}
