/**
 * Editor View
 *
 * @module views/EditorView
 * @description Tabbed editor: Branches | Overrides | Synthetic.
 * - Branch list with active indicator (dot + glow).
 * - Override list with type icons and undo.
 * - Synthetic list with dashed borders.
 *
 * @antipattern Do NOT fetch data here — store slices handle fetching.
 * @antipattern Do NOT define domain types locally.
 * @antipattern Do NOT use raw hex colors.
 *
 * @upstream Called by: AppShell (when activeView === 'editor')
 * @downstream Calls: store slices for branches, overrides, synthetics
 */

import { useState, useEffect } from 'react';
import { LoadingSkeleton } from '../components/ui';
import { useAppStore } from '../store';

type EditorTab = 'branches' | 'overrides' | 'synthetic';

export function EditorView() {
  const [tab, setTab] = useState<EditorTab>('branches');

  // Store reads
  const branches = useAppStore((s) => s.branches) as any[];
  const activeBranch = useAppStore((s) => s.activeBranch) as string;
  const syntheticMemories = useAppStore((s) => s.syntheticMemories) as any[];
  const isLoading = useAppStore((s) => s.isLoading) as boolean;
  const error = useAppStore((s) => s.error) as string | null;
  const clearError = useAppStore((s) => s.clearError) as (() => void) | undefined;

  // Actions
  const switchBranch = useAppStore((s) => s.switchBranch) as (name: string) => Promise<void>;
  const createBranch = useAppStore((s) => s.createBranch) as (name?: string, desc?: string) => Promise<void>;
  const newBranchName = useAppStore((s) => s.newBranchName) as string;
  const setNewBranchName = useAppStore((s) => s.setNewBranchName) as (name: string) => void;

  // Fetch editor data on mount
  const fetchTabData = useAppStore((s) => s.fetchTabData) as (tab: string) => Promise<void>;
  useEffect(() => { fetchTabData('editor'); }, [fetchTabData]);

  const tabs: { key: EditorTab; label: string }[] = [
    { key: 'branches', label: 'Branches' },
    { key: 'overrides', label: 'Overrides' },
    { key: 'synthetic', label: 'Synthetic' },
  ];

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      overflow: 'hidden',
      backgroundColor: 'var(--background)',
    }}>
      {/* Tab bar */}
      <div style={{
        display: 'flex',
        borderBottom: '1px solid var(--border-subtle)',
        flexShrink: 0,
      }}>
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              flex: 1,
              padding: 'var(--spacing-sm) var(--spacing-md)',
              border: 'none',
              borderBottom: tab === t.key ? '2px solid var(--accent)' : '2px solid transparent',
              backgroundColor: 'transparent',
              color: tab === t.key ? 'var(--text-primary)' : 'var(--text-secondary)',
              cursor: 'pointer',
              fontSize: '0.8125rem',
              fontWeight: 500,
              minHeight: '44px',
              transition: 'all var(--duration-normal) ease-out',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Error state */}
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
          flexShrink: 0,
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

      {/* Tab content */}
      <div style={{ flex: 1, overflow: 'auto', padding: 'var(--spacing-md)' }}>
        {tab === 'branches' && (
          <BranchesPanel
            branches={branches}
            activeBranch={activeBranch}
            isLoading={isLoading}
            onSwitch={switchBranch}
            newBranchName={newBranchName}
            onNewBranchNameChange={setNewBranchName}
            onCreate={() => createBranch()}
          />
        )}

        {tab === 'overrides' && (
          <OverridesPanel activeBranch={activeBranch} />
        )}

        {tab === 'synthetic' && (
          <SyntheticPanel
            items={syntheticMemories}
            isLoading={isLoading}
          />
        )}
      </div>
    </div>
  );
}

