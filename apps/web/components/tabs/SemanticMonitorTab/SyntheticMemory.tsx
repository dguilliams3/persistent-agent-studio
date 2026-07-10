/**
 * Synthetic Memory Management for Semantic Identity Monitor
 *
 * @module components/tabs/SemanticMonitorTab/SyntheticMemory
 * @description Interface for creating and managing synthetic memories within
 * the Semantic Identity Monitor context. Synthetic memories are branch-specific
 * "what if" experiments that appear in context without modifying canonical history.
 *
 * This is the experimentation interface for identity exploration - inject memories
 * to see how they affect semantic identity trajectory and basin positioning.
 *
 * @upstream Called by:
 *   - SemanticMonitorTab/index.jsx - as "Memory Lab" view
 * @downstream Calls:
 *   - useAppStore - Zustand store for synthetic memory CRUD
 *   - ui/Select - Type dropdown
 *   - ui/Icon - Lucide icons
 *
 * @example
 * // In SemanticMonitorTab views switch:
 * case 'memory-lab':
 *   return <SyntheticMemory />;
 */

import { useState, useCallback } from 'react';
import { useAppStore } from '../../../store';
import { Select, Icon } from '../../ui';

// =============================================================================
// TYPE CONFIGURATION
// =============================================================================

/**
 * Memory type options with icons and descriptions
 */
const TYPE_OPTIONS = [
  { value: 'thought', label: '💭 Thought', description: 'Internal contemplation' },
  { value: 'message_to_user', label: '📤 Message to User', description: 'Outbound communication' },
  { value: 'user_message', label: "👤 User's Message", description: 'Simulated user message' },
  { value: 'curiosity', label: '🔍 Curiosity', description: 'Question or wonder' },
  { value: 'cold_storage', label: '🧊 Cold Storage', description: 'Permanent memory' },
  { value: 'note_saved', label: '📓 Note', description: 'Notebook entry' },
  { value: 'art_result', label: "🖼️ Clio's Art", description: 'Generated artwork' },
  { value: 'user_art', label: "🎨 User's Art", description: 'User-submitted art' },
];

const TYPE_ICONS: Record<string, string> = {
  thought: '💭',
  message_to_user: '📤',
  user_message: '👤',
  curiosity: '🔍',
  art_result: '🖼️',
  user_art: '🎨',
  cold_storage: '🧊',
  note_saved: '📓',
  exist: '😌',
};

// =============================================================================
// MAIN COMPONENT
// =============================================================================

/**
 * @description Synthetic memory management interface for semantic experimentation
 *
 * @upstream Called by: SemanticMonitorTab/index.jsx
 * @downstream Calls: useAppStore, SyntheticForm, SyntheticList
 *
 * @returns {React.ReactElement} Synthetic memory management UI
 */
