/**
 * Settings Section Component
 *
 * @module components/tabs/SettingsTab/SettingsSection
 * @description Collapsible section wrapper for Settings tab with icon support
 * and visual variants (default, danger).
 *
 * Neural Observatory Design:
 * - Default: subtle border, cyan accent on expand
 * - Danger: red border/tint for destructive operations
 * - Smooth expand/collapse animation
 * - Icon + title header with chevron indicator
 *
 * @upstream Called by: SettingsTab/index.jsx
 * @downstream Calls: Lucide icons
 *
 * @param {Object} props
 * @param {string} props.title - Section header text
 * @param {React.ElementType} [props.icon] - Lucide icon component
 * @param {string} [props.variant='default'] - 'default' | 'danger'
 * @param {boolean} [props.defaultOpen=true] - Start expanded
 * @param {string} [props.description] - Optional subtitle/description
 * @param {React.ReactNode} props.children - Section content
 * @returns {React.ReactElement}
 *
 * @example
 * <SettingsSection title="Model Settings" icon={Cpu} defaultOpen={true}>
 *   <ModelSelector ... />
 * </SettingsSection>
 *
 * <SettingsSection title="Danger Zone" icon={AlertTriangle} variant="danger">
 *   <DangerZone ... />
 * </SettingsSection>
 */

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';

/**
 * Variant styles configuration
 */
const VARIANTS = {
  default: {
    container: 'bg-surface border-border-subtle hover:border-accent/30',
    header: 'text-content-primary',
    icon: 'text-content-muted group-hover:text-accent',
    chevron: 'text-content-muted',
  },
  danger: {
    container: 'bg-rose-500/5 border-rose-500/30 hover:border-rose-500/50',
    header: 'text-rose-400',
    icon: 'text-rose-400/70',
    chevron: 'text-rose-400/70',
  },
};

interface SettingsSectionProps {
  title: string;
  icon?: React.ElementType;
  variant?: 'default' | 'danger';
  defaultOpen?: boolean;
  description?: string;
  children: React.ReactNode;
}

export default function SettingsSection({
  title,
  icon: Icon,
  variant = 'default',
  defaultOpen = true,
  description,
  children,
}: SettingsSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const styles = VARIANTS[variant] || VARIANTS.default;

  return (
    <div
      className={`
        rounded-xl border transition-colors duration-200
        ${styles.container}
      `}
    >
      {/* Header - clickable to expand/collapse */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center gap-3 px-4 py-3 group text-left"
      >
        {/* Icon */}
        {Icon && (
          <Icon
            size={18}
            className={`flex-shrink-0 transition-colors ${styles.icon}`}
          />
        )}

        {/* Title + description */}
        <div className="flex-1 min-w-0">
          <h3 className={`text-sm font-semibold ${styles.header}`}>
            {title}
          </h3>
          {description && (
            <p className="text-xs text-content-muted mt-0.5 truncate">
              {description}
            </p>
          )}
        </div>

        {/* Chevron indicator */}
        <ChevronDown
          size={18}
          className={`
            flex-shrink-0 transition-transform duration-200
            ${styles.chevron}
            ${isOpen ? 'rotate-180' : 'rotate-0'}
          `}
        />
      </button>

      {/* Content - collapsible */}
      <div
        className={`
          overflow-hidden transition-all duration-200 ease-out
          ${isOpen ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0'}
        `}
      >
        <div className="px-4 pb-4 pt-1 space-y-3">
          {children}
        </div>
      </div>
    </div>
  );
}