/** Branches panel with active indicator. */
function BranchesPanel({
  branches, activeBranch, isLoading, onSwitch, newBranchName, onNewBranchNameChange, onCreate,
}: {
  branches: any[]; activeBranch: string; isLoading: boolean;
  onSwitch: (name: string) => void;
  newBranchName: string; onNewBranchNameChange: (v: string) => void;
  onCreate: () => void;
}) {
  if (isLoading && branches.length === 0) {
    return <LoadingSkeleton variant="rows" count={3} rowHeight={56} />;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
      {/* New branch form */}
      <div style={{ display: 'flex', gap: 'var(--spacing-sm)', alignItems: 'center' }}>
        <input
          type="text"
          value={newBranchName}
          onChange={(e) => onNewBranchNameChange(e.target.value)}
          placeholder="New branch name..."
          style={{
            flex: 1,
            padding: 'var(--spacing-sm)',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--border)',
            backgroundColor: 'var(--surface)',
            color: 'var(--text-primary)',
            fontSize: '0.8125rem',
          }}
        />
        <button
          onClick={onCreate}
          disabled={!newBranchName.trim()}
          style={{
            padding: 'var(--spacing-sm) var(--spacing-md)',
            borderRadius: 'var(--radius-sm)',
            border: 'none',
            backgroundColor: 'var(--accent)',
            color: 'var(--text-primary)',
            cursor: newBranchName.trim() ? 'pointer' : 'not-allowed',
            fontSize: '0.8125rem',
            opacity: newBranchName.trim() ? 1 : 0.5,
            minHeight: '44px',
          }}
        >
          Create
        </button>
      </div>

      {/* Branch list */}
      {branches.length === 0 && !isLoading && (
        <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 'var(--spacing-lg)' }}>
          No branches created yet.
        </div>
      )}

      {branches.map((branch: any) => {
        const isActive = branch.name === activeBranch;
        return (
          <button
            key={branch.name}
            onClick={() => onSwitch(branch.name)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--spacing-sm)',
              padding: 'var(--spacing-sm) var(--spacing-md)',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid ' + (isActive ? 'var(--accent)' : 'var(--border-subtle)'),
              backgroundColor: isActive ? 'var(--surface-raised)' : 'var(--surface)',
              color: 'var(--text-primary)',
              cursor: 'pointer',
              textAlign: 'left',
              width: '100%',
              minHeight: '44px',
            }}
          >
            {/* Active indicator dot */}
            <div style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: isActive ? 'var(--accent)' : 'transparent',
              border: isActive ? 'none' : '1px solid var(--border)',
              boxShadow: isActive ? '0 0 6px var(--accent)' : 'none',
              flexShrink: 0,
            }} />

            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '0.875rem', fontWeight: isActive ? 600 : 400 }}>
                {branch.name}
              </div>
              {branch.description && (
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                  {branch.description}
                </div>
              )}
            </div>

            {/* Metadata */}
            <div style={{
              fontSize: '0.6875rem',
              color: 'var(--text-muted)',
              fontFamily: '"JetBrains Mono", monospace',
            }}>
              {branch.override_count ?? 0} overrides
            </div>
          </button>
        );
      })}
    </div>
  );
}

/** Overrides panel with type icons and undo. */
function OverridesPanel({ activeBranch }: { activeBranch: string }) {
  // Overrides are part of the history/branch system.
  // Full implementation will read overrides from the editor store.
  // TODO: Add loading/empty/error tri-state pattern when overrides data is wired up.
  return (
    <div style={{
      color: 'var(--text-muted)',
      textAlign: 'center',
      padding: 'var(--spacing-xl)',
      fontSize: '0.875rem',
    }}>
      Memory overrides for branch "{activeBranch}".
      <br />
      <span style={{ fontSize: '0.8125rem' }}>
        Use the Memory view to exclude/edit entries — they appear here as overrides.
      </span>
    </div>
  );
}

/** Synthetic memories panel with dashed borders. */
function SyntheticPanel({ items, isLoading }: { items: any[]; isLoading: boolean }) {
  if (isLoading && items.length === 0) {
    return <LoadingSkeleton variant="rows" count={3} rowHeight={56} />;
  }

  if (items.length === 0) {
    return (
      <div style={{
        color: 'var(--text-muted)',
        textAlign: 'center',
        padding: 'var(--spacing-xl)',
        fontSize: '0.875rem',
      }}>
        No synthetic memories. These are injected memories that don't exist in canonical history.
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-sm)' }}>
      {items.map((item: any) => (
        <div
          key={item.id}
          style={{
            padding: 'var(--spacing-sm) var(--spacing-md)',
            borderRadius: 'var(--radius-sm)',
            border: '2px dashed var(--border)',
            backgroundColor: 'var(--surface)',
          }}
        >
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 'var(--spacing-xs)' }}>
            {item.type || item.memory_type || 'synthetic'} — #{item.id}
          </div>
          <div style={{ fontSize: '0.8125rem', color: 'var(--text-primary)', lineHeight: 1.5 }}>
            {(item.content || '').slice(0, 200)}
            {(item.content || '').length > 200 && '...'}
          </div>
        </div>
      ))}
    </div>
  );
}

export default EditorView;
