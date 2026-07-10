/**
 * Type Filter Dropdown Component
 *
 * @module ui/TypeFilterDropdown
 * @description A professional dropdown with checkboxes for multi-select filtering.
 * Features keyboard accessibility, click-outside-to-close, and entry counts display.
 *
 * @upstream Called by:
 *   - SemanticMonitorTab/views/TrajectoryView.jsx - Entry type filtering
 * @downstream Calls:
 *   - ./Icon.jsx - Lucide icons
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { Icon } from './Icon';

interface TypeFilterDropdownProps {
  options: Array<{ value: string; label: string; icon: string }>;
  selected: string[] | null;
  onChange: (selected: string[] | null) => void;
  counts?: Record<string, number>;
  placeholder?: string;
  className?: string;
}

/**
 * @description Multi-select dropdown with checkboxes for filtering
 *
 * @param {Object} props - Component props
 * @param {Array<{value: string, label: string, icon: string}>} props.options - Filter options
 * @param {string[]|null} props.selected - Selected values (null = all selected)
 * @param {Function} props.onChange - Called with new selection array or null
 * @param {Object} [props.counts] - Optional counts per option value
 * @param {string} [props.placeholder='All types'] - Text when all selected
 * @param {string} [props.className] - Additional CSS classes
 * @returns {JSX.Element} Dropdown component
 *
 * @example
 * <TypeFilterDropdown
 *   options={[
 *     { value: 'thought', label: 'Thoughts', icon: 'MessageCircle' },
 *     { value: 'message', label: 'Messages', icon: 'Send' },
 *   ]}
 *   selected={selectedTypes}
 *   onChange={setSelectedTypes}
 *   counts={{ thought: 169, message: 92 }}
 * />
 */
export function TypeFilterDropdown({
  options,
  selected,
  onChange,
  counts = {},
  placeholder = 'All types',
  className = '',
}: TypeFilterDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<any>(null);

  // Close on click outside
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: any) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };

    const handleEscape = (e: any) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen]);

  /**
   * @description Check if a value is selected
   */
  const isSelected = useCallback(
    (value: any) => {
      if (selected === null) return true; // null = all selected
      return selected.includes(value);
    },
    [selected]
  );

  /**
   * @description Toggle a single option
   */
  const toggleOption = useCallback(
    (value: any) => {
      if (selected === null) {
        // Currently all selected, switch to all-except-this
        onChange(options.filter((opt) => opt.value !== value).map((opt) => opt.value));
      } else if (selected.includes(value)) {
        // Remove from selection
        const newSelection = selected.filter((v) => v !== value);
        // If nothing left, show empty selection (not all)
        onChange(newSelection);
      } else {
        // Add to selection
        const newSelection = [...selected, value];
        // If all selected, switch to null
        if (newSelection.length === options.length) {
          onChange(null);
        } else {
          onChange(newSelection);
        }
      }
    },
    [selected, options, onChange]
  );

  /**
   * @description Select all options
   */
  const selectAll = useCallback(() => {
    onChange(null); // null = all selected
    setIsOpen(false);
  }, [onChange]);

  /**
   * @description Clear all selections
   */
  const clearAll = useCallback(() => {
    onChange([]); // empty = nothing selected
  }, [onChange]);

  // Compute display text
  const getDisplayText = () => {
    if (selected === null) return placeholder;
    if (selected.length === 0) return 'None selected';
    if (selected.length === 1) {
      const opt = options.find((o) => o.value === selected[0]);
      return opt?.label || '1 selected';
    }
    return `${selected.length} selected`;
  };

  // Count total entries
  const totalCount = Object.values(counts).reduce((a, b) => a + b, 0);
  const selectedCount =
    selected === null
      ? totalCount
      : selected.reduce((sum, val) => sum + (counts[val] || 0), 0);

  return (
    <div ref={dropdownRef} className={`relative ${className}`}>
      {/* Trigger button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="inline-flex items-center gap-2 px-3 py-1.5 text-sm
                   rounded-md border-2 border-border-subtle bg-surface-raised
                   text-content-primary hover:bg-surface-raised hover:border-border-subtle
                   focus:outline-none focus:ring-2 focus:ring-accent/50
                   transition-colors shadow-md"
      >
        <Icon name="Filter" size={14} className="text-content-muted" />
        <span className="min-w-[80px] text-left">{getDisplayText()}</span>
        <Icon
          name="ChevronDown"
          size={14}
          className={`text-content-muted transition-transform ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {/* Dropdown panel - using inline style for solid opaque background */}
      {isOpen && (
        <div
          className="absolute top-full left-0 mt-1 w-64 z-50
                     rounded-lg border-2 border-border-subtle
                     shadow-xl overflow-hidden"
          style={{ backgroundColor: '#1e293b' }}
        >
          {/* Options list */}
          <div className="max-h-64 overflow-y-auto">
            {options.map((opt) => {
              const checked = isSelected(opt.value);
              const count = counts[opt.value] || 0;

              return (
                <label
                  key={opt.value}
                  className="flex items-center gap-2.5 px-3 py-2 cursor-pointer
                             transition-colors"
                  style={{ backgroundColor: checked ? 'rgba(59, 130, 246, 0.15)' : 'transparent' }}
                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = checked ? 'rgba(59, 130, 246, 0.25)' : 'rgba(255,255,255,0.05)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = checked ? 'rgba(59, 130, 246, 0.15)' : 'transparent'; }}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleOption(opt.value)}
                    className="w-4 h-4 rounded border-2 border-border-subtle bg-surface-raised
                               text-accent focus:ring-accent/50
                               checked:bg-accent checked:border-accent
                               cursor-pointer accent"
                  />
                  <Icon
                    name={opt.icon}
                    size={14}
                    className={checked ? 'text-accent' : 'text-content-muted'}
                  />
                  <span
                    className={`flex-1 text-sm ${checked ? 'text-content-primary' : 'text-content-secondary'}`}
                  >
                    {opt.label}
                  </span>
                  {count > 0 && (
                    <span className="text-xs text-content-muted tabular-nums">
                      {count}
                    </span>
                  )}
                </label>
              );
            })}
          </div>

          {/* Footer with actions */}
          <div
            className="flex items-center justify-between px-3 py-2 border-t-2 border-border-subtle"
            style={{ backgroundColor: '#334155' }}
          >
            <span className="text-xs text-content-muted">
              {selectedCount} / {totalCount} entries
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={selectAll}
                className="text-xs text-accent hover:text-accent-light transition-colors"
              >
                All
              </button>
              <span className="text-content-muted">|</span>
              <button
                type="button"
                onClick={clearAll}
                className="text-xs text-content-muted hover:text-content-secondary transition-colors"
              >
                Clear
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


export default TypeFilterDropdown;
