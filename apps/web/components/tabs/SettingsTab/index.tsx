/**
 * Settings Tab Component — Slim Coordinator
 *
 * @module components/tabs/SettingsTab
 * @description Configuration and control panel for the Claude Existence Loop.
 *
 * Decomposed from 1,723-line god file into:
 * - useSettingsTabState.ts — All Zustand store selectors and mount effects
 * - SettingsSections.tsx — ControlsSectionContent, CostTogglesSection, StatusSection
 * - SummarizationSection.tsx — Summarization settings + PromptTemplateEditor
 * - RagConfigSection.tsx — RAG retrieval configuration
 * - Existing: SettingsSection, ModelSelector, DangerZone, ToolRegistryPanel
 *
 * @upstream Called by:
 *   - ClaudeExistenceLoop.jsx - Renders when activeTab === 'settings'
 * @downstream Calls:
 *   - useSettingsTabState hook
 *   - Section sub-components
 *
 * @example
 * <SettingsTab MODEL_OPTIONS={MODEL_OPTIONS} formatTimeShort={formatTimeShort} />
 */

import {
  Cpu,
  Clock,
  FileStack,
  BarChart3,
  User,
  Database,
  AlertTriangle,
  Play,
  Users,
} from 'lucide-react';
import { PersonaSelector } from '../../common/PersonaSelector';
import SettingsSection from './SettingsSection';
import ModelSelector from './ModelSelector';
import DangerZone from './DangerZone';
import ToolRegistryPanel from './ToolRegistryPanel';
import { useSettingsTabState } from './useSettingsTabState';
import { ControlsSectionContent, CostTogglesSection, StatusSection } from './SettingsSections';
import SummarizationSection from './SummarizationSection';
import RagConfigSection from './RagConfigSection';

// =============================================================================
// MAIN COMPONENT
// =============================================================================

/** Default model options matching ModelSelector metadata keys. */
const DEFAULT_MODEL_OPTIONS: Array<{ id: string; label: string }> = [
  { id: 'claude-haiku-4-5-20251001', label: 'Haiku (Fast)' },
  { id: 'claude-sonnet-4-6-20250514', label: 'Sonnet (Balanced)' },
  { id: 'claude-opus-4-6', label: 'Opus (Capable)' },
];

