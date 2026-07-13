/**
 * Overrides Panel
 *
 * @module views/EditorView/OverridesPanel
 * @description Read-only audit trail for branch overrides with per-row undo.
 * Fetches the active branch's override rows, surfaces a loading/empty/error
 * state, and replays the branch-state refresh event after a successful undo.
 *
 * @upstream Called by: EditorView
 * @downstream Calls: api.get('/memory/overrides'), api.delete('/memory/override/:id')
 */

import { useCallback, useEffect, useState } from 'react';
import { LoadingSkeleton } from '../../components/ui';
import api, { getAdminPassword } from '../../api/client';
import type { MemoryOverrideRow } from '../../components/chat/mergeThread';

const MEMORY_OVERRIDES_CHANGED_EVENT = 'memory-overrides-changed';

interface OverridesResponse {
  overrides?: MemoryOverrideRow[];
  branchName?: string | null;
}

export function OverridesPanel({ activeBranch }: { activeBranch: string }) {
  const [overrides, setOverrides] = useState<MemoryOverrideRow[]>([]);
  const [branchName, setBranchName] = useState(activeBranch);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [undoingId, setUndoingId] = useState<number | null>(null);

  const loadOverrides = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await api.get<OverridesResponse>('/memory/overrides');
      setOverrides(data.overrides || []);
      setBranchName((data.branchName as string | null) || activeBranch);
    } catch (loadError: unknown) {
      setOverrides([]);
      setError(
        `Failed to load overrides: ${
          loadError instanceof Error ? loadError.message : String(loadError)
        }`,
      );
    } finally {
      setIsLoading(false);
    }
  }, [activeBranch]);

  useEffect(() => {
    void loadOverrides();
  }, [loadOverrides]);

  const handleUndo = useCallback(
    async (overrideId: number) => {
      const password = getAdminPassword();
      if (!password) {
        return;
      }

      setUndoingId(overrideId);
      setError(null);

      try {
        await api.delete(`/memory/override/${overrideId}`, { password });
        window.dispatchEvent(new Event(MEMORY_OVERRIDES_CHANGED_EVENT));
        await loadOverrides();
      } catch (undoError: unknown) {
        setError(
          `Failed to undo override ${overrideId}: ${
            undoError instanceof Error ? undoError.message : String(undoError)
          }`,
        );
      } finally {
        setUndoingId(null);
      }
    },
    [loadOverrides],
  );

  const branchLabel = branchName || activeBranch;

  return (
    <section
      aria-busy={isLoading}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--spacing-md)',
      }}
    >
      <header style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-xs)' }}>
        <div style={{ color: 'var(--text-primary)', fontSize: '0.9375rem', fontWeight: 600 }}>
          Memory overrides for branch &quot;{branchLabel}&quot;
        </div>
        <div style={{ color: 'var(--text-muted)', fontSize: '0.8125rem' }}>
          Undo removes a single override and refreshes the chat branch state.
        </div>
      </header>

      {error && (
        <div
          role="alert"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 'var(--spacing-md)',
            padding: 'var(--spacing-sm) var(--spacing-md)',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--danger)',
            backgroundColor: 'var(--surface-raised)',
            color: 'var(--danger)',
            fontSize: '0.8125rem',
          }}
        >
          <span>{error}</span>
          <button
            type="button"
            onClick={() => void loadOverrides()}
            style={{
              border: 'none',
              borderRadius: 'var(--radius-sm)',
              backgroundColor: 'var(--accent)',
              color: 'var(--text-primary)',
              cursor: 'pointer',
              minHeight: '36px',
              padding: '0 var(--spacing-md)',
            }}
          >
            Retry
          </button>
        </div>
      )}

      {isLoading && overrides.length === 0 ? (
        <LoadingSkeleton variant="rows" count={3} rowHeight={64} />
      ) : overrides.length === 0 ? (
        <div
          style={{
            color: 'var(--text-muted)',
            textAlign: 'center',
            padding: 'var(--spacing-xl)',
            fontSize: '0.875rem',
          }}
        >
          No overrides yet. Edits, excludes, and reorders will show up here.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-sm)' }}>
          {overrides.map((override) => (
            <article
              key={override.id}
              aria-label={`Override ${override.id}`}
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 'var(--spacing-sm)',
                padding: 'var(--spacing-md)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-subtle)',
                backgroundColor: 'var(--surface)',
              }}
            >
              <div style={{ display: 'flex', gap: 'var(--spacing-sm)', alignItems: 'flex-start' }}>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 'var(--spacing-xs)' }}>
                  <div style={{ color: 'var(--text-primary)', fontSize: '0.875rem', fontWeight: 600 }}>
                    <span style={{ marginRight: 'var(--spacing-xs)' }}>{overrideGlyph(override)}</span>
                    {describeOverride(override)}
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: 'var(--spacing-xs) var(--spacing-sm)',
                      color: 'var(--text-muted)',
                      fontSize: '0.75rem',
                    }}
                  >
                    <span>#{override.id}</span>
                    <span>{override.override_type}</span>
                    <span>{override.target_table}</span>
                    <span>row {override.target_id}</span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => void handleUndo(override.id)}
                  disabled={undoingId === override.id}
                  aria-label={`Undo override ${override.id}`}
                  style={{
                    minHeight: '36px',
                    padding: '0 var(--spacing-md)',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border-subtle)',
                    backgroundColor: 'var(--surface-raised)',
                    color: 'var(--text-primary)',
                    cursor: undoingId === override.id ? 'wait' : 'pointer',
                    opacity: undoingId === override.id ? 0.7 : 1,
                    flexShrink: 0,
                  }}
                >
                  {undoingId === override.id ? 'Undoing…' : 'Undo'}
                </button>
              </div>

              <div style={{ color: 'var(--text-secondary)', fontSize: '0.8125rem', lineHeight: 1.5 }}>
                {summarizeOverrideData(override)}
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function describeOverride(override: MemoryOverrideRow): string {
  if (override.override_type === 'exclude') {
    return 'Excluded from the branch view';
  }

  if (override.override_type === 'reorder') {
    return 'Reordered within the branch';
  }

  if (override.override_type === 'edit') {
    return 'Edited branch copy of a history row';
  }

  return 'Branch override';
}

function overrideGlyph(override: MemoryOverrideRow): string {
  if (override.override_type === 'exclude') {
    return '⊘';
  }
  if (override.override_type === 'reorder') {
    return '⇅';
  }
  if (override.override_type === 'edit') {
    return '✎';
  }
  return '•';
}

function summarizeOverrideData(override: MemoryOverrideRow): string {
  if (override.override_type === 'exclude') {
    return 'This row is hidden from the branch thread.';
  }

  if (override.override_type === 'reorder') {
    return 'This row has a branch-local sort position.';
  }

  if (override.override_type !== 'edit' || !override.override_data) {
    return 'This row has branch-local edits applied.';
  }

  try {
    const data = JSON.parse(override.override_data) as {
      content?: string;
      type?: string;
      internal?: string;
    };
    const updates = [
      data.content !== undefined ? 'content' : null,
      data.type !== undefined ? 'type' : null,
      data.internal !== undefined ? 'internal' : null,
    ].filter((value): value is string => value !== null);

    if (updates.length === 0) {
      return 'This edit override has no parsed fields.';
    }

    return `Updated ${updates.join(', ')}.`;
  } catch {
    return 'This edit override could not be parsed.';
  }
}
