/**
 * Memory Edit Tools â€” the thread as the memory editor
 *
 * @module components/chat/MemoryEditTools
 * @description The two affordances of Edit-history mode:
 *
 * - InsertMemoryPoint: a slim "+ add memory" line between thread segments.
 *   Clicking opens an inline composer that creates a SYNTHETIC memory placed
 *   at the midpoint timestamp between its neighbors (POST /memory/synthetic).
 * - InlineMemoryEditor: swap-in editor for an existing bubble. Saving writes
 *   an EDIT OVERRIDE on the active branch (POST /memory/edit) â€” the
 *   canonical row is never touched; rewind = remove the override.
 *
 * Both render only in Edit-history mode (BranchChip toggle), so the normal
 * chat surface stays pristine and fully text-selectable.
 *
 * @upstream Called by: ChatView (edit-history mode)
 * @downstream Calls: api POST /memory/synthetic, POST /memory/edit
 * Tested by: `apps/web/components/chat/__tests__/MemoryEditTools.test.tsx`
 */

import { useState } from 'react';
import api from '../../api/client';
import { useAppStore } from '../../store';

const SYNTHETIC_TYPES = [
  { value: 'user_message', label: 'from you' },
  { value: 'message_to_user', label: 'from her' },
  { value: 'thought', label: 'a thought' },
];

// =============================================================================
// InsertMemoryPoint
// =============================================================================

export interface InsertMemoryPointProps {
  /** Bare UTC timestamp for the new synthetic (midpoint of the gap). */
  timestamp: string;
  /** Called after a successful insert so the thread can refresh. */
  onInserted: () => void;
}

