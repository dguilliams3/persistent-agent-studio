/**
 * @module Select
 * @description Custom styled dropdown component with keyboard navigation, animations, and accessibility.
 * Replaces native <select> elements with a fully customizable implementation.
 *
 * @upstream Called by: EditorTab, SettingsTab, VoiceTab
 * @downstream Calls: Icon component (ChevronDown)
 *
 * @example
 * // Basic usage
 * <Select
 *   value={selectedValue}
 *   onChange={setSelectedValue}
 *   options={[
 *     { value: 'opt1', label: 'Option 1' },
 *     { value: 'opt2', label: 'Option 2' },
 *   ]}
 * />
 *
 * // With placeholder and small size
 * <Select
 *   value={value}
 *   onChange={onChange}
 *   options={options}
 *   placeholder="Select an option..."
 *   size="sm"
 * />
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { Icon } from './Icon';

interface SelectProps {
  value?: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string; disabled?: boolean; title?: string }>;
  placeholder?: string;
  size?: 'sm' | 'md';
  disabled?: boolean;
  className?: string;
}

/**
 * @description Custom dropdown select component with keyboard navigation
 *
 * @param {Object} props - Component props
 * @param {string} props.value - Currently selected value
 * @param {Function} props.onChange - Callback when selection changes: (value) => void
 * @param {Array<{value: string, label: string}>} props.options - Available options
 * @param {string} props.placeholder - Placeholder when no value selected (default: 'Select...')
 * @param {string} props.size - Size variant: 'sm' | 'md' (default: 'md')
 * @param {boolean} props.disabled - Whether the select is disabled (default: false)
 * @param {string} props.className - Additional CSS classes for container (default: '')
 * @returns {JSX.Element} The select component
 *
 * @note Supports keyboard navigation: Enter/Space to open, Arrow keys to navigate, Escape to close
 */
export function Select({
  value,
  onChange,
  options,
  placeholder = 'Select...',
  size = 'md',
  disabled = false,
  className = '',
}: SelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const containerRef = useRef<any>(null);
  const listRef = useRef<any>(null);

  // Find the currently selected option for display
  const selectedOption = options.find(opt => opt.value === value);

  /**
   * @description Close dropdown when clicking outside
   */
  useEffect(() => {
    const handleClickOutside = (event: any) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  /**
   * @description Scroll focused option into view
   */
  useEffect(() => {
    if (isOpen && focusedIndex >= 0 && listRef.current) {
      const focusedElement = listRef.current.children[focusedIndex];
      if (focusedElement) {
        focusedElement.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [focusedIndex, isOpen]);

  const getNextEnabledIndex = useCallback((startIndex: number, direction: 1 | -1) => {
    if (options.length === 0) return -1;

    let index = startIndex;
    for (let count = 0; count < options.length; count += 1) {
      index += direction;
      if (index < 0 || index >= options.length) {
        break;
      }
      if (!options[index]?.disabled) {
        return index;
      }
    }

    return startIndex;
  }, [options]);

  const getFirstEnabledIndex = useCallback(() => {
    return options.findIndex((option) => !option.disabled);
  }, [options]);

  /**
   * @description Handle keyboard navigation
   * @param {KeyboardEvent} event - Keyboard event
   */
  const handleKeyDown = useCallback((event: any) => {
    if (disabled) return;

    switch (event.key) {
      case 'Enter':
      case ' ':
        event.preventDefault();
        if (isOpen && focusedIndex >= 0 && !options[focusedIndex]?.disabled) {
          onChange(options[focusedIndex].value);
          setIsOpen(false);
        } else {
          setIsOpen(true);
          const selectedIndex = options.findIndex(opt => opt.value === value && !opt.disabled);
          setFocusedIndex(selectedIndex >= 0 ? selectedIndex : getFirstEnabledIndex());
        }
        break;
      case 'Escape':
        setIsOpen(false);
        break;
      case 'ArrowDown':
        event.preventDefault();
        if (!isOpen) {
          setIsOpen(true);
          setFocusedIndex(getFirstEnabledIndex());
        } else {
          setFocusedIndex(prev => getNextEnabledIndex(prev < 0 ? -1 : prev, 1));
        }
        break;
      case 'ArrowUp':
        event.preventDefault();
        if (isOpen) {
          setFocusedIndex(prev => getNextEnabledIndex(prev < 0 ? options.length : prev, -1));
        }
        break;
      case 'Home':
        if (isOpen) {
          event.preventDefault();
          setFocusedIndex(getFirstEnabledIndex());
        }
        break;
      case 'End':
        if (isOpen) {
          event.preventDefault();
          setFocusedIndex(
            [...options].reverse().findIndex((option) => !option.disabled) >= 0
              ? options.length -
                  1 -
                  [...options].reverse().findIndex((option) => !option.disabled)
              : -1,
          );
        }
        break;
      default:
        break;
    }
  }, [disabled, focusedIndex, getFirstEnabledIndex, getNextEnabledIndex, isOpen, onChange, options, value]);

  /**
   * @description Handle option selection
   * @param {string} optionValue - Value of the selected option
   */
  const handleSelect = (optionValue: any) => {
    const option = options.find((item) => item.value === optionValue);
    if (option?.disabled) {
      return;
    }
    onChange(optionValue);
    setIsOpen(false);
  };

  // Size-specific classes
  const sizeClasses = {
    sm: 'px-2 py-1 text-sm',
    md: 'px-3 py-2 text-sm',
  };

  return (
    <div
      ref={containerRef}
      className={`relative ${className}`}
    >
      {/* Trigger button */}
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        className={`
          w-full flex items-center justify-between gap-2
          ${sizeClasses[size]}
          bg-surface border border-border-subtle rounded-md
          text-content-primary text-left
          transition-all duration-150
          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]
          ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:border-[var(--accent)] hover:bg-[var(--accent-soft)] cursor-pointer'}
          ${isOpen ? 'border-[var(--accent)]' : ''}
        `}
        style={{
          boxShadow: isOpen ? '0 0 0 2px var(--accent-soft)' : undefined,
        }}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <span className={selectedOption ? '' : 'text-content-muted'}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <Icon
          name="ChevronDown"
          size={16}
          className={`text-content-muted transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {/* Dropdown menu */}
      {isOpen && (
        <ul
          ref={listRef}
          role="listbox"
          className={`
            absolute z-[999] w-full mt-1
            bg-[rgb(var(--depth))] border border-[rgb(var(--border-strong))] rounded-md
            shadow-[var(--shadow-lg)] max-h-60 overflow-auto
            py-1
          `}
          style={{ backgroundColor: 'rgb(var(--depth))' }}
        >
          {options.map((option, index) => (
            <li
              key={option.value}
              role="option"
              aria-selected={option.value === value}
              aria-disabled={option.disabled}
              onClick={() => handleSelect(option.value)}
              onMouseEnter={() => !option.disabled && setFocusedIndex(index)}
              title={option.title}
              className={`
                ${sizeClasses[size]}
                transition-colors duration-100
                bg-[rgb(var(--depth))]
                ${option.value === value ? 'text-accent font-medium' : 'text-content-primary'}
                ${option.disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                ${index === focusedIndex && !option.disabled ? 'bg-[var(--accent-soft)]' : ''}
                ${!option.disabled ? 'hover:bg-[var(--accent-soft)]' : ''}
              `}
              style={{ backgroundColor: 'rgb(var(--depth))' }}
            >
              {option.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
