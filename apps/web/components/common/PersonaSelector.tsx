/**
 * @module PersonaSelector
 * @description Web app wrapper for the shared PersonaSelector from @persistence/ui.
 * Wires the pure presentational component to the web app's Zustand store.
 *
 * @upstream Called by: HeaderBar, SettingsTab
 * @downstream Calls: @persistence/ui PersonaSelector, useAppStore
 */

import { useState } from 'react';
import { PersonaSelector as SharedPersonaSelector } from '@persistence/ui';
import { useAppStore } from '../../store';

/**
 * Props for the web-specific PersonaSelector wrapper.
 * The shared component's full PersonaSelectorProps are derived from the store — only
 * web-layer configuration options are exposed here.
 */
interface WebPersonaSelectorProps {
  /** Optional CSS class applied to the flex container wrapping the selector and create button */
  className?: string;
  /** When true, renders a "+ New" button that opens the create-persona prompt flow */
  showCreateButton?: boolean;
}

/**
 * @description Web-specific PersonaSelector that bridges the shared @persistence/ui component
 * to the web app's Zustand store. Handles persona switching with loading state and the
 * create-persona flow using browser prompt dialogs.
 *
 * @param className - Optional CSS class for the root flex container
 * @param showCreateButton - When true, a "+ New" button is rendered alongside the selector
 * @returns Flex container with the shared selector and an optional create button
 * @pattern store-bridge — this component's sole purpose is wiring store selectors/actions
 *   to a pure presentational component; it contains no rendering logic of its own
 * @antipattern Do NOT add display logic here — keep presentational concerns in @persistence/ui PersonaSelector
 * @antipattern Do NOT replace prompt() with a modal without extracting a CreatePersonaModal component first
 */
export function PersonaSelector({ className = '', showCreateButton = false }: WebPersonaSelectorProps) {
  const personas = useAppStore((state) => state.personas);
  const activePersona = useAppStore((state) => state.activePersona);
  const switchPersona = useAppStore((state) => state.switchPersona);
  const createPersona = useAppStore((state) => state.createPersona);

  const [isSwitching, setIsSwitching] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  /**
   * Switches the active persona via the store action.
   * Sets isSwitching to disable the selector during the async operation.
   *
   * @param personaId - ID of the persona to switch to
   */
  const handleSelect = async (personaId: number) => {
    setIsSwitching(true);
    try {
      await switchPersona(personaId);
    } finally {
      setIsSwitching(false);
    }
  };

  /**
   * Opens browser prompt dialogs to collect a name and admin password,
   * then calls createPersona. Sets isCreating to disable the button during the async operation.
   * Early-returns without action if the user cancels either prompt.
   */
  const handleCreate = async () => {
    const name = prompt('Enter name for new persona:');
    if (!name) return;

    const password = prompt('Enter admin password:');
    if (!password) return;

    setIsCreating(true);
    try {
      await createPersona(name, password);
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {activePersona ? (
        <SharedPersonaSelector
          personas={personas}
          activePersonaId={activePersona.id}
          onSelect={handleSelect}
          disabled={isSwitching}
        />
      ) : (
        <span style={{ color: 'rgb(var(--ui-text-muted))', fontSize: '0.875rem' }}>Loading...</span>
      )}
      {showCreateButton && (
        <button
          type="button"
          onClick={handleCreate}
          disabled={isCreating}
          className="text-xs px-2 py-1 text-accent hover:bg-accent/10 rounded transition-colors disabled:opacity-50"
          title="Create new persona"
        >
          {isCreating ? '...' : '+ New'}
        </button>
      )}
    </div>
  );
}

export default PersonaSelector;