export function InsertMemoryPoint({ timestamp, onInserted }: InsertMemoryPointProps) {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState('user_message');
  const [content, setContent] = useState('');
  const [busy, setBusy] = useState(false);
  const addLog = useAppStore((state) => state.addLog) as (message: string) => void;

  const insert = async () => {
    const text = content.trim();
    if (!text || busy) return;
    setBusy(true);
    try {
      await api.post('/memory/synthetic', { type, content: text, timestamp });
      setContent('');
      setOpen(false);
      onInserted();
    } catch (error: unknown) {
      addLog(`Error: Failed to add memory: ${error instanceof Error ? error.message : String(error)}`);
      /* keep composer open so nothing typed is lost */
    } finally {
      setBusy(false);
    }
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        aria-label="Insert a synthetic memory here"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--spacing-sm)',
          width: '100%',
          maxWidth: '640px',
          margin: '0 auto',
          padding: '2px 0',
          border: 'none',
          background: 'transparent',
          cursor: 'pointer',
          opacity: 0.45,
        }}
        onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
        onMouseLeave={(e) => (e.currentTarget.style.opacity = '0.45')}
      >
        <span style={{ flex: 1, borderTop: '1px dashed var(--accent)' }} />
        <span style={{ fontSize: '0.6875rem', color: 'var(--accent)', whiteSpace: 'nowrap' }}>
          ï¼‹ add memory
        </span>
        <span style={{ flex: 1, borderTop: '1px dashed var(--accent)' }} />
      </button>
    );
  }

  return (
    <div
      style={{
        maxWidth: '640px',
        margin: '0 auto',
        width: '100%',
        padding: 'var(--spacing-sm)',
        borderRadius: 'var(--radius-md)',
        border: '1px dashed var(--accent)',
        background: 'color-mix(in srgb, var(--accent) 6%, transparent)',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--spacing-xs)',
      }}
    >
      <div style={{ display: 'flex', gap: '6px' }}>
        {SYNTHETIC_TYPES.map((t) => (
          <button
            key={t.value}
            onClick={() => setType(t.value)}
            style={{
              padding: '2px 10px',
              borderRadius: '999px',
              border: `1px solid ${type === t.value ? 'var(--accent)' : 'var(--border-subtle)'}`,
              background: type === t.value ? 'color-mix(in srgb, var(--accent) 15%, transparent)' : 'transparent',
              color: type === t.value ? 'var(--accent)' : 'var(--text-muted)',
              fontSize: '0.75rem',
              cursor: 'pointer',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>
      <textarea
        autoFocus
        value={content}
        onChange={(e) => setContent(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) void insert();
          if (e.key === 'Escape') setOpen(false);
        }}
        placeholder="Write the memory that never happenedâ€¦"
        rows={3}
        style={{
          width: '100%',
          padding: 'var(--spacing-sm)',
          borderRadius: 'var(--radius-sm)',
          border: '1px solid var(--border-subtle)',
          background: 'var(--surface)',
          color: 'var(--text-primary)',
          fontSize: '0.875rem',
          resize: 'vertical',
        }}
      />
      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
        <button
          onClick={() => setOpen(false)}
          style={{ padding: '4px 10px', border: 'none', background: 'transparent', color: 'var(--text-muted)', fontSize: '0.75rem', cursor: 'pointer' }}
        >
          Cancel
        </button>
        <button
          onClick={() => void insert()}
          disabled={busy || !content.trim()}
          style={{ padding: '4px 12px', borderRadius: 'var(--radius-sm)', border: 'none', background: 'var(--accent)', color: 'white', fontSize: '0.75rem', cursor: 'pointer', opacity: busy || !content.trim() ? 0.5 : 1 }}
        >
          {busy ? 'Injectingâ€¦' : 'Inject memory'}
        </button>
      </div>
    </div>
  );
}

// =============================================================================
// InlineMemoryEditor
// =============================================================================

export interface InlineMemoryEditorProps {
  entryId: number;
  initialContent: string;
  /** Right-aligned (user bubble) or left-aligned (persona bubble). */
  isUser: boolean;
  activeBranch: string;
  onSaved: () => void;
  onCancel: () => void;
}

export function InlineMemoryEditor({
  entryId,
  initialContent,
  isUser,
  activeBranch,
  onSaved,
  onCancel,
}: InlineMemoryEditorProps) {
  const [content, setContent] = useState(initialContent);
  const [busy, setBusy] = useState(false);
  const [branchName, setBranchName] = useState(() => formatEditableBranchName());
  const [branchConfirmed, setBranchConfirmed] = useState(activeBranch !== 'main');
  const addLog = useAppStore((state) => state.addLog) as (message: string) => void;
  const onMainBranch = activeBranch === 'main';

  const save = async () => {
    const text = content.trim();
    if (!text || busy) return;
    if (onMainBranch && !branchConfirmed) {
      addLog('Confirm the branch name before saving this edit.');
      return;
    }
    const targetBranchName = branchName.trim() || formatEditableBranchName();
    setBusy(true);
    try {
      await api.post('/memory/edit', {
        table: 'history',
        id: entryId,
        content: text,
        branchName: onMainBranch ? targetBranchName : undefined,
      });
      onSaved();
    } catch (error: unknown) {
      addLog(`Error: Failed to save memory rewrite: ${error instanceof Error ? error.message : String(error)}`);
      /* leave editor open */
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      style={{
        maxWidth: '640px',
        width: '100%',
        margin: isUser ? '0 0 0 auto' : '0 auto 0 0',
        padding: 'var(--spacing-sm)',
        borderRadius: 'var(--radius-md)',
        border: '1px dashed var(--accent)',
        background: 'color-mix(in srgb, var(--accent) 6%, transparent)',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--spacing-xs)',
      }}
    >
      {onMainBranch ? (
        <>
          <span style={{ fontSize: '0.6875rem', color: 'var(--accent)' }}>
            This edit creates a branch off main. Main stays canonical.
          </span>
          <label
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '4px',
              fontSize: '0.6875rem',
              color: 'var(--text-muted)',
            }}
          >
            Branch name
            <input
              value={branchName}
              onChange={(e) => {
                setBranchName(e.target.value);
                setBranchConfirmed(false);
              }}
              onBlur={() => setBranchName((currentBranchName) => currentBranchName.trim() || formatEditableBranchName())}
              style={{
                width: '100%',
                padding: '6px 8px',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border-subtle)',
                background: 'var(--surface)',
                color: 'var(--text-primary)',
                fontSize: '0.8125rem',
              }}
            />
          </label>
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '0.75rem',
              color: 'var(--text-secondary)',
            }}
          >
            <input
              type="checkbox"
              checked={branchConfirmed}
              onChange={(e) => setBranchConfirmed(e.target.checked)}
            />
            Confirm branch creation on{' '}
            <strong style={{ color: 'var(--text-primary)' }}>
              {branchName.trim() || formatEditableBranchName()}
            </strong>
          </label>
        </>
      ) : (
        <span style={{ fontSize: '0.6875rem', color: 'var(--accent)' }}>
          Rewriting this memory on the active branch — the original survives on main
        </span>
      )}
      <textarea
        autoFocus
        value={content}
        onChange={(e) => setContent(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) void save();
          if (e.key === 'Escape') onCancel();
        }}
        rows={Math.min(10, Math.max(3, initialContent.split('\n').length + 1))}
        style={{
          width: '100%',
          padding: 'var(--spacing-sm)',
          borderRadius: 'var(--radius-sm)',
          border: '1px solid var(--border-subtle)',
          background: 'var(--surface)',
          color: 'var(--text-primary)',
          fontSize: '0.875rem',
          resize: 'vertical',
        }}
      />
      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
        <button
          onClick={onCancel}
          style={{ padding: '4px 10px', border: 'none', background: 'transparent', color: 'var(--text-muted)', fontSize: '0.75rem', cursor: 'pointer' }}
        >
          Cancel
        </button>
        <button
          onClick={() => void save()}
          disabled={busy || !content.trim()}
          style={{ padding: '4px 12px', borderRadius: 'var(--radius-sm)', border: 'none', background: 'var(--accent)', color: 'white', fontSize: '0.75rem', cursor: 'pointer', opacity: busy || !content.trim() ? 0.5 : 1 }}
        >
          {busy ? 'Savingâ€¦' : 'Save rewrite'}
        </button>
      </div>
    </div>
  );
}

function formatEditableBranchName(referenceDate = new Date()): string {
  const year = referenceDate.getUTCFullYear();
  const month = String(referenceDate.getUTCMonth() + 1).padStart(2, '0');
  const day = String(referenceDate.getUTCDate()).padStart(2, '0');
  const hour = String(referenceDate.getUTCHours()).padStart(2, '0');
  const minute = String(referenceDate.getUTCMinutes()).padStart(2, '0');
  return `edit-${year}${month}${day}-${hour}${minute}`;
}
