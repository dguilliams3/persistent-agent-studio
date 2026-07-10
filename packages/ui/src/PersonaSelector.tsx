/**
 * @module PersonaSelector
 * @description Pure presentational dropdown for switching between personas.
 * Uses --ui-* design tokens from tokens.css. No Tailwind, no platform-specific code.
 *
 * Anti-pattern: Do NOT import store, hooks, or platform SDKs here.
 *   This component receives all data and callbacks via props.
 * Anti-pattern: Do NOT use Tailwind utility classes.
 *   All styling uses CSS custom properties from the --ui-* namespace.
 *
 * @upstream Called by: apps/web PersonaSelector wrapper
 * @downstream Calls: React (useState)
 */

import { useState } from 'react';
import type { PersonaSelectorItem } from './PersonaSelectorItem.js';

export type { PersonaSelectorItem } from './PersonaSelectorItem.js';

/**
 * Props for the PersonaSelector component.
 * All data and callbacks flow in from the consuming app — this component owns no state
 * beyond open/closed dropdown visibility.
 */
interface PersonaSelectorProps {
  /** Available personas to display in the dropdown */
  personas: PersonaSelectorItem[];
  /** ID of the currently active persona */
  activePersonaId: number;
  /** Callback when a persona is selected */
  onSelect: (id: number) => void;
  /** Whether the selector is disabled (e.g., during switch) */
  disabled?: boolean;
  /** Optional CSS class name for the root element */
  className?: string;
}

/**
 * Inline style definitions for all visual states of the selector.
 * Uses --ui-* CSS custom properties exclusively so token changes propagate automatically.
 *
 * @pattern css-token-only — all values reference --ui-* variables; no hardcoded colors
 * @antipattern Do NOT add Tailwind class names here — this component must work outside Tailwind contexts
 */
const selectorStyles: Record<string, React.CSSProperties> = {
  container: {
    position: 'relative',
    display: 'inline-block',
  },
  button: {
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--ui-spacing-sm)',
    padding: 'var(--ui-spacing-sm) var(--ui-spacing-md)',
    backgroundColor: 'rgba(var(--ui-accent), 0.1)',
    border: '1px solid rgba(var(--ui-accent), 0.3)',
    borderRadius: 'var(--ui-radius-md)',
    color: 'rgb(var(--ui-text-primary))',
    fontSize: '0.875rem',
    cursor: 'pointer',
    transition: `all var(--ui-duration-fast)`,
    minWidth: '120px',
    textAlign: 'left' as const,
  },
  buttonHover: {
    borderColor: 'rgba(var(--ui-accent), 0.5)',
    backgroundColor: 'rgba(var(--ui-accent), 0.2)',
  },
  buttonDisabled: {
    opacity: 0.5,
    cursor: 'not-allowed',
  },
  chevron: {
    marginLeft: 'auto',
    fontSize: '0.625rem',
    color: 'rgb(var(--ui-text-muted))',
  },
  dropdown: {
    position: 'absolute' as const,
    top: '100%',
    left: 0,
    right: 0,
    marginTop: 'var(--ui-spacing-xs)',
    backgroundColor: 'rgb(var(--ui-surface-elevated))',
    border: '1px solid rgb(var(--ui-border))',
    borderRadius: 'var(--ui-radius-md)',
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.4)',
    zIndex: 50,
    overflow: 'hidden',
  },
  option: {
    display: 'block',
    width: '100%',
    padding: 'var(--ui-spacing-sm) var(--ui-spacing-md)',
    backgroundColor: 'transparent',
    border: 'none',
    color: 'rgb(var(--ui-text-primary))',
    fontSize: '0.875rem',
    textAlign: 'left' as const,
    cursor: 'pointer',
    transition: `background-color var(--ui-duration-fast)`,
  },
  optionActive: {
    color: 'rgb(var(--ui-accent))',
  },
};

/**
 * @description Pure presentational persona selector dropdown.
 * All state management and API calls are handled by the consuming app.
 * Only local state this component manages is dropdown open/closed visibility.
 *
 * @param personas - Array of persona records to display in the dropdown list
 * @param activePersonaId - ID of the currently selected persona (highlighted in list)
 * @param onSelect - Callback invoked with the selected persona ID when user makes a choice
 * @param disabled - When true, the trigger button is inert (e.g., during an async persona switch)
 * @param className - Optional CSS class applied to the root container element
 * @returns Dropdown trigger button with accessible listbox, or a "Loading..." placeholder when personas is empty
 * @pattern pure-presentational — zero store imports, zero API calls, all behavior via props
 * @antipattern Do NOT import useAppStore or any app-level hook — use the apps/web wrapper instead
 */
