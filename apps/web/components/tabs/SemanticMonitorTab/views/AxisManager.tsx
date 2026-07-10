/**
 * Concept Axis Manager
 *
 * @module tabs/SemanticMonitorTab/views/AxisManager
 * @description CRUD interface for SIM concept axes. Researchers can define
 * measurement dimensions (axes) with positive and negative examples, then
 * view how entries score along those dimensions.
 *
 * @upstream Called by:
 *   - SemanticMonitorTab/index.jsx - Main tab orchestrator
 * @downstream Calls:
 *   - ../hooks/useSIMData.js - Data access hook
 *   - ../../../ui/Icon.jsx - Lucide icons
 */

import { useEffect, useState, useCallback } from 'react';
import { Icon } from '../../../ui';
import { useSIMData } from '../hooks/useSIMData';

interface AxisFormData {
  name: string;
  description: string;
  positiveExamples: string;
  negativeExamples: string;
}

const EMPTY_FORM: AxisFormData = {
  name: '',
  description: '',
  positiveExamples: '',
  negativeExamples: '',
};

export function AxisManager() {
  const {
    axes,
    axesLoading,
    error,
    fetchAxes,
    createAxis,
    updateAxisAction,
    deleteAxisAction,
  } = useSIMData();

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState<AxisFormData>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  // Fetch axes on mount
  useEffect(() => {
    fetchAxes();
  }, [fetchAxes]);

  const handleOpenCreate = useCallback(() => {
    setFormData(EMPTY_FORM);
    setEditingId(null);
    setShowForm(true);
  }, []);

  const handleOpenEdit = useCallback((axis: any) => {
    setFormData({
      name: axis.name,
      description: axis.description || '',
      positiveExamples: (axis.positive_examples || []).join('\n'),
      negativeExamples: (axis.negative_examples || []).join('\n'),
    });
    setEditingId(axis.id);
    setShowForm(true);
  }, []);

  const handleCancel = useCallback(() => {
    setShowForm(false);
    setEditingId(null);
    setFormData(EMPTY_FORM);
  }, []);

  const handleSave = useCallback(async () => {
    if (!formData.name.trim()) return;
    setSaving(true);

    const positiveExamples = formData.positiveExamples
      .split('\n')
      .map(s => s.trim())
      .filter(Boolean);
    const negativeExamples = formData.negativeExamples
      .split('\n')
      .map(s => s.trim())
      .filter(Boolean);

    const payload = {
      name: formData.name.trim(),
      description: formData.description.trim() || null,
      positiveExamples,
      negativeExamples,
    };

    if (editingId !== null) {
      await updateAxisAction(editingId, payload);
    } else {
      await createAxis(payload);
    }

    setSaving(false);
    handleCancel();
  }, [formData, editingId, createAxis, updateAxisAction, handleCancel]);

  const handleDelete = useCallback(async (id: number) => {
    if (!confirm('Delete this concept axis? This cannot be undone.')) return;
    await deleteAxisAction(id);
  }, [deleteAxisAction]);

  const toggleExpand = useCallback((id: number) => {
    setExpandedId(prev => prev === id ? null : id);
  }, []);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-full bg-purple-500/10">
            <Icon name="Ruler" size={20} className="text-purple-500" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-content-primary">
              Concept Axes
            </h2>
            <p className="text-xs text-content-muted">
              Define measurement dimensions for semantic analysis
            </p>
          </div>
        </div>

        <button
          onClick={handleOpenCreate}
          disabled={showForm}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium
                     rounded border border-accent/50 bg-accent/10
                     text-accent hover:bg-accent/20
                     disabled:opacity-50 disabled:cursor-not-allowed
                     transition-colors"
        >
          <Icon name="Plus" size={14} />
          New Axis
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded border border-danger/50 bg-danger/10 p-3">
          <p className="text-sm text-danger">{error}</p>
        </div>
      )}

      {/* Create/Edit Form */}
      {showForm && (
        <div className="rounded-lg border border-accent/30 bg-surface p-4 space-y-3">
          <h3 className="text-sm font-semibold text-content-primary">
            {editingId !== null ? 'Edit Axis' : 'Create New Axis'}
          </h3>

          <div>
            <label className="text-xs text-content-muted uppercase mb-1 block">Name</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g., playfulness, analytical-depth, existential-focus"
              className="w-full px-3 py-1.5 text-sm rounded border border-border-subtle bg-surface
                         text-content-primary placeholder:text-content-muted
                         focus:border-accent focus:outline-none transition-colors"
            />
          </div>

          <div>
            <label className="text-xs text-content-muted uppercase mb-1 block">Description</label>
            <input
              type="text"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="What does this axis measure?"
              className="w-full px-3 py-1.5 text-sm rounded border border-border-subtle bg-surface
                         text-content-primary placeholder:text-content-muted
                         focus:border-accent focus:outline-none transition-colors"
            />
          </div>

          <div>
            <label className="text-xs text-content-muted uppercase mb-1 block">
              Positive Examples (one per line)
            </label>
            <textarea
              value={formData.positiveExamples}
              onChange={(e) => setFormData({ ...formData, positiveExamples: e.target.value })}
              placeholder={"Example text that scores HIGH on this axis...\nAnother positive example..."}
              rows={3}
              className="w-full px-3 py-1.5 text-sm rounded border border-border-subtle bg-surface
                         text-content-primary placeholder:text-content-muted resize-none
                         focus:border-accent focus:outline-none transition-colors"
            />
          </div>

          <div>
            <label className="text-xs text-content-muted uppercase mb-1 block">
              Negative Examples (one per line)
            </label>
            <textarea
              value={formData.negativeExamples}
              onChange={(e) => setFormData({ ...formData, negativeExamples: e.target.value })}
              placeholder={"Example text that scores LOW on this axis...\nAnother negative example..."}
              rows={3}
              className="w-full px-3 py-1.5 text-sm rounded border border-border-subtle bg-surface
                         text-content-primary placeholder:text-content-muted resize-none
                         focus:border-accent focus:outline-none transition-colors"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              onClick={handleCancel}
              className="px-3 py-1.5 text-sm text-content-secondary hover:text-content-primary
                         transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !formData.name.trim()}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 text-sm font-medium
                         rounded bg-accent text-white hover:bg-accent
                         disabled:opacity-50 disabled:cursor-not-allowed
                         transition-colors"
            >
              {saving ? (
                <>
                  <Icon name="Loader2" size={14} className="animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Icon name="Save" size={14} />
                  {editingId !== null ? 'Update' : 'Create'}
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Loading state */}
      {axesLoading && (
        <div className="rounded-lg border border-border-subtle bg-surface p-8 text-center">
          <Icon name="Loader2" size={24} className="mx-auto animate-spin text-content-muted mb-2" />
          <p className="text-sm text-content-secondary">Loading axes...</p>
        </div>
      )}

      {/* Empty state */}
      {!axesLoading && axes.length === 0 && (
        <div className="rounded-lg border border-border-subtle bg-surface p-8 text-center border-dashed">
          <Icon name="Ruler" size={32} className="mx-auto text-content-muted mb-3" />
          <p className="text-sm text-content-secondary mb-1">No concept axes defined</p>
          <p className="text-xs text-content-muted">
            Create axes to define measurement dimensions for semantic analysis.
            Each axis has positive and negative examples that define a direction in embedding space.
          </p>
        </div>
      )}

      {/* Axes list */}
      {!axesLoading && axes.length > 0 && (
        <div className="space-y-2">
          {axes.map((axis: any) => {
            const isExpanded = expandedId === axis.id;

            return (
              <div
                key={axis.id}
                className="rounded-lg border border-border-subtle bg-surface overflow-hidden"
              >
                {/* Header row */}
                <div
                  className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-surface transition-colors"
                  onClick={() => toggleExpand(axis.id)}
                >
                  <Icon
                    name={isExpanded ? 'ChevronDown' : 'ChevronRight'}
                    size={14}
                    className="text-content-muted flex-shrink-0"
                  />

                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-medium text-content-primary">
                      {axis.name}
                    </span>
                    {axis.description && (
                      <span className="text-xs text-content-muted ml-2">
                        {axis.description}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-[10px] text-content-muted">
                      +{(axis.positive_examples || []).length}/
                      -{(axis.negative_examples || []).length} examples
                    </span>

                    <button
                      onClick={(e) => { e.stopPropagation(); handleOpenEdit(axis); }}
                      className="p-1 rounded hover:bg-surface-raised transition-colors"
                      title="Edit axis"
                    >
                      <Icon name="Pencil" size={12} className="text-content-muted" />
                    </button>

                    <button
                      onClick={(e) => { e.stopPropagation(); handleDelete(axis.id); }}
                      className="p-1 rounded hover:bg-danger/20 transition-colors"
                      title="Delete axis"
                    >
                      <Icon name="Trash2" size={12} className="text-danger/60" />
                    </button>
                  </div>
                </div>

                {/* Expanded details */}
                {isExpanded && (
                  <div className="px-4 pb-4 pt-1 border-t border-border-subtle space-y-3">
                    {(axis.positive_examples || []).length > 0 && (
                      <div>
                        <h4 className="text-xs font-medium text-content-muted uppercase mb-1">
                          Positive Examples
                        </h4>
                        <div className="space-y-1">
                          {axis.positive_examples.map((ex: string, i: number) => (
                            <div key={i} className="text-xs text-content-secondary bg-success/10 rounded px-2 py-1">
                              {ex}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {(axis.negative_examples || []).length > 0 && (
                      <div>
                        <h4 className="text-xs font-medium text-content-muted uppercase mb-1">
                          Negative Examples
                        </h4>
                        <div className="space-y-1">
                          {axis.negative_examples.map((ex: string, i: number) => (
                            <div key={i} className="text-xs text-content-secondary bg-danger/10 rounded px-2 py-1">
                              {ex}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="text-[10px] text-content-muted">
                      Created {new Date(axis.created_at).toLocaleString()}
                      {axis.updated_at && ` | Updated ${new Date(axis.updated_at).toLocaleString()}`}
                      {' | '}Model: {axis.vector_model}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default AxisManager;
