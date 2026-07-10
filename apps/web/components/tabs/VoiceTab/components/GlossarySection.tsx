/**
 * STT Glossary Management Section
 *
 * @module components/tabs/VoiceTab/components/GlossarySection
 * @description Manages Speech-to-Text (STT) glossary corrections for WhisperX.
 * Allows adding, viewing, and deleting wrong→correct form mappings.
 *
 * The glossary is used two ways:
 * 1. **Prompt priming**: Entries prime WhisperX for expected vocabulary
 * 2. **Post-processing**: Entries replace common mistranscriptions after STT
 *
 * @upstream Called by:
 *   - VoiceTab/index.jsx - Renders in voice testing interface
 * @downstream Calls:
 *   - Zustand store (glossary state/actions)
 *   - Accordion, Select components (from ui/)
 */

import { useState, useEffect } from 'react';
import { useAppStore } from '../../../../store';
import { Accordion, Select } from '../../../ui';
import { Trash2 } from 'lucide-react';

/** Category options for glossary entries */
const CATEGORY_OPTIONS = [
  { value: 'name', label: 'Name' },
  { value: 'term', label: 'Term' },
  { value: 'phrase', label: 'Phrase' },
];

/**
 * @description STT Glossary management section with add form and entry list
 *
 * @upstream Called by: VoiceTab/index.jsx
 * @downstream Calls: Zustand store, Accordion, Select, Trash2 icon
 *
 * @returns {JSX.Element} Glossary management section
 *
 * @example
 * <GlossarySection />
 */