export function PersonaSelector({
  personas,
  activePersonaId,
  onSelect,
  disabled = false,
  className = '',
}: PersonaSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(-1);

  const activePersona = personas.find((persona) => persona.id === activePersonaId);
  const displayLabel = activePersona?.name || `Persona #${activePersonaId}`;

  /**
   * Toggles the dropdown open/closed. No-ops when the selector is disabled.
   * Resets focused index when opening.
   */
  const handleToggle = () => {
    if (!disabled) {
      setIsOpen((previous) => {
        if (!previous) {
          const activeIndex = personas.findIndex((persona) => persona.id === activePersonaId);
          setFocusedIndex(activeIndex >= 0 ? activeIndex : 0);
        }
        return !previous;
      });
    }
  };

  /**
   * Handles persona selection. Fires onSelect only when the chosen persona differs
   * from the current active persona, then closes the dropdown.
   */
  const handleSelect = (personaId: number) => {
    if (personaId !== activePersonaId) {
      onSelect(personaId);
    }
    setIsOpen(false);
  };

  /**
   * Handles keyboard navigation within the dropdown.
   * ArrowDown/ArrowUp move focus, Enter selects, Escape closes.
   */
  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (!isOpen) {
      if (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        handleToggle();
      }
      return;
    }

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        setFocusedIndex((previous) => Math.min(previous + 1, personas.length - 1));
        break;
      case 'ArrowUp':
        event.preventDefault();
        setFocusedIndex((previous) => Math.max(previous - 1, 0));
        break;
      case 'Enter':
      case ' ':
        event.preventDefault();
        if (focusedIndex >= 0 && focusedIndex < personas.length) {
          handleSelect(personas[focusedIndex].id);
        }
        break;
      case 'Escape':
        event.preventDefault();
        setIsOpen(false);
        break;
    }
  };

  /**
   * Closes the dropdown when focus leaves the component entirely.
   * Uses relatedTarget to distinguish focus moving within the component vs. outside.
   */
  const handleBlur = (event: React.FocusEvent) => {
    if (!event.currentTarget.contains(event.relatedTarget)) {
      setIsOpen(false);
    }
  };

  if (personas.length === 0) {
    return (
      <div
        className={className}
        style={{ color: 'rgb(var(--ui-text-muted))', fontSize: '0.875rem' }}
      >
        Loading...
      </div>
    );
  }

  return (
    <div
      className={className}
      style={selectorStyles.container}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
    >
      <button
        type="button"
        onClick={handleToggle}
        disabled={disabled}
        style={{
          ...selectorStyles.button,
          ...(disabled ? selectorStyles.buttonDisabled : {}),
        }}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <span>{displayLabel}</span>
        <span style={selectorStyles.chevron}>{isOpen ? '\u25B2' : '\u25BC'}</span>
      </button>

      {isOpen && (
        <div
          style={selectorStyles.dropdown}
          role="listbox"
          aria-activedescendant={focusedIndex >= 0 ? `persona-option-${personas[focusedIndex].id}` : undefined}
        >
          {personas.map((persona, index) => (
            <div
              key={persona.id}
              id={`persona-option-${persona.id}`}
              role="option"
              aria-selected={persona.id === activePersonaId}
              onClick={() => handleSelect(persona.id)}
              style={{
                ...selectorStyles.option,
                ...(persona.id === activePersonaId ? selectorStyles.optionActive : {}),
                ...(index === focusedIndex ? { backgroundColor: 'rgba(var(--ui-accent), 0.1)' } : {}),
              }}
              onMouseEnter={(event) => {
                setFocusedIndex(index);
                event.currentTarget.style.backgroundColor = 'rgba(var(--ui-accent), 0.1)';
              }}
              onMouseLeave={(event) => {
                event.currentTarget.style.backgroundColor = 'transparent';
              }}
            >
              {persona.name || `Persona #${persona.id}`}
              {persona.id === activePersonaId ? ' (active)' : ''}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
