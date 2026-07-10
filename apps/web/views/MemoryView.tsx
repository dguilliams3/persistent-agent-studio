/**
 * Memory View
 *
 * @module views/MemoryView
 * @description Memory management with Summarize/Manage toggle.
 * - Summarize mode: entry count input, model dropdown, max tokens, go button.
 * - Manage mode: the full MemoryTab manager (sidebar/strip nav, tier management,
 *   consolidation, ContextBar token visualization, RAG preview).
 * - Panel mode (isPanel=true): MemoryTab renders its horizontal section strip.
 * - Full-screen mode (isPanel=false): MemoryTab renders its vertical sidebar (md+).
 *
 * History note: after the icon-rail overhaul this view briefly shipped its own
 * anemic read-only list renderer while the fully-built MemoryTab sat unmounted;
 * the list also read `entry.content || entry.text` which post-Drizzle summaries
 * do not have (they carry `.summary`), rendering blank cards. Both defects were
 * fixed by mounting MemoryTab here (RUN-20260704-1520).
 *
 * @antipattern Do NOT fetch data here beyond the mount kick — store slices own fetching.
 * @antipattern Do NOT define domain types locally.
 * @antipattern Do NOT use raw hex colors — use CSS custom properties.
 *
 * @upstream Called by: AppShell (when activeView === 'memory')
 * @downstream Calls: MemoryTab (manage mode), store slices for summarize config + errors
 */

import { useState, useEffect } from 'react';
import { useAppStore } from '../store';
import MemoryTab from '../components/tabs/MemoryTab';

/** Memory view sub-modes. */
type MemoryMode = 'summarize' | 'manage';

export interface MemoryViewProps {
  /**
   * Whether this view is rendering inside a narrow panel (280-400px).
   * Threaded to MemoryTab, which swaps its sidebar for a horizontal strip.
   */
  isPanel?: boolean;
}

/** Shared timestamp formatter for memory entries. */
function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleString();
}

/**
 * MemoryView — the memory management section.
 *
 * Manage mode mounts the full MemoryTab manager. Summarize mode provides the
 * compress-history trigger. Fetch failures surface through the store `error`
 * state (set by the data-slice fetchers) so "failed to load" is visibly
 * distinct from "no data yet".
 */
