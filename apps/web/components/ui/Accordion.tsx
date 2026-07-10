/**
 * @module Accordion
 * @description Animated disclosure component replacing native <details> elements.
 * Provides smooth height animations, chevron rotation, and controlled/uncontrolled modes.
 *
 * @upstream Called by: ClaudeExistenceLoop.jsx, MemoryTab, GalleryTab, SettingsTab, VoiceTab, ErrorBoundary
 * @downstream Calls: Icon component (ChevronRight)
 *
 * @example
 * // Uncontrolled (manages own state)
 * <Accordion title="Section Title" defaultOpen={true}>
 *   <p>Content here</p>
 * </Accordion>
 *
 * // Controlled (parent manages state)
 * <Accordion
 *   title="Controlled Section"
 *   isOpen={isOpen}
 *   onToggle={setIsOpen}
 * >
 *   <p>Content here</p>
 * </Accordion>
 *
 * // With custom icon and count badge
 * <Accordion
 *   title="Items"
 *   icon={<Icon name="Folder" size={16} />}
 *   count={42}
 * >
 *   <ItemList />
 * </Accordion>
 */

import { useState, useRef, useEffect } from 'react';
import { Icon } from './Icon';

interface AccordionProps {
  title: string | React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
  isOpen?: boolean;
  onToggle?: (isOpen: boolean) => void;
  icon?: React.ReactNode;
  count?: number | string;
  variant?: 'default' | 'card';
  className?: string;
}

/**
 * @description Animated accordion/disclosure component with smooth height transitions
 *
 * @param {Object} props - Component props
 * @param {string|React.ReactNode} props.title - Accordion header title
 * @param {React.ReactNode} props.children - Content to show when expanded
 * @param {boolean} props.defaultOpen - Initial open state (uncontrolled mode) (default: false)
 * @param {boolean} props.isOpen - Controlled open state (controlled mode)
 * @param {Function} props.onToggle - Callback when toggled: (isOpen) => void
 * @param {React.ReactNode} props.icon - Optional icon to show before title
 * @param {number|string} props.count - Optional count/badge to show after title
 * @param {string} props.variant - Style variant: 'default' | 'card' (default: 'default')
 * @param {string} props.className - Additional CSS classes for container (default: '')
 * @returns {JSX.Element} The accordion component
 *
 * @note Component supports both controlled and uncontrolled modes.
 * If isOpen prop is provided, it operates in controlled mode.
 */
export function Accordion({
  title,
  children,
  defaultOpen = false,
  isOpen: controlledIsOpen,
  onToggle,
  icon,
  count,
  variant = 'default',
  className = '',
}: AccordionProps) {
  // Determine if we're in controlled mode
  const isControlled = controlledIsOpen !== undefined;
  const [internalOpen, setInternalOpen] = useState(defaultOpen);
  const isOpen = isControlled ? controlledIsOpen : internalOpen;

  // Refs for animation
  const contentRef = useRef<any>(null);
  const [contentHeight, setContentHeight] = useState(0);

  /**
   * @description Update content height for animation
   */
  useEffect(() => {
    if (contentRef.current) {
      setContentHeight(contentRef.current.scrollHeight);
    }
  }, [children, isOpen]);

  /**
   * @description Handle toggle click
   */
  const handleToggle = () => {
    const newState = !isOpen;

    if (isControlled) {
      onToggle?.(newState);
    } else {
      setInternalOpen(newState);
      onToggle?.(newState);
    }
  };

  // Variant-specific classes
  const variantClasses = {
    default: '',
    card: 'card',
  };

  return (
    <div className={`${variantClasses[variant]} ${className}`}>
      {/* Header/trigger */}
      <button
        type="button"
        onClick={handleToggle}
        className={`
          w-full flex items-center gap-2
          p-3 text-left
          transition-colors duration-150
          ${variant === 'card' ? '' : 'hover:bg-depth rounded-md'}
          focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/50
        `}
        aria-expanded={isOpen}
      >
        {/* Chevron */}
        <Icon
          name="ChevronRight"
          size={16}
          className={`
            text-content-muted flex-shrink-0
            transition-transform duration-200
            ${isOpen ? 'rotate-90' : ''}
          `}
        />

        {/* Optional leading icon */}
        {icon && (
          <span className="flex-shrink-0 text-content-secondary">
            {icon}
          </span>
        )}

        {/* Title */}
        <span className="flex-1 text-content-primary font-medium text-sm">
          {title}
        </span>

        {/* Optional count badge */}
        {count !== undefined && (
          <span className="text-content-muted text-xs font-mono">
            {count}
          </span>
        )}
      </button>

      {/* Animated content container */}
      <div
        className="overflow-hidden transition-all duration-200 ease-out"
        style={{
          height: isOpen ? contentHeight : 0,
          opacity: isOpen ? 1 : 0,
        }}
      >
        <div
          ref={contentRef}
          className={`
            ${variant === 'card' ? 'px-3 pb-3 border-t border-border-subtle' : 'pl-8 pr-3 pb-3'}
          `}
        >
          {children}
        </div>
      </div>
    </div>
  );
}


export default Accordion;