export default function GlossarySection({ isPanel = false }: { isPanel?: boolean }) {
  // Collapsible state
  const [isExpanded, setIsExpanded] = useState(false);

  // Form state
  const [wrongForm, setWrongForm] = useState('');
  const [correctForm, setCorrectForm] = useState('');
  const [category, setCategory] = useState('name');
  const [isAdding, setIsAdding] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  // Store state and actions
  const glossaryEntries = useAppStore((s) => s.glossaryEntries);
  const glossaryLoading = useAppStore((s) => s.glossaryLoading);
  const fetchGlossary = useAppStore((s) => s.fetchGlossary);
  const addGlossaryEntry = useAppStore((s) => s.addGlossaryEntry);
  const deleteGlossaryEntry = useAppStore((s) => s.deleteGlossaryEntry);

  // Fetch glossary on mount
  useEffect(() => {
    fetchGlossary();
  }, [fetchGlossary]);

  /**
   * @description Handle form submission to add new entry
   */
  const handleSubmit = async (e: any) => {
    e.preventDefault();
    if (!wrongForm.trim() || !correctForm.trim()) return;

    setIsAdding(true);
    try {
      await addGlossaryEntry(wrongForm.trim(), correctForm.trim(), category);
      // Clear form on success
      setWrongForm('');
      setCorrectForm('');
      setCategory('name');
    } finally {
      setIsAdding(false);
    }
  };

  /**
   * @description Handle entry deletion
   * @param {number} id - Entry ID to delete
   */
  const handleDelete = async (id: any) => {
    setDeletingId(id);
    try {
      await deleteGlossaryEntry(id);
    } finally {
      setDeletingId(null);
    }
  };

  // Group entries by category for display
  const entriesByCategory: Record<string, any[]> = glossaryEntries.reduce((acc: Record<string, any[]>, entry: any) => {
    const cat = entry.category || 'other';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(entry);
    return acc;
  }, {} as Record<string, any[]>);

  return (
    <Accordion
      title={
        <>
          STT Glossary
          <span className="badge-info ml-2">{glossaryEntries.length}</span>
        </>
      }
      variant="card"
      isOpen={isExpanded}
      onToggle={setIsExpanded}
    >
      <div className="space-y-4 pt-2">
        {/* Add Entry Form */}
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className={isPanel ? 'grid grid-cols-1 gap-2' : 'grid grid-cols-2 gap-2'}>
            <div>
              <label className="block text-xs font-medium text-content-secondary mb-1">
                STT Output (Wrong)
              </label>
              <input
                type="text"
                value={wrongForm}
                onChange={(e) => setWrongForm(e.target.value)}
                placeholder="e.g., Macy"
                className="input text-sm"
                disabled={isAdding}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-content-secondary mb-1">
                Correct Form
              </label>
              <input
                type="text"
                value={correctForm}
                onChange={(e) => setCorrectForm(e.target.value)}
                placeholder="e.g., Kasey"
                className="input text-sm"
                disabled={isAdding}
              />
            </div>
          </div>

          <div className="flex items-end gap-2">
            <div className="flex-1">
              <label className="block text-xs font-medium text-content-secondary mb-1">
                Category
              </label>
              <Select
                value={category}
                onChange={setCategory}
                options={CATEGORY_OPTIONS}
                size="sm"
                disabled={isAdding}
              />
            </div>
            <button
              type="submit"
              disabled={isAdding || !wrongForm.trim() || !correctForm.trim()}
              className="btn-primary text-sm disabled:opacity-50"
            >
              {isAdding ? 'Adding...' : 'Add Entry'}
            </button>
          </div>
        </form>

        {/* Entries List */}
        <div className="border-t border-border-subtle pt-3">
          {glossaryLoading ? (
            <div className="text-center text-content-muted text-sm py-4">Loading...</div>
          ) : glossaryEntries.length === 0 ? (
            <div className="text-center text-content-muted text-sm py-4">
              No glossary entries yet
            </div>
          ) : (
            <div className="space-y-3">
              {/* Names */}
              {entriesByCategory.name?.length > 0 && (
                <div>
                  <h4 className="text-xs font-medium text-content-muted mb-1">Names</h4>
                  <div className="flex flex-wrap gap-1">
                    {entriesByCategory.name.map((entry: any) => (
                      <GlossaryTag
                        key={entry.id}
                        entry={entry}
                        onDelete={handleDelete}
                        isDeleting={deletingId === entry.id}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Terms */}
              {entriesByCategory.term?.length > 0 && (
                <div>
                  <h4 className="text-xs font-medium text-content-muted mb-1">Terms</h4>
                  <div className="flex flex-wrap gap-1">
                    {entriesByCategory.term.map((entry: any) => (
                      <GlossaryTag
                        key={entry.id}
                        entry={entry}
                        onDelete={handleDelete}
                        isDeleting={deletingId === entry.id}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Phrases */}
              {entriesByCategory.phrase?.length > 0 && (
                <div>
                  <h4 className="text-xs font-medium text-content-muted mb-1">Phrases</h4>
                  <div className="flex flex-wrap gap-1">
                    {entriesByCategory.phrase.map((entry: any) => (
                      <GlossaryTag
                        key={entry.id}
                        entry={entry}
                        onDelete={handleDelete}
                        isDeleting={deletingId === entry.id}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Other */}
              {entriesByCategory.other?.length > 0 && (
                <div>
                  <h4 className="text-xs font-medium text-content-muted mb-1">Other</h4>
                  <div className="flex flex-wrap gap-1">
                    {entriesByCategory.other.map((entry: any) => (
                      <GlossaryTag
                        key={entry.id}
                        entry={entry}
                        onDelete={handleDelete}
                        isDeleting={deletingId === entry.id}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Help Text */}
        <div className="text-xs text-content-muted border-t border-border-subtle pt-3">
          Glossary entries correct speech-to-text transcription errors.
          Add common mistranscriptions (names, technical terms) to improve accuracy.
        </div>
      </div>
    </Accordion>
  );
}

/**
 * @description Individual glossary tag with delete button
 *
 * @param {Object} props
 * @param {Object} props.entry - Glossary entry { id, wrong_form, correct_form }
 * @param {Function} props.onDelete - Delete handler
 * @param {boolean} props.isDeleting - Whether deletion is in progress
 * @returns {JSX.Element} Glossary tag
 */
function GlossaryTag({ entry, onDelete, isDeleting }: any) {
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs bg-depth text-content-secondary transition-opacity ${
        isDeleting ? 'opacity-50' : ''
      }`}
    >
      <span className="text-content-muted">{entry.wrong_form}</span>
      <span className="text-content-muted">→</span>
      <span className="font-medium text-content-primary">{entry.correct_form}</span>
      <button
        onClick={() => onDelete(entry.id)}
        disabled={isDeleting}
        className="ml-1 p-0.5 rounded hover:bg-danger/20 hover:text-danger transition-colors"
        title="Delete entry"
      >
        <Trash2 size={12} />
      </button>
    </span>
  );
}

// Export category options for potential reuse
export { CATEGORY_OPTIONS };
