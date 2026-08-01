/**
 * Realtime Voice Session Control Panel
 *
 * @module components/tabs/VoiceTab/components/RealtimeSessionPanel
 * @description UI control surface for starting and ending realtime voice
 * sessions via the worker API. This is a thin orchestration layer on top
 * of the voice slice so power users can validate OpenAI Realtime setup
 * without reaching for Telegram or raw HTTP calls.
 *
 * WHY THIS EXISTS:
 * - The realtime voice stack is only useful if there is an easy, visible
 *   E2E entrypoint in the web UI ("enter API key → start session → end session").
 * - Keeping this logic in a dedicated panel avoids cluttering the TTS UI while
 *   still surfacing session metadata (client_secret, sessionId, seed stats).
 *
 * HOW TO USE:
 * - Choose provider/model, pick seed mode, and click Start.
 * - Copy the client_secret and use it in a realtime client connection.
 * - Click End to log a session termination event in history.
 * - Review the Tool Registry snapshot (below) for up-to-date action guidance.
 *
 * ANTIPATTERNS:
 * - Do NOT store client_secret anywhere permanent; it should only be used
 *   to initialize a realtime client and is shown here for convenience.
 * - Do NOT assume a single model; allow custom overrides for experimentation.
 *
 * @note Fetches `/tool-registry` on mount so operators see the same metadata
 * injected into the system prompt and Telegram “tools” snapshot.
 * @upstream Called by:
 *   - VoiceTab/index.jsx
 * @downstream Calls:
 *   - Zustand voice slice (startRealtimeSession, endRealtimeSession)
 *   - Accordion + Select UI components
 */

import { useMemo, useState, useEffect } from 'react';
import { useAppStore } from '../../../../store';
import { Accordion, Select } from '../../../ui';
import { useToolRegistry } from '../../../../hooks/useToolRegistry';

const PROVIDER_OPTIONS = [
  { value: 'openai', label: 'OpenAI (Realtime)' },
];

const MODEL_OPTIONS = [
  { value: 'gpt-4o-realtime-preview', label: 'gpt-4o-realtime-preview' },
  { value: 'gpt-4o-realtime', label: 'gpt-4o-realtime' },
];

const SEED_MODE_OPTIONS = [
  { value: 'full', label: 'Full Seed (all blocks)' },
  { value: 'compact', label: 'Compact Seed (omit block4)' },
];

/**
 * @description Control panel for realtime session lifecycle management
 *
 * @upstream Called by: VoiceTab/index.jsx
 * @downstream Calls: Zustand voice slice actions
 *
 * @returns {JSX.Element} Realtime session controls and status panel
 */