export default function SyntheticMemory() {
  // Store selectors - synthetic memory state and actions
  const syntheticMemories = useAppStore((s) => s.syntheticMemories);
  const isLoadingSynthetics = useAppStore((s) => s.isLoadingSynthetics);
  const activeBranch = useAppStore((s) => s.activeBranch);

  // Form state
  const showSyntheticForm = useAppStore((s) => s.showSyntheticForm);
  const editingSynthetic = useAppStore((s) => s.editingSynthetic);
  const syntheticType = useAppStore((s) => s.syntheticType);
  const setSyntheticType = useAppStore((s) => s.setSyntheticType);
  const syntheticContent = useAppStore((s) => s.syntheticContent);
  const setSyntheticContent = useAppStore((s) => s.setSyntheticContent);
  const syntheticInternal = useAppStore((s) => s.syntheticInternal);
  const setSyntheticInternal = useAppStore((s) => s.setSyntheticInternal);
  const syntheticImage = useAppStore((s) => s.syntheticImage);
  const setSyntheticImage = useAppStore((s) => s.setSyntheticImage);
  const isSavingSynthetic = useAppStore((s) => s.isSavingSynthetic);

  // Actions
  const openSyntheticForm = useAppStore((s) => s.openSyntheticForm);
  const openSyntheticEdit = useAppStore((s) => s.openSyntheticEdit);
  const closeSyntheticForm = useAppStore((s) => s.closeSyntheticForm);
  const saveSyntheticMemory = useAppStore((s) => s.saveSyntheticMemory);
  const deleteSyntheticMemory = useAppStore((s) => s.deleteSyntheticMemory);

  return (
    <div className="space-y-4">
      {/* Header section with context */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-full bg-success/10">
            <Icon name="FlaskConical" size={20} className="text-success" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-content-primary">Memory Lab</h2>
            <p className="text-xs text-content-muted">
              Inject synthetic memories to experiment with identity evolution
            </p>
          </div>
        </div>

        <button
          onClick={openSyntheticForm}
          className="btn-success px-4 py-2 text-sm flex items-center gap-2"
        >
          <Icon name="Plus" size={16} />
          Add Synthetic
        </button>
      </div>

      {/* Branch indicator */}
      <div className="flex items-center gap-2 text-sm text-content-secondary">
        <Icon name="GitBranch" size={14} className="text-accent" />
        <span>
          Branch: <strong className="text-accent">{activeBranch || 'main'}</strong>
        </span>
        {activeBranch === 'main' && (
          <span className="text-content-muted text-xs">
            (Create a branch in Editor tab to add synthetics)
          </span>
        )}
      </div>

      {/* Creation/Edit form */}
      {showSyntheticForm && (
        <SyntheticForm
          syntheticType={syntheticType}
          setSyntheticType={setSyntheticType}
          syntheticContent={syntheticContent}
          setSyntheticContent={setSyntheticContent}
          syntheticInternal={syntheticInternal}
          setSyntheticInternal={setSyntheticInternal}
          syntheticImage={syntheticImage}
          setSyntheticImage={setSyntheticImage}
          isSavingSynthetic={isSavingSynthetic}
          editingSynthetic={editingSynthetic}
          closeSyntheticForm={closeSyntheticForm}
          saveSyntheticMemory={saveSyntheticMemory}
        />
      )}

      {/* List of existing synthetic memories */}
      <SyntheticList
        syntheticMemories={syntheticMemories}
        isLoadingSynthetics={isLoadingSynthetics}
        openSyntheticEdit={openSyntheticEdit}
        deleteSyntheticMemory={deleteSyntheticMemory}
      />

      {/* Help text */}
      <HelpSection />
    </div>
  );
}

// =============================================================================
// SYNTHETIC FORM COMPONENT
// =============================================================================

/**
 * @description Form for creating/editing synthetic memories
 * Supports text content for regular types, image upload for art types
 *
 * @upstream Called by: SyntheticMemory
 * @downstream Calls: Select component, file upload handlers
 */
function SyntheticForm({ syntheticType,
  setSyntheticType,
  syntheticContent,
  setSyntheticContent,
  syntheticInternal,
  setSyntheticInternal,
  syntheticImage,
  setSyntheticImage,
  isSavingSynthetic,
  editingSynthetic,
  closeSyntheticForm,
  saveSyntheticMemory, }: any) {
  const [isDragging, setIsDragging] = useState(false);
  const isArtType = syntheticType === 'art_result' || syntheticType === 'user_art';
  const hasContent = isArtType ? !!syntheticImage : syntheticContent.trim();

  // Handle file from any source
  const handleImageFile = useCallback((file: any) => {
    if (!file || !file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = (event: any) => {
      setSyntheticImage({ base64: event.target.result, name: file.name });
    };
    reader.readAsDataURL(file);
  }, [setSyntheticImage]);

  const handleDrop = useCallback((e: any) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer?.files?.[0];
    if (file) handleImageFile(file);
  }, [handleImageFile]);

  const handlePaste = useCallback((e: any) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        const file = item.getAsFile();
        if (file) handleImageFile(file);
        break;
      }
    }
  }, [handleImageFile]);

  return (
    <div className="card p-4 border-success/30">
      <div className="flex items-center gap-2 mb-4">
        <Icon name={editingSynthetic ? 'Pencil' : 'Plus'} size={16} className="text-success" />
        <span className="font-medium text-content-primary">
          {editingSynthetic ? 'Edit Synthetic Memory' : 'Create Synthetic Memory'}
        </span>
      </div>

      <div className="space-y-4">
        {/* Type selector */}
        <div className="flex items-center gap-3">
          <label className="text-content-muted text-sm w-20">Type:</label>
          <Select
            value={syntheticType}
            onChange={(type) => {
              setSyntheticType(type);
              if (type !== 'art_result' && type !== 'user_art') {
                setSyntheticImage(null);
              }
            }}
            options={TYPE_OPTIONS.map(t => ({ value: t.value, label: t.label }))}
            size="sm"
          />
        </div>

        {/* Content: Image upload for art types, text for others */}
        {isArtType ? (
          <div>
            <label className="text-content-muted text-sm">Image:</label>
            <div
              className={`mt-2 border-2 border-dashed rounded-lg p-6 text-center transition-colors cursor-pointer ${
                isDragging
                  ? 'border-success bg-success/10'
                  : 'border-border-subtle hover:border-accent/50'
              }`}
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={(e) => { e.preventDefault(); setIsDragging(false); }}
              onDrop={handleDrop}
              onPaste={handlePaste}
              tabIndex={0}
            >
              {syntheticImage?.base64 ? (
                <div className="relative inline-block">
                  <img
                    src={syntheticImage.base64}
                    alt="Preview"
                    className="max-w-64 max-h-48 rounded-lg border border-border-subtle"
                  />
                  <button
                    onClick={() => setSyntheticImage(null)}
                    className="absolute -top-2 -right-2 bg-danger text-white rounded-full w-6 h-6 flex items-center justify-center text-sm hover:bg-danger/80 transition-colors"
                  >
                    <Icon name="X" size={14} />
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  <Icon name="ImagePlus" size={32} className="mx-auto text-content-muted" />
                  <div className="text-content-muted text-sm">
                    Drop image, paste from clipboard, or
                  </div>
                  <label className="btn-secondary px-4 py-2 text-sm cursor-pointer inline-block">
                    Browse Files
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleImageFile(e.target.files?.[0])}
                      className="hidden"
                    />
                  </label>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div>
            <label className="text-content-muted text-sm">Content:</label>
            <textarea
              value={syntheticContent}
              onChange={(e) => setSyntheticContent(e.target.value)}
              placeholder="Enter the synthetic memory content..."
              rows={4}
              className="input mt-2 resize-none"
            />
          </div>
        )}

        {/* Internal/description field */}
        <div>
          <label className="text-content-muted text-sm">
            {isArtType ? 'Prompt/Description:' : 'Internal (subthought):'}
          </label>
          <input
            type="text"
            value={syntheticInternal}
            onChange={(e) => setSyntheticInternal(e.target.value)}
            placeholder={isArtType ? 'Image description or generation prompt...' : 'Internal context shown as subthought...'}
            className="input mt-2"
          />
        </div>

        {/* Action buttons */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            onClick={closeSyntheticForm}
            className="btn-secondary px-4 py-2 text-sm"
          >
            Cancel
          </button>
          <button
            onClick={saveSyntheticMemory}
            disabled={!hasContent || isSavingSynthetic}
            className="btn-success px-4 py-2 text-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isSavingSynthetic ? (
              <>
                <Icon name="Loader" size={14} className="animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Icon name={editingSynthetic ? 'Save' : 'Plus'} size={14} />
                {editingSynthetic ? 'Update' : 'Create'}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}


// =============================================================================
// SYNTHETIC LIST COMPONENT
// =============================================================================

/**
 * @description List of synthetic memories with edit/delete actions
 *
 * @upstream Called by: SyntheticMemory
 * @downstream Calls: SyntheticCard
 */
function SyntheticList({ syntheticMemories,
  isLoadingSynthetics,
  openSyntheticEdit,
  deleteSyntheticMemory, }: any) {
  if (isLoadingSynthetics) {
    return (
      <div className="card p-8 text-center">
        <Icon name="Loader" size={24} className="mx-auto text-content-muted animate-spin mb-2" />
        <span className="text-content-muted text-sm">Loading synthetic memories...</span>
      </div>
    );
  }

  if (syntheticMemories.length === 0) {
    return (
      <div className="card p-8 text-center border-dashed">
        <Icon name="FlaskConical" size={32} className="mx-auto text-content-muted mb-3" />
        <p className="text-content-secondary font-medium mb-1">No synthetic memories yet</p>
        <p className="text-content-muted text-sm">
          Click "Add Synthetic" to create your first memory injection
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-sm text-content-muted">
        <span>{syntheticMemories.length} synthetic {syntheticMemories.length === 1 ? 'memory' : 'memories'}</span>
      </div>

      <div className="space-y-2">
        {syntheticMemories.map((synth: any) => (
          <SyntheticCard
            key={synth.id}
            synth={synth}
            openSyntheticEdit={openSyntheticEdit}
            deleteSyntheticMemory={deleteSyntheticMemory}
          />
        ))}
      </div>
    </div>
  );
}


// =============================================================================
// SYNTHETIC CARD COMPONENT
// =============================================================================

/**
 * @description Individual synthetic memory card with preview and actions
 */
function SyntheticCard({ synth, openSyntheticEdit, deleteSyntheticMemory }: any) {
  const isArt = (synth.memory_type === 'art_result' || synth.memory_type === 'user_art') &&
                synth.content?.startsWith('data:image');

  const handleDelete = () => {
    const password = prompt('Enter admin password to delete:');
    if (password) {
      deleteSyntheticMemory(synth.id, password);
    }
  };

  return (
    <div className="card p-4 hover:border-accent/30 transition-colors">
      <div className="flex items-start gap-4">
        {/* Thumbnail for art */}
        {isArt && (
          <img
            src={synth.content}
            alt="Synthetic art"
            className="w-16 h-16 object-cover rounded-lg border border-border-subtle shrink-0"
          />
        )}

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 text-xs text-content-muted mb-2">
            <span className="text-lg">{TYPE_ICONS[synth.memory_type] || '📝'}</span>
            <span className="font-medium">{synth.memory_type}</span>
            <span className="text-success font-medium">SYNTHETIC #{synth.id}</span>
            <span className="text-content-muted">
              {synth.created_at && new Date(synth.created_at + 'Z').toLocaleString('en-US', {
                timeZone: 'America/New_York',
                month: 'short',
                day: 'numeric',
                hour: 'numeric',
                minute: '2-digit',
              })}
            </span>
          </div>

          <div className="text-content-secondary text-sm break-words">
            {isArt ? (
              synth.internal || '[Image with no description]'
            ) : (
              <>
                {synth.content?.slice(0, 200) || '(empty)'}
                {synth.content?.length > 200 && '...'}
              </>
            )}
          </div>

          {synth.internal && !isArt && (
            <div className="text-content-muted text-xs mt-1 italic">
              Internal: {synth.internal.slice(0, 100)}
              {synth.internal.length > 100 && '...'}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => openSyntheticEdit(synth)}
            className="btn-secondary px-3 py-1.5 text-xs flex items-center gap-1"
          >
            <Icon name="Pencil" size={12} />
            Edit
          </button>
          <button
            onClick={handleDelete}
            className="px-3 py-1.5 bg-depth hover:bg-danger hover:text-white text-content-primary rounded-md text-xs transition-all duration-150 flex items-center gap-1"
          >
            <Icon name="Trash2" size={12} />
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}


// =============================================================================
// HELP SECTION
// =============================================================================

/**
 * @description Collapsible help section explaining synthetic memories
 */
function HelpSection() {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="card p-4 border-dashed">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center gap-2 w-full text-left"
      >
        <Icon name="HelpCircle" size={16} className="text-accent" />
        <span className="text-sm font-medium text-content-secondary">
          What are synthetic memories?
        </span>
        <Icon
          name="ChevronDown"
          size={14}
          className={`ml-auto text-content-muted transition-transform ${isExpanded ? 'rotate-180' : ''}`}
        />
      </button>

      {isExpanded && (
        <div className="mt-4 text-sm text-content-muted space-y-3">
          <p>
            <strong className="text-content-secondary">Synthetic memories</strong> are
            experimental injections that appear in Claude's context without modifying
            the canonical timeline. They exist only within the current memory branch.
          </p>

          <div className="space-y-2">
            <p className="font-medium text-content-secondary">Use cases:</p>
            <ul className="list-disc list-inside space-y-1 pl-2">
              <li>Test how specific memories affect semantic identity trajectory</li>
              <li>Simulate "what if" scenarios for identity exploration</li>
              <li>Insert missing context without altering history</li>
              <li>Experiment with different memory compositions</li>
            </ul>
          </div>

          <div className="bg-surface p-3 rounded-lg border border-border-subtle">
            <p className="text-xs">
              <Icon name="Info" size={12} className="inline mr-1 text-accent" />
              Synthetic memories are branch-specific. Switch to a non-main branch in the
              Editor tab to start experimenting.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
