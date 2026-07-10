/**
 * @module Toggle
 * @description On/off switch with optional label.
 *
 * PRESENTATIONAL — renders a toggle switch, no domain logic.
 *
 * Uses accent color tokens for the active state and depth/surface
 * tokens for the inactive track.
 *
 * @upstream Called by: Settings panels, feature toggles
 * @downstream Calls: None — leaf presentational component
 */

interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  disabled?: boolean;
  className?: string;
}

export function Toggle({ checked, onChange, label, disabled = false, className = '' }: ToggleProps) {
  return (
    <label
      className={`
        inline-flex items-center gap-2 select-none
        ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
        ${className}
      `}
    >
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`
          relative inline-flex h-5 w-9 shrink-0 rounded-full
          transition-colors duration-fast
          focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]
          ${checked ? 'bg-accent' : 'bg-depth border border-border-subtle'}
        `}
      >
        <span
          className={`
            pointer-events-none inline-block h-4 w-4 rounded-full
            bg-content-primary shadow-sm
            transition-transform duration-fast
            ${checked ? 'translate-x-4' : 'translate-x-0.5'}
            mt-0.5
          `}
        />
      </button>
      {label && (
        <span className="text-sm text-content-secondary">{label}</span>
      )}
    </label>
  );
}
