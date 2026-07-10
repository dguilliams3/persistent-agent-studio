/**
 * @module Badge
 * @description Small status/severity label with variant-based coloring.
 *
 * PRESENTATIONAL — renders a pill-shaped label, no domain logic.
 *
 * Uses CSS utility classes from index.css (.badge-info, .badge-success, etc.)
 * for consistent styling across the design system.
 *
 * @upstream Called by: Status indicators, list items, cards
 * @downstream Calls: None — leaf presentational component
 * @pattern UI Primitive — stateless, variant-driven, no domain logic
 */

import type { ReactNode } from 'react';

type BadgeVariant = 'info' | 'success' | 'warning' | 'danger';

interface BadgeProps {
  variant?: BadgeVariant;
  children: ReactNode;
  className?: string;
}

const variantClasses: Record<BadgeVariant, string> = {
  info: 'badge-info',
  success: 'badge-success',
  warning: 'badge-warning',
  danger: 'badge-danger',
};

export function Badge({ variant = 'info', children, className = '' }: BadgeProps) {
  return (
    <span className={`${variantClasses[variant]} ${className}`}>
      {children}
    </span>
  );
}
