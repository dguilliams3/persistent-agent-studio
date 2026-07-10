/**
 * Summarization Section Component
 *
 * @module components/tabs/SettingsTab/SummarizationSection
 * @description Summarization threshold, manual triggers, advanced settings,
 * model selection, and prompt template editing.
 *
 * @upstream Called by: SettingsTab index
 * @downstream Calls: PromptTemplateEditor, Select, useAppStore
 */

import { useState, useEffect } from 'react';
import { ChevronDown, FileText, Layers } from 'lucide-react';
import { useAppStore } from '../../../store';
import { Select } from '../../ui';

interface ProviderStatus {
  label: string;
  envKeyName: string;
  available: boolean;
  reason?: string;
}

// =============================================================================
// PROMPT TEMPLATE EDITOR (internal to summarization)
// =============================================================================

function PromptTemplateEditor() {
  const [isExpanded, setIsExpanded] = useState(false);

  const promptTemplates = useAppStore((s) => s.promptTemplates);
  const promptTemplatesLoading = useAppStore((s) => s.promptTemplatesLoading);
  const selectedPromptType = useAppStore((s) => s.selectedPromptType);
  const promptEditorText = useAppStore((s) => s.promptEditorText);
  const promptEditorDirty = useAppStore((s) => s.promptEditorDirty);
  const promptSaving = useAppStore((s) => s.promptSaving);

  const fetchPromptTemplates = useAppStore((s) => s.fetchPromptTemplates);
  const setSelectedPromptType = useAppStore((s) => s.setSelectedPromptType);
  const setPromptEditorText = useAppStore((s) => s.setPromptEditorText);
  const savePromptTemplate = useAppStore((s) => s.savePromptTemplate);
  const resetPromptTemplate = useAppStore((s) => s.resetPromptTemplate);
  const discardPromptChanges = useAppStore((s) => s.discardPromptChanges);

  useEffect(() => {
    if (isExpanded && !promptTemplates) {
      fetchPromptTemplates();
    }
  }, [isExpanded, promptTemplates, fetchPromptTemplates]);

  const promptTypeOptions = [
    { value: 'summarize_instructions', label: 'Summarize Instructions' },
    { value: 'summarize_system', label: 'Summarize System Prompt' },
    { value: 'meta_instructions', label: 'Meta-Summarize Instructions' },
    { value: 'meta_system', label: 'Meta-Summarize System Prompt' },
  ];

  const getIsCustom = () => {
    if (!promptTemplates) return false;
    switch (selectedPromptType) {
      case 'summarize_system': return promptTemplates.summarize?.isCustomSystem || false;
      case 'summarize_instructions': return promptTemplates.summarize?.isCustomInstructions || false;
      case 'meta_system': return promptTemplates.meta?.isCustomSystem || false;
      case 'meta_instructions': return promptTemplates.meta?.isCustomInstructions || false;
      default: return false;
    }
  };

  const isCustom = getIsCustom();

  const handlePromptTypeChange = (newType: string) => {
    if (promptEditorDirty) {
      if (window.confirm('You have unsaved changes. Discard them?')) {
        discardPromptChanges();
        setSelectedPromptType(newType);
      }
    } else {
      setSelectedPromptType(newType);
    }
  };

  return (
    <div className="mt-3">
      <button onClick={() => setIsExpanded(!isExpanded)} className="w-full flex items-center justify-between px-3 py-2 bg-depth hover:bg-surface rounded-lg transition-colors text-sm">
        <span className="flex items-center gap-2 text-content-secondary">
          <FileText size={14} />
          Prompt Templates
          {promptTemplates && (
            <span className="text-xs text-content-muted">
              ({promptTemplates.summarize?.isCustomSystem || promptTemplates.summarize?.isCustomInstructions ||
                promptTemplates.meta?.isCustomSystem || promptTemplates.meta?.isCustomInstructions
                ? 'customized' : 'defaults'})
            </span>
          )}
        </span>
        <ChevronDown size={14} className={`text-content-muted transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
      </button>

      {isExpanded && (
        <div className="mt-2 p-3 bg-surface rounded-lg border border-surface space-y-3">
          {promptTemplatesLoading ? (
            <div className="text-center text-content-muted py-4">Loading prompts...</div>
          ) : (
            <>
              <div className="flex items-center gap-3">
                <label className="text-sm text-content-secondary whitespace-nowrap">Edit:</label>
                <select value={selectedPromptType} onChange={(e) => handlePromptTypeChange(e.target.value)} className="flex-1 input text-sm">
                  {promptTypeOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
                {isCustom && <span className="text-xs badge-accent px-2 py-0.5 rounded">Custom</span>}
              </div>

              <textarea value={promptEditorText} onChange={(e) => setPromptEditorText(e.target.value)} className="w-full h-48 input text-sm font-mono resize-y" placeholder="Enter prompt template..." spellCheck={false} />

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {promptEditorDirty && <span className="text-xs text-warning">Unsaved changes</span>}
                </div>
                <div className="flex items-center gap-2">
                  {promptEditorDirty && <button onClick={discardPromptChanges} className="btn-ghost text-xs px-2 py-1" disabled={promptSaving}>Discard</button>}
                  {isCustom && !promptEditorDirty && <button onClick={resetPromptTemplate} className="btn-ghost text-xs px-2 py-1" disabled={promptSaving} title="Reset to default prompt">Reset to Default</button>}
                  <button onClick={savePromptTemplate} className="btn-primary text-xs px-3 py-1" disabled={promptSaving || !promptEditorDirty}>{promptSaving ? 'Saving...' : 'Save'}</button>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// =============================================================================
// SUMMARIZATION SECTION
// =============================================================================

interface SummarizationSectionProps {
  state: Record<string, any>;
  summarizeThresholdInput: string;
  setSummarizeThresholdInput: (v: string) => void;
  updateSummarizeSettings: (threshold?: string, auto?: boolean) => void;
  isSummarizing: boolean;
  summarizeSuccess: boolean;
  triggerSummarize: (...args: any[]) => void | Promise<void>;
  summaryMaxTokensInput: string;
  setSummaryMaxTokensInput: (v: string) => void;
  updateSummaryMaxTokens: () => void;
  metaSummaryMaxTokensInput: string;
  setMetaSummaryMaxTokensInput: (v: string) => void;
  updateMetaSummaryMaxTokens: () => void;
  sumProvider: string;
  sumModel: string;
  sumAvailableModels: Record<string, any> | null;
  sumProviderStatus: Record<string, ProviderStatus> | null;
  sumModelSaving: boolean;
  updateSumModel: (provider: string, model: string) => void;
  summarizationStats: Record<string, any> | null;
  metaReasoningEffort: string;
  reasoningEffortOptions: string[];
  updateMetaReasoningEffort: (effort: string) => void;
  summarizeDefaultCountInput: string;
  setSummarizeDefaultCountInput: (v: string) => void;
  updateSummarizeDefaultCount: () => void;
}

export default function SummarizationSection({
  state,
  summarizeThresholdInput, setSummarizeThresholdInput, updateSummarizeSettings,
  isSummarizing, summarizeSuccess, triggerSummarize,
  summaryMaxTokensInput, setSummaryMaxTokensInput, updateSummaryMaxTokens,
  metaSummaryMaxTokensInput, setMetaSummaryMaxTokensInput, updateMetaSummaryMaxTokens,
  sumProvider, sumModel, sumAvailableModels, sumProviderStatus, sumModelSaving, updateSumModel,
  summarizationStats, metaReasoningEffort, reasoningEffortOptions, updateMetaReasoningEffort,
  summarizeDefaultCountInput, setSummarizeDefaultCountInput, updateSummarizeDefaultCount,
}: SummarizationSectionProps) {
  const [showRunDetails, setShowRunDetails] = useState(false);
  const [advancedExpanded, setAdvancedExpanded] = useState(false);
  const threshold = state?.summarizeThreshold || 30;
  const historyCount = state?.activeHistoryCount || 0;
  const isOverThreshold = historyCount > threshold;
  const isNearThreshold = historyCount > threshold * 0.8;
  const fillPercent = Math.min(100, (historyCount / threshold) * 100);
  const providerOrder = ['openai', 'anthropic', 'deepseek', 'kimi'];

  const providerStatusEntries = Object.entries(sumProviderStatus || {}).sort(
    ([left], [right]) =>
      providerOrder.indexOf(left) - providerOrder.indexOf(right),
  );

  const providerOptions =
    providerStatusEntries.length > 0
      ? providerStatusEntries.map(([providerId, status]) => ({
          value: providerId,
          label: status.available
            ? status.label
            : `${status.label} (${status.reason || `missing ${status.envKeyName}`})`,
          disabled: !status.available,
          title: status.available
            ? `Uses ${status.envKeyName}`
            : `Unavailable until ${status.envKeyName} is configured`,
        }))
      : [
          { value: 'openai', label: 'OpenAI' },
          { value: 'anthropic', label: 'Anthropic' },
        ];

  const activeProviderStatus = sumProviderStatus?.[sumProvider] || null;
  const isActiveProviderUnavailable = !!activeProviderStatus && !activeProviderStatus.available;
  const activeProviderReason = activeProviderStatus?.reason || null;

  const modelOptions = sumAvailableModels?.[sumProvider]
    ? (() => {
        const raw = Object.entries(sumAvailableModels[sumProvider]);
        const dedup = Array.from(
          raw.reduce((map, [alias, fullName]) => {
            if (!map.has(fullName)) {
              map.set(fullName, alias);
            }
            return map;
          }, new Map()),
        );

        return dedup.map(([fullName, alias]) => ({
          value: fullName as string,
          label:
            alias === fullName ? (fullName as string) : `${alias as string} (${fullName as string})`,
        }));
      })()
    : [{ value: sumModel, label: sumModel }];

  return (
    <div className="space-y-3">
      {/* Row 1: History count, threshold, auto-summarize, manual trigger */}
      <div className="card flex items-center gap-4 text-sm flex-wrap p-3">
        <div className="flex items-center gap-2" title="Active history entries waiting to be summarized">
          <span className="text-content-muted">History:</span>
          <div className="flex items-center gap-1">
            <span className={`font-mono ${isOverThreshold ? 'text-danger' : isNearThreshold ? 'text-warning' : 'text-content-primary'}`}>{historyCount}</span>
            <span className="text-content-muted">/</span>
            <span className="text-content-secondary">{threshold}</span>
          </div>
          <div className="w-16 h-1.5 bg-depth rounded-full overflow-hidden">
            <div className={`h-full transition-all ${isOverThreshold ? 'bg-danger' : isNearThreshold ? 'bg-warning' : 'bg-success'}`} style={{ width: `${fillPercent}%` }} />
          </div>
          {isOverThreshold && <span className="text-danger text-xs animate-pulse">needs summarization</span>}
        </div>

        <div className="flex items-center gap-2">
          <span className="text-content-muted">Threshold:</span>
          <input type="number" value={summarizeThresholdInput} onChange={(e) => setSummarizeThresholdInput(e.target.value)} onBlur={() => updateSummarizeSettings(summarizeThresholdInput, state.autoSummarize)} onKeyDown={(e) => e.key === 'Enter' && updateSummarizeSettings(summarizeThresholdInput, state.autoSummarize)} className="input-sm w-16 text-center" min="10" max="100" />
        </div>

        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={state.autoSummarize || false} onChange={(e) => updateSummarizeSettings(summarizeThresholdInput, e.target.checked)} className="w-5 h-5 sm:w-4 sm:h-4 rounded bg-depth border-border-subtle text-warning focus:ring-semantic-warning" />
          <span className="text-content-secondary">Auto</span>
        </label>

        <div className="flex items-center gap-2">
          <button onClick={() => triggerSummarize()} disabled={isSummarizing || historyCount < 5} title={isSummarizing ? 'Summarization in progress...' : (summarizeSuccess ?? false) ? 'Summarization completed successfully!' : 'Compress oldest entries into a single summary'} className={`btn-primary px-3 py-1 text-xs disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 ${isSummarizing ? 'bg-warning animate-pulse' : (summarizeSuccess ?? false) ? 'bg-success animate-pulse' : 'bg-warning hover:bg-warning/90'}`}>
            {isSummarizing ? <span className="flex items-center gap-1"><span className="animate-spin">⏳</span>Summarizing...</span> : (summarizeSuccess ?? false) ? <span className="flex items-center gap-1"><span>✅</span>Done!</span> : 'Summarize'}
          </button>
        </div>
      </div>

      {/* Row 2: Advanced settings */}
      <div className="card text-sm p-3">
        <button onClick={() => setAdvancedExpanded(!advancedExpanded)} className="flex items-center gap-2 w-full text-left group">
          <span className={`text-content-muted transition-transform ${advancedExpanded ? 'rotate-90' : ''}`}>▶</span>
          <span className="text-content-secondary group-hover:text-content-primary transition-colors">Advanced</span>
          {!advancedExpanded && (
            <span className="text-content-muted font-mono text-xs ml-2">[{summarizeDefaultCountInput} entries │ {Math.round(Number(summaryMaxTokensInput) / 1000)}K/{Math.round(Number(metaSummaryMaxTokensInput) / 1000)}K tokens]</span>
          )}
        </button>
        <div className={`overflow-hidden transition-all duration-200 ${advancedExpanded ? 'max-h-48 opacity-100 mt-3' : 'max-h-0 opacity-0'}`}>
          <div className="flex flex-wrap items-center gap-4 pt-2 border-t border-border-subtle">
            <div className="flex items-center gap-2" title="Default number of entries to summarize">
              <span className="text-content-muted">Default count:</span>
              <input type="number" value={summarizeDefaultCountInput} onChange={(e) => setSummarizeDefaultCountInput(e.target.value)} onBlur={updateSummarizeDefaultCount} onKeyDown={(e) => e.key === 'Enter' && updateSummarizeDefaultCount()} className="input-sm w-16 text-center" min="10" max="100" />
              <span className="text-content-muted text-xs">(10-100)</span>
            </div>
            <div className="flex items-center gap-2" title="Max tokens when compressing history entries">
              <span className="text-content-muted">Compress max:</span>
              <input type="number" value={summaryMaxTokensInput} onChange={(e) => setSummaryMaxTokensInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && updateSummaryMaxTokens()} className="input-sm w-20 text-center" min="500" max="7500" />
              <button onClick={updateSummaryMaxTokens} className="btn-secondary px-2 py-1 text-xs">Set</button>
            </div>
            <div className="flex items-center gap-2" title="Max tokens when consolidating multiple summaries">
              <span className="text-content-muted">Consolidate max:</span>
              <input type="number" value={metaSummaryMaxTokensInput} onChange={(e) => setMetaSummaryMaxTokensInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && updateMetaSummaryMaxTokens()} className="input-sm w-20 text-center" min="500" max="7500" />
              <button onClick={updateMetaSummaryMaxTokens} className="btn-secondary px-2 py-1 text-xs">Set</button>
            </div>
          </div>
        </div>
      </div>

      {/* Row 3: Model selection and reasoning effort */}
      <div className="card flex items-center gap-4 text-sm flex-wrap p-3">
        <span className="text-content-secondary font-medium" title="Model used for summarizing history">Summarization Model:</span>
        <Select value={sumProvider} onChange={(newProvider) => { const defaultModel = sumAvailableModels?.[newProvider] ? Object.values(sumAvailableModels[newProvider])[0] : null; if (defaultModel) updateSumModel(newProvider, String(defaultModel)); }} options={providerOptions} size="sm" disabled={sumModelSaving} />
        <Select value={sumModel} onChange={(newModel) => { const models = sumAvailableModels?.[sumProvider] || {}; const alias = Object.entries(models).find(([, fullName]) => fullName === newModel)?.[0] || newModel; updateSumModel(sumProvider, alias); }} options={modelOptions} size="sm" disabled={sumModelSaving || isActiveProviderUnavailable} />
        {sumModelSaving && <span className="text-content-muted text-xs">Saving...</span>}
        {isActiveProviderUnavailable && (
          <span className="text-warning text-xs">
            Unavailable: {activeProviderReason || `missing ${activeProviderStatus?.envKeyName}`}
          </span>
        )}

        {sumProvider === 'openai' && (
          <>
            <div className="border-l border-border-subtle h-4 mx-1" />
            <span className="text-content-muted text-xs" title="Reasoning effort for meta-summarization">Meta Reasoning:</span>
            <Select value={metaReasoningEffort || 'low'} onChange={(newEffort) => updateMetaReasoningEffort(newEffort)} options={(reasoningEffortOptions || ['none', 'low', 'medium', 'high']).map(effort => ({ value: effort, label: effort.charAt(0).toUpperCase() + effort.slice(1) }))} size="sm" disabled={sumModelSaving} />
          </>
        )}
      </div>

      {/* Row 4: Last Summarization Run Details */}
      <div className="card p-0 overflow-hidden">
        <button onClick={() => setShowRunDetails(!showRunDetails)} className="w-full px-3 py-2 flex items-center justify-between text-sm hover:bg-depth transition-colors">
          <div className="flex items-center gap-2">
            <ChevronDown className={`w-4 h-4 text-content-muted transition-transform ${showRunDetails ? '' : '-rotate-90'}`} />
            <span className="text-content-secondary font-medium">Last Summarization Runs</span>
            {summarizationStats?.lastSummarize && (
              <span className="badge-muted text-xs">
                {new Date(summarizationStats.lastSummarize.timestamp).toLocaleDateString('en-US', { timeZone: 'America/New_York', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 text-xs text-content-muted">
            <span>History: {summarizationStats?.currentStats?.historyCount ?? '—'}/{summarizationStats?.currentStats?.summarizeThreshold ?? '—'}</span>
            <span>|</span>
            <span>Summaries: {summarizationStats?.currentStats?.summaryCount ?? '—'}/{summarizationStats?.currentStats?.metaThreshold ?? '—'}</span>
          </div>
        </button>

        {showRunDetails && (
          <div className="border-t border-border-subtle px-3 py-3 space-y-3 bg-surface">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-accent" />
                <span className="text-sm font-medium text-content-secondary">Last Summarize</span>
                {summarizationStats?.lastSummarize?.trigger && (
                  <span className={`badge-${summarizationStats.lastSummarize.trigger === 'auto' ? 'success' : 'muted'} text-xs`}>{summarizationStats.lastSummarize.trigger}</span>
                )}
              </div>
              {summarizationStats?.lastSummarize ? (
                <div className="ml-6 text-xs space-y-1">
                  <div className="flex flex-wrap gap-x-4 gap-y-1">
                    <span className="text-content-muted"><span className="text-content-secondary">When:</span> {new Date(summarizationStats.lastSummarize.timestamp).toLocaleString('en-US', { timeZone: 'America/New_York', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true })} EST</span>
                    <span className="text-content-muted"><span className="text-content-secondary">Entries:</span> {summarizationStats.lastSummarize.entriesIncluded}/{summarizationStats.lastSummarize.entriesOffered} included</span>
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1">
                    <span className="text-content-muted"><span className="text-content-secondary">Model:</span> {summarizationStats.lastSummarize.provider}/{summarizationStats.lastSummarize.model?.split('-').slice(-1)[0] || summarizationStats.lastSummarize.model}</span>
                    <span className="text-content-muted"><span className="text-content-secondary">Duration:</span> {summarizationStats.lastSummarize.durationMs ? `${(summarizationStats.lastSummarize.durationMs / 1000).toFixed(1)}s` : '—'}</span>
                    {summarizationStats.lastSummarize.timeRange && <span className="text-content-muted"><span className="text-content-secondary">Range:</span> {summarizationStats.lastSummarize.timeRange}</span>}
                  </div>
                </div>
              ) : (
                <div className="ml-6 text-xs text-content-muted italic">No summarization runs yet</div>
              )}
            </div>
            <div className="border-t border-border-subtle" />
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-warning" />
                <span className="text-sm font-medium text-content-secondary">Last Meta-Summarize</span>
                {summarizationStats?.lastMeta?.trigger && (
                  <span className={`badge-${summarizationStats.lastMeta.trigger === 'auto' ? 'success' : 'muted'} text-xs`}>{summarizationStats.lastMeta.trigger}</span>
                )}
                {summarizationStats?.lastMeta?.mode && (
                  <span className="badge-muted text-xs">{summarizationStats.lastMeta.mode === 'claude_driven' ? 'claude-selected' : 'manual'}</span>
                )}
              </div>
              {summarizationStats?.lastMeta ? (
                <div className="ml-6 text-xs space-y-1">
                  <div className="flex flex-wrap gap-x-4 gap-y-1">
                    <span className="text-content-muted"><span className="text-content-secondary">When:</span> {new Date(summarizationStats.lastMeta.timestamp).toLocaleString('en-US', { timeZone: 'America/New_York', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true })} EST</span>
                    <span className="text-content-muted"><span className="text-content-secondary">Consolidated:</span> {summarizationStats.lastMeta.summariesConsolidated} → 1 ({summarizationStats.lastMeta.summariesRemaining} remaining)</span>
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1">
                    <span className="text-content-muted"><span className="text-content-secondary">Model:</span> {summarizationStats.lastMeta.provider}/{summarizationStats.lastMeta.model?.split('-').slice(-1)[0] || summarizationStats.lastMeta.model}</span>
                    <span className="text-content-muted"><span className="text-content-secondary">Duration:</span> {summarizationStats.lastMeta.durationMs ? `${(summarizationStats.lastMeta.durationMs / 1000).toFixed(1)}s` : '—'}</span>
                    {summarizationStats.lastMeta.totalMessagesConsolidated && <span className="text-content-muted"><span className="text-content-secondary">Msgs covered:</span> {summarizationStats.lastMeta.totalMessagesConsolidated}</span>}
                  </div>
                </div>
              ) : (
                <div className="ml-6 text-xs text-content-muted italic">No meta-summarization runs yet</div>
              )}
            </div>
          </div>
        )}
      </div>

      <PromptTemplateEditor />
    </div>
  );
}