export function MemoryView({ isPanel = false }: MemoryViewProps) {
  const [mode, setMode] = useState<MemoryMode>('manage');

  // Error surface (set by data-slice fetchers on failure)
  const error = useAppStore((s) => s.error) as string | null;
  const clearError = useAppStore((s) => s.clearError) as (() => void) | undefined;

  // Summarize config from store
  const summarizeDefaultCountInput = useAppStore((s) => s.summarizeDefaultCountInput) as string;
  const summaryMaxTokensInput = useAppStore((s) => s.summaryMaxTokensInput) as string;
  const sumModel = useAppStore((s) => s.sumModel) as string;
  const setSummarizeDefaultCountInput = useAppStore((s) => s.setSummarizeDefaultCountInput) as (v: string) => void;
  const setSummaryMaxTokensInput = useAppStore((s) => s.setSummaryMaxTokensInput) as (v: string) => void;
  const triggerSummarize = useAppStore((s) => s.triggerSummarize) as ((count: number) => Promise<void>) | undefined;

  /** Fetch memory data on mount (covers rehydrated-into-memory loads where setActiveTab never fires). */
  const fetchTabData = useAppStore((s) => s.fetchTabData) as (tab: string) => Promise<void>;
  useEffect(() => { fetchTabData('memory'); }, [fetchTabData]);

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      overflow: 'hidden',
      backgroundColor: 'var(--background)',
    }}>
      {/* Mode toggle */}
      <div style={{
        display: 'flex',
        gap: 'var(--spacing-xs)',
        padding: 'var(--spacing-md)',
        borderBottom: '1px solid var(--border-subtle)',
      }}>
        {(['summarize', 'manage'] as MemoryMode[]).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            aria-pressed={mode === m}
            style={{
              flex: 1,
              padding: 'var(--spacing-sm) var(--spacing-md)',
              borderRadius: 'var(--radius-md)',
              border: mode === m ? '1px solid var(--accent)' : '1px solid var(--border)',
              backgroundColor: mode === m ? 'var(--accent-soft)' : 'transparent',
              color: mode === m ? 'var(--accent)' : 'var(--text-secondary)',
              cursor: 'pointer',
              fontSize: '0.8125rem',
              fontWeight: 500,
              transition: 'all var(--duration-normal) ease-out',
              minHeight: '44px',
            }}
          >
            {m === 'summarize' ? 'Summarize' : 'Manage'}
          </button>
        ))}
      </div>

      {/* Error state — distinct from empty states, dismissible */}
      {error && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: 'var(--spacing-sm) var(--spacing-md)',
          backgroundColor: 'var(--surface)',
          borderBottom: '1px solid var(--danger)',
          color: 'var(--danger)',
          fontSize: '0.8125rem',
        }}>
          <span>{error}</span>
          {clearError && (
            <button
              onClick={clearError}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: 'var(--text-muted)', padding: 'var(--spacing-xs)',
                minHeight: '44px', minWidth: '44px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
              aria-label="Dismiss error"
            >
              ✕
            </button>
          )}
        </div>
      )}

      {/* Content */}
      <div style={{ flex: 1, overflow: 'auto', padding: 'var(--spacing-md)' }}>
        {mode === 'summarize' && (
          <SummarizePanel
            entryCount={summarizeDefaultCountInput}
            maxTokens={summaryMaxTokensInput}
            model={sumModel}
            onEntryCountChange={setSummarizeDefaultCountInput}
            onMaxTokensChange={setSummaryMaxTokensInput}
            onSummarize={() => {
              const count = parseInt(summarizeDefaultCountInput, 10) || 50;
              triggerSummarize?.(count);
            }}
            isPanel={isPanel}
          />
        )}

        {mode === 'manage' && (
          <MemoryTab formatTime={formatTime} isPanel={isPanel} />
        )}
      </div>
    </div>
  );
}

/** Summarize mode panel. */
function SummarizePanel({
  entryCount, maxTokens, model, onEntryCountChange, onMaxTokensChange, onSummarize, isPanel,
}: {
  entryCount: string; maxTokens: string; model: string;
  onEntryCountChange: (v: string) => void;
  onMaxTokensChange: (v: string) => void;
  onSummarize: () => void;
  isPanel?: boolean;
}) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: 'var(--spacing-md)',
      maxWidth: isPanel ? '100%' : '480px',
    }}>
      <div style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
        Compress recent history entries into summaries.
      </div>

      <label style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-xs)' }}>
        <span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>Entry count</span>
        <input
          type="number"
          value={entryCount}
          onChange={(e) => onEntryCountChange(e.target.value)}
          min={10}
          max={100}
          style={{
            padding: 'var(--spacing-sm)',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--border)',
            backgroundColor: 'var(--surface)',
            color: 'var(--text-primary)',
            fontSize: '0.875rem',
          }}
        />
      </label>

      <label style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-xs)' }}>
        <span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>Max tokens</span>
        <input
          type="number"
          value={maxTokens}
          onChange={(e) => onMaxTokensChange(e.target.value)}
          min={500}
          max={7500}
          style={{
            padding: 'var(--spacing-sm)',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--border)',
            backgroundColor: 'var(--surface)',
            color: 'var(--text-primary)',
            fontSize: '0.875rem',
          }}
        />
      </label>

      <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
        Model: {model}
      </div>

      <button
        onClick={onSummarize}
        style={{
          padding: 'var(--spacing-sm) var(--spacing-lg)',
          borderRadius: 'var(--radius-md)',
          border: 'none',
          backgroundColor: 'var(--accent)',
          color: 'var(--text-primary)',
          cursor: 'pointer',
          fontSize: '0.875rem',
          fontWeight: 500,
          minHeight: '44px',
          alignSelf: 'flex-start',
        }}
      >
        Summarize {entryCount} entries
      </button>
    </div>
  );
}

export default MemoryView;
