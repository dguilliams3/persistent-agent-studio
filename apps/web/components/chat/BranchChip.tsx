/**
 * Branch Chip — branch state on the chat surface
 *
 * @module components/chat/BranchChip
 * @description Small header chip showing the active memory branch and its
 * injected-synthetic count. Tapping opens a dropdown to swap branches
 * (activate), create a new one, and toggle Edit-history mode — the switch
 * that turns the thread itself into the memory editor (insertion points
 * between messages, pencils on bubbles).
 *
 * Before this, branch state lived only in the Editor tab: the chat never
 * said which timeline you were watching, so injected memories and rewinds
 * changed nothing on the surface being filmed (FB top finding,
 * RUN-20260711-1939).
 *
 * @upstream Called by: ChatView header row
 * @downstream Calls: api /branches, /branches/:name/activate, POST /branches
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import api from '../../api/client';

interface BranchRow {
  name: string;
  is_active?: number;
  description?: string | null;
}

export interface BranchChipProps {
  /** Active branch name (owned by ChatView so the thread can react). */
  activeBranch: string;
  /** Count of synthetics on the active branch (shown in the chip). */
  syntheticCount: number;
  /** Edit-history mode flag + toggle (owned by ChatView). */
  editMode: boolean;
  onToggleEditMode: () => void;
  /** Called after a branch switch or creation so ChatView can refresh. */
  onBranchChanged: () => void;
}

export function BranchChip({
  activeBranch,
  syntheticCount,
  editMode,
  onToggleEditMode,
  onBranchChanged,
}: BranchChipProps) {
  const [open, setOpen] = useState(false);
  const [branches, setBranches] = useState<BranchRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const rootRef = useRef<HTMLDivElement>(null);

  const refresh = useCallback(async () => {
    try {
      const data = (await api.get('/branches')) as { branches?: BranchRow[] };
      setBranches(data.branches || []);
    } catch {
      /* chip degrades to label-only */
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const activate = async (name: string) => {
    if (name === activeBranch || busy) return;
    setBusy(true);
    try {
      await api.put(`/branches/${encodeURIComponent(name)}/activate`);
      onBranchChanged();
      await refresh();
      setOpen(false);
    } catch {
      /* keep dropdown open; state unchanged */
    } finally {
      setBusy(false);
    }
  };

  const create = async () => {
    const name = newName.trim();
    if (!name || busy) return;
    setBusy(true);
    try {
      await api.post('/branches', { name });
      await api.put(`/branches/${encodeURIComponent(name)}/activate`);
      setNewName('');
      setCreating(false);
      onBranchChanged();
      await refresh();
      setOpen(false);
    } catch {
      /* leave form open */
    } finally {
      setBusy(false);
    }
  };

  const onMain = activeBranch === 'main';

  return (
    <div ref={rootRef} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen((p) => !p)}
        aria-expanded={open}
        aria-label={`Memory branch: ${activeBranch}`}
        title="Memory branch — tap to swap or edit history"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          padding: '2px 10px',
          borderRadius: '999px',
          border: `1px solid ${onMain ? 'var(--border-subtle)' : 'var(--accent)'}`,
          background: onMain
            ? 'transparent'
            : 'color-mix(in srgb, var(--accent) 12%, transparent)',
          color: onMain ? 'var(--text-muted)' : 'var(--accent)',
          fontSize: '0.75rem',
          cursor: 'pointer',
          whiteSpace: 'nowrap',
        }}
      >
        <span aria-hidden>⑂</span>
        <span>{activeBranch}</span>
        {syntheticCount > 0 && (
          <span
            style={{
              padding: '0 6px',
              borderRadius: '999px',
              background: 'color-mix(in srgb, var(--accent) 22%, transparent)',
              fontSize: '0.6875rem',
            }}
            title={`${syntheticCount} injected memor${syntheticCount === 1 ? 'y' : 'ies'}`}
          >
            +{syntheticCount}
          </span>
        )}
        {editMode && (
          <span aria-hidden title="Edit-history mode on">
            ✎
          </span>
        )}
      </button>

      {open && (
        <div
          role="menu"
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            left: 0,
            zIndex: 40,
            minWidth: '220px',
            padding: 'var(--spacing-xs)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-subtle)',
            background: 'var(--surface-raised)',
            boxShadow: 'var(--shadow-lg)',
          }}
        >
          <div
            style={{
              padding: '4px 8px',
              fontSize: '0.6875rem',
              color: 'var(--text-muted)',
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
            }}
          >
            Memory branches
          </div>
          {branches.map((b) => (
            <button
              key={b.name}
              role="menuitem"
              onClick={() => void activate(b.name)}
              disabled={busy}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                width: '100%',
                padding: '6px 8px',
                border: 'none',
                borderRadius: 'var(--radius-sm)',
                background:
                  b.name === activeBranch
                    ? 'color-mix(in srgb, var(--accent) 14%, transparent)'
                    : 'transparent',
                color: 'var(--text-primary)',
                fontSize: '0.8125rem',
                cursor: b.name === activeBranch ? 'default' : 'pointer',
                textAlign: 'left',
              }}
            >
              <span style={{ width: '14px', textAlign: 'center' }}>
                {b.name === activeBranch ? '●' : ''}
              </span>
              <span style={{ flex: 1 }}>{b.name}</span>
            </button>
          ))}

          {creating ? (
            <div style={{ display: 'flex', gap: '4px', padding: '6px 8px' }}>
              <input
                autoFocus
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void create();
                  if (e.key === 'Escape') setCreating(false);
                }}
                placeholder="branch name"
                style={{
                  flex: 1,
                  minWidth: 0,
                  padding: '4px 6px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border-subtle)',
                  background: 'var(--surface)',
                  color: 'var(--text-primary)',
                  fontSize: '0.8125rem',
                }}
              />
              <button
                onClick={() => void create()}
                disabled={busy || !newName.trim()}
                style={{
                  padding: '4px 8px',
                  borderRadius: 'var(--radius-sm)',
                  border: 'none',
                  background: 'var(--accent)',
                  color: 'white',
                  fontSize: '0.75rem',
                  cursor: 'pointer',
                }}
              >
                Create
              </button>
            </div>
          ) : (
            <button
              role="menuitem"
              onClick={() => setCreating(true)}
              style={{
                display: 'block',
                width: '100%',
                padding: '6px 8px',
                border: 'none',
                borderRadius: 'var(--radius-sm)',
                background: 'transparent',
                color: 'var(--text-secondary)',
                fontSize: '0.8125rem',
                cursor: 'pointer',
                textAlign: 'left',
              }}
            >
              ＋ New branch…
            </button>
          )}

          <div
            style={{
              margin: '4px 0',
              borderTop: '1px solid var(--border-subtle)',
            }}
          />
          <button
            role="menuitemcheckbox"
            aria-checked={editMode}
            onClick={() => {
              onToggleEditMode();
              setOpen(false);
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              width: '100%',
              padding: '6px 8px',
              border: 'none',
              borderRadius: 'var(--radius-sm)',
              background: 'transparent',
              color: editMode ? 'var(--accent)' : 'var(--text-secondary)',
              fontSize: '0.8125rem',
              cursor: 'pointer',
              textAlign: 'left',
            }}
          >
            <span style={{ width: '14px', textAlign: 'center' }}>✎</span>
            <span style={{ flex: 1 }}>
              {editMode ? 'Done editing history' : 'Edit history…'}
            </span>
          </button>
        </div>
      )}
    </div>
  );
}

export default BranchChip;