export default function RealtimeSessionPanel({ isPanel = false }: { isPanel?: boolean }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [provider, setProvider] = useState('openai');
  const [model, setModel] = useState('gpt-4o-realtime-preview');
  const [customModel, setCustomModel] = useState('');
  const [seedMode, setSeedMode] = useState('full');
  const [includeSystemPrompt, setIncludeSystemPrompt] = useState(true);
  const [includeBlocks, setIncludeBlocks] = useState(true);
  const [endReason, setEndReason] = useState('');
  const [endSessionId, setEndSessionId] = useState('');
  const [endResult, setEndResult] = useState<any>(null);
  const [copyStatus, setCopyStatus] = useState('');

  const realtimeSession: any = useAppStore((s) => s.realtimeSession);
  const realtimeSessionLoading = useAppStore((s) => s.realtimeSessionLoading);
  const realtimeSessionError = useAppStore((s) => s.realtimeSessionError);
  const startRealtimeSession = useAppStore((s) => s.startRealtimeSession);
  const endRealtimeSession = useAppStore((s) => s.endRealtimeSession);
  const {
    tools: toolRegistry,
    loading: toolRegistryLoading,
    error: toolRegistryError,
    refresh: refreshToolRegistry
  } = useToolRegistry({ limit: 6 });

  useEffect(() => {
    if (realtimeSession?.sessionId) {
      setEndSessionId(realtimeSession.sessionId);
    }
  }, [realtimeSession?.sessionId]);

  const effectiveModel = useMemo(() => {
    const trimmed = customModel.trim();
    return trimmed.length > 0 ? trimmed : model;
  }, [customModel, model]);

  const seedSummary = useMemo(() => {
    if (!realtimeSession?.stats) return null;
    return [
      { label: 'History', value: realtimeSession.stats.historyCount },
      { label: 'Summaries', value: realtimeSession.stats.summariesCount },
      { label: 'Reminders', value: realtimeSession.stats.remindersCount },
      { label: 'Cold Storage', value: realtimeSession.stats.coldStorageCount },
      { label: 'Notebook', value: realtimeSession.stats.notebookCount },
    ];
  }, [realtimeSession?.stats]);

  const displayedTools = useMemo(() => toolRegistry || [], [toolRegistry]);

  const handleStart = async () => {
    setEndResult(null);
    const result: any = await startRealtimeSession({
      provider,
      model: effectiveModel,
      seedMode,
      includeSystemPrompt,
      includeBlocks,
    });
    if (result?.sessionId) {
      setEndSessionId(result.sessionId);
    }
  };

  const handleEnd = async () => {
    const result = await endRealtimeSession({
      sessionId: endSessionId || realtimeSession?.sessionId,
      reason: endReason || 'completed',
    });
    setEndResult(result || null);
  };

  const handleCopySecret = async () => {
    const secret = realtimeSession?.providerSession?.session?.client_secret;
    if (!secret) return;
    try {
      await navigator.clipboard.writeText(secret);
      setCopyStatus('Copied');
      setTimeout(() => setCopyStatus(''), 2000);
    } catch (err) {
      setCopyStatus('Copy failed');
      setTimeout(() => setCopyStatus(''), 2000);
      console.error('Failed to copy client secret:', err);
    }
  };

  return (
    <Accordion
      title={
        <span className="flex items-center gap-2">
          Realtime Session Controls
          <span className="badge-info">Beta</span>
        </span>
      }
      variant="card"
      isOpen={isExpanded}
      onToggle={setIsExpanded}
    >
      <div className="space-y-4 pt-2">
        <p className="text-sm text-content-muted">
          Start a realtime audio-to-audio session and retrieve the provider
          client_secret for a realtime client. End the session to log a clean
          termination event in history.
        </p>

        <div className={isPanel ? 'grid grid-cols-1 gap-3' : 'grid grid-cols-1 md:grid-cols-2 gap-3'}>
          <div>
            <label className="block text-xs font-medium text-content-secondary mb-1">
              Provider
            </label>
            <Select
              value={provider}
              onChange={setProvider}
              options={PROVIDER_OPTIONS}
              size="sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-content-secondary mb-1">
              Model
            </label>
            <Select
              value={model}
              onChange={setModel}
              options={MODEL_OPTIONS}
              size="sm"
              disabled={customModel.trim().length > 0}
            />
            <input
              type="text"
              value={customModel}
              onChange={(e) => setCustomModel(e.target.value)}
              placeholder="Custom model override (optional)"
              className="input text-xs mt-2"
            />
          </div>
        </div>

        <div className={isPanel ? 'grid grid-cols-1 gap-3' : 'grid grid-cols-1 md:grid-cols-2 gap-3'}>
          <div>
            <label className="block text-xs font-medium text-content-secondary mb-1">
              Seed Mode
            </label>
            <Select
              value={seedMode}
              onChange={setSeedMode}
              options={SEED_MODE_OPTIONS}
              size="sm"
            />
          </div>
          <div className="space-y-2">
            <label className="block text-xs font-medium text-content-secondary">
              Seed Contents
            </label>
            <div className="flex flex-col gap-2">
              <label className="flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={includeSystemPrompt}
                  onChange={(e) => setIncludeSystemPrompt(e.target.checked)}
                />
                Include system prompt
              </label>
              <label className="flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={includeBlocks}
                  onChange={(e) => setIncludeBlocks(e.target.checked)}
                />
                Include block breakdown
              </label>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={handleStart}
            disabled={realtimeSessionLoading}
            className="btn-primary text-sm px-4 py-2 disabled:opacity-50"
          >
            {realtimeSessionLoading ? 'Starting...' : 'Start Realtime Session'}
          </button>
          <button
            type="button"
            onClick={handleEnd}
            disabled={realtimeSessionLoading}
            className="btn-secondary text-sm px-4 py-2 disabled:opacity-50"
          >
            {realtimeSessionLoading ? 'Ending...' : 'End Session'}
          </button>
        </div>

        <div className="space-y-2 border border-surface rounded-md p-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-content-primary">
                Tool Registry Snapshot
              </p>
              <p className="text-xs text-content-muted">
                Mirrors the recipe cards injected into the system prompt.
              </p>
            </div>
            <button
              type="button"
              className="btn-ghost btn-xs"
              onClick={() => refreshToolRegistry()}
              disabled={toolRegistryLoading}
            >
              Refresh
            </button>
          </div>

          {toolRegistryLoading ? (
            <p className="text-xs text-content-secondary">Loading tool metadata…</p>
          ) : toolRegistryError ? (
            <p className="text-xs text-warning">
              Failed to load registry: {toolRegistryError}
            </p>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {displayedTools.map((tool: any) => (
                <div
                  key={tool.id}
                  className="border border-depth rounded-md p-2 bg-surface"
                >
                  <p className="text-xs font-semibold text-content-primary">
                    {tool.id}
                    {tool.category ? (
                      <span className="text-content-muted"> · {tool.category}</span>
                    ) : null}
                  </p>
                  {tool.prompt?.summary ? (
                    <p className="text-xs text-content-secondary">
                      {tool.prompt.summary}
                    </p>
                  ) : null}
                  {tool.prompt?.usage ? (
                    <p className="text-[10px] text-content-muted mt-1">
                      Usage: {tool.prompt.usage}
                    </p>
                  ) : null}
                  {tool.prompt?.examples?.length ? (
                    <p className="text-[10px] text-content-muted">
                      Example: {tool.prompt.examples[0]}
                    </p>
                  ) : null}
                </div>
              ))}
              {toolRegistry && toolRegistry.length > displayedTools.length ? (
                <p className="text-[10px] text-content-muted">
                  Showing {displayedTools.length} of {toolRegistry.length} tools. View
                  the rest via `/tool-registry`.
                </p>
              ) : null}
            </div>
          )}
        </div>

        {realtimeSessionError && (
          <div className="text-sm text-danger">
            {realtimeSessionError}
          </div>
        )}

        {realtimeSession?.success && (
          <div className="card bg-depth p-4 space-y-2">
            <div className="text-sm font-semibold">Session Details</div>
            <div className="text-xs text-content-muted space-y-1">
              <div>Session ID: {realtimeSession.sessionId}</div>
              <div>Provider: {realtimeSession.provider}</div>
              <div>Model: {realtimeSession.model}</div>
              <div>Seed mode: {seedMode}</div>
              {realtimeSession.costEstimate && (
                <div>
                  Est. seed cost: ${realtimeSession.costEstimate.totalUsd.toFixed(4)}
                </div>
              )}
            </div>

            {realtimeSession.providerSession?.session?.client_secret && (
              <div className="mt-3">
                <div className="text-xs font-medium text-content-secondary">
                  Client Secret
                </div>
                <div className={isPanel ? 'flex flex-col gap-2' : 'flex flex-col md:flex-row md:items-center gap-2'}>
                  <code className="text-xs bg-surface px-2 py-1 rounded break-all">
                    {realtimeSession.providerSession.session.client_secret}
                  </code>
                  <button
                    type="button"
                    onClick={handleCopySecret}
                    className="btn-secondary text-xs"
                  >
                    {copyStatus || 'Copy'}
                  </button>
                </div>
              </div>
            )}

            {seedSummary && (
              <div className="mt-3">
                <div className="text-xs font-medium text-content-secondary">
                  Seed Snapshot
                </div>
                <div className="flex flex-wrap gap-2 text-xs text-content-muted">
                  {seedSummary.map((item) => (
                    <span key={item.label} className="badge-muted">
                      {item.label}: {item.value}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        <div className={isPanel ? 'grid grid-cols-1 gap-3' : 'grid grid-cols-1 md:grid-cols-2 gap-3'}>
          <div>
            <label className="block text-xs font-medium text-content-secondary mb-1">
              End Session ID
            </label>
            <input
              type="text"
              value={endSessionId}
              onChange={(e) => setEndSessionId(e.target.value)}
              placeholder="Defaults to last started session"
              className="input text-xs"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-content-secondary mb-1">
              End Reason
            </label>
            <input
              type="text"
              value={endReason}
              onChange={(e) => setEndReason(e.target.value)}
              placeholder="completed"
              className="input text-xs"
            />
          </div>
        </div>

        {endResult?.success && (
          <div className="text-xs text-success">
            Session ended. {endResult.costEstimate ? `Cost estimate: $${endResult.costEstimate.totalUsd.toFixed(4)}.` : ''}
          </div>
        )}
      </div>
    </Accordion>
  );
}