/** Default short time formatter. */
function defaultFormatTimeShort(time: string): string {
  try {
    return new Date(time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return time;
  }
}

export interface SettingsTabProps {
  MODEL_OPTIONS?: Array<{ id: string; label: string }>;
  formatTimeShort?: (time: string) => string;
}

/**
 * @description Settings tab with all configuration options.
 * Slim coordinator that delegates to useSettingsTabState hook and section components.
 *
 * @upstream Called by: ClaudeExistenceLoop.jsx
 * @downstream Calls: useSettingsTabState, section sub-components
 */
export default function SettingsTab({
  MODEL_OPTIONS = DEFAULT_MODEL_OPTIONS,
  formatTimeShort = defaultFormatTimeShort,
}: SettingsTabProps) {
  const s = useSettingsTabState();

  // Don't render until state is loaded
  if (!s.state) {
    return (
      <div className="card p-4 text-center">
        <div className="text-content-muted">Loading settings...</div>
      </div>
    );
  }

  return (
    // h-full + overflow-y-auto is LOAD-BEARING: this tab renders directly
    // inside the shell's overflow:hidden content area (mobile full-screen and
    // laptop panel). Without its own scroll container everything below the
    // fold is simply clipped — "Settings shows up but I can't scroll on it"
    // (RUN-20260704-1520).
    <div className="h-full overflow-y-auto space-y-4 p-4">
      {/* Loop Controls */}
      <SettingsSection title="Loop Controls" icon={Play} defaultOpen={true}>
        <ControlsSectionContent
          state={s.state}
          isThinking={s.isThinking}
          startLoop={s.startLoop}
          stopLoop={s.stopLoop}
          triggerThinkNow={s.triggerThinkNow}
          cycleStats={s.cycleStats}
        />
      </SettingsSection>

      {/* Persona Selection */}
      <SettingsSection title="Active Persona" icon={Users} defaultOpen={true}>
        <div className="flex items-center gap-4">
          <PersonaSelector showCreateButton={true} />
        </div>
      </SettingsSection>

      {/* Model & Interval Settings */}
      <SettingsSection title="Model & Timing" icon={Cpu} description="Select Claude model and cycle interval" defaultOpen={true}>
        <div className="space-y-4">
          <div>
            <label className="text-xs text-content-muted mb-2 block">Model</label>
            <ModelSelector options={MODEL_OPTIONS} value={s.selectedModel} onChange={s.setSelectedModel} />
          </div>
          <div className="flex items-center gap-3 pt-2 border-t border-border-subtle">
            <Clock size={16} className="text-content-muted" />
            <span className="text-sm text-content-muted">Cycle every</span>
            <input type="number" value={s.cycleIntervalInput} onChange={(e) => s.setCycleIntervalInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && s.updateCycleInterval()} className="input-sm w-20 text-center" />
            <span className="text-sm text-content-muted">seconds</span>
            <button onClick={s.updateCycleInterval} className="btn-primary px-3 py-1.5 text-xs">Set</button>
          </div>
        </div>
      </SettingsSection>

      {/* Summarization Settings */}
      <SettingsSection title="Summarization" icon={FileStack} description="History compression settings" defaultOpen={false}>
        <SummarizationSection
          state={s.state}
          summarizeThresholdInput={s.summarizeThresholdInput}
          setSummarizeThresholdInput={s.setSummarizeThresholdInput}
          updateSummarizeSettings={s.updateSummarizeSettings}
          isSummarizing={s.isSummarizing}
          summarizeSuccess={s.summarizeSuccess}
          triggerSummarize={s.triggerSummarize}
          summaryMaxTokensInput={s.summaryMaxTokensInput}
          setSummaryMaxTokensInput={s.setSummaryMaxTokensInput}
          updateSummaryMaxTokens={s.updateSummaryMaxTokens}
          metaSummaryMaxTokensInput={s.metaSummaryMaxTokensInput}
          setMetaSummaryMaxTokensInput={s.setMetaSummaryMaxTokensInput}
          updateMetaSummaryMaxTokens={s.updateMetaSummaryMaxTokens}
          sumProvider={s.sumProvider}
          sumModel={s.sumModel}
          sumAvailableModels={s.sumAvailableModels}
          sumProviderStatus={s.sumProviderStatus}
          sumModelSaving={s.sumModelSaving}
          updateSumModel={s.updateSumModel}
          summarizationStats={s.summarizationStats}
          metaReasoningEffort={s.metaReasoningEffort}
          reasoningEffortOptions={s.reasoningEffortOptions}
          updateMetaReasoningEffort={s.updateMetaReasoningEffort}
          summarizeDefaultCountInput={s.summarizeDefaultCountInput}
          setSummarizeDefaultCountInput={s.setSummarizeDefaultCountInput}
          updateSummarizeDefaultCount={s.updateSummarizeDefaultCount}
        />
      </SettingsSection>

      {/* Cost Stats & Toggles */}
      <SettingsSection title="Cost & Features" icon={BarChart3} description="Usage stats and feature toggles" defaultOpen={false}>
        <CostTogglesSection
          cycleStatsLimit={s.cycleStatsLimit}
          setCycleStatsLimit={s.setCycleStatsLimit}
          fetchCycleStats={s.fetchCycleStats}
          cycleStats={s.cycleStats}
          formatTimeShort={formatTimeShort}
          batchEnabled={s.batchEnabled}
          batchMinutes={s.batchMinutes}
          setBatchMinutes={s.setBatchMinutes}
          toggleBatchWithTimer={s.toggleBatchWithTimer}
          streamingEnabled={s.streamingEnabled}
          toggleStreaming={s.toggleStreaming}
          showProfilePic={s.showProfilePic}
          setShowProfilePic={s.setShowProfilePic}
        />
      </SettingsSection>

      {/* Status Settings */}
      <SettingsSection title="Status & Limits" icon={User} description="The user's status and token limits" defaultOpen={false}>
        <StatusSection
          userStatusInput={s.userStatusInput}
          setUserStatusInput={s.setUserStatusInput}
          userStatus={s.userStatus}
          updateUserStatus={s.updateUserStatus}
          sleepStatus={s.sleepStatus}
          wakeUp={s.wakeUp}
          maxTokensInput={s.maxTokensInput}
          setMaxTokensInput={s.setMaxTokensInput}
          updateMaxTokens={s.updateMaxTokens}
        />
      </SettingsSection>

      {/* RAG Configuration */}
      <SettingsSection title="RAG Configuration" icon={Database} description="Semantic retrieval settings" defaultOpen={false}>
        <RagConfigSection
          ragEnabled={s.ragEnabled}
          setRagEnabled={s.setRagEnabled}
          ragTopK={s.ragTopK}
          setRagTopK={s.setRagTopK}
          ragHalflife={s.ragHalflife}
          setRagHalflife={s.setRagHalflife}
          ragMinSimilarity={s.ragMinSimilarity}
          setRagMinSimilarity={s.setRagMinSimilarity}
          ragMmrLambda={s.ragMmrLambda}
          setRagMmrLambda={s.setRagMmrLambda}
          ragWeights={s.ragWeights}
          setRagWeights={s.setRagWeights}
          ragConfig={s.ragConfig}
          isSavingRag={s.isSavingRag}
          updateRagConfig={s.updateRagConfig}
        />
      </SettingsSection>

      {/* Tool Registry Snapshot */}
      <SettingsSection title="Tool Registry" icon={FileStack} description="Live list of every tool injected into the prompt." defaultOpen={false}>
        <ToolRegistryPanel />
      </SettingsSection>

      {/* Danger Zone */}
      <SettingsSection title="Danger Zone" icon={AlertTriangle} variant="danger" defaultOpen={false}>
        <DangerZone onResetAll={() => { const pw = window.prompt('Enter admin password to reset:'); if (pw) s.resetAll(pw); }} onResetRag={s.resetRagConfig} />
      </SettingsSection>
    </div>
  );
}
