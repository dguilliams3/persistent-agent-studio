/**
 * @module Button
 * @description Styled button with variant, size, and disabled support.
 *
 * PRESENTATIONAL — pure interactive element, no domain logic.
 *
 * Uses CSS utility classes from index.css (.btn-primary, .btn-secondary, etc.)
 * for consistent styling across the design system.
 *
 * @upstream Called by: All interactive components
 * @downstream Calls: None — leaf presentational component
 * @pattern UI Primitive — stateless, variant-driven, no domain logic
 */

import type { ReactNode, ButtonHTMLAttributes } from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'className'> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  children: ReactNode;
  className?: string;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary: 'btn-primary',
  secondary: 'btn-secondary',
  danger: 'btn-danger',
  ghost: 'btn-ghost',
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'px-2 py-1 text-sm',
  md: 'px-4 py-2 text-sm',
  lg: 'px-6 py-3 text-base',
};

export function Button({
  variant = 'primary',
  size = 'md',
  disabled = false,
  children,
  className = '',
  ...props
}: ButtonProps) {
  return (
    <button
      type="button"
      disabled={disabled}
      className={`
        ${variantClasses[variant]} ${sizeClasses[size]}
        focus-visible:outline-none
        ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
        ${className}
      `}
      {...props}
    >
      {children}
    </button>
  );
}
