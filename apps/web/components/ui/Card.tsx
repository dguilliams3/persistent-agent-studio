/**
 * @module Card
 * @description Container with optional severity border indicator.
 *
 * PRESENTATIONAL — pure layout wrapper, no state or side effects.
 *
 * Severity borders use semantic color tokens from the design system.
 * Default (no severity) uses the standard .card CSS class.
 *
 * @upstream Called by: Dashboard panels, content containers
 * @downstream Calls: None — leaf presentational component
 * @pattern UI Primitive — stateless, variant-driven, no domain logic
 */

import type { ReactNode } from 'react';

type Severity = 'info' | 'warn' | 'flag';

interface CardProps {
  children: ReactNode;
  severity?: Severity;
  className?: string;
}

const severityBorderClasses: Record<Severity, string> = {
  info: 'border-l-2 border-l-accent',
  warn: 'border-l-2 border-l-warning',
  flag: 'border-l-2 border-l-danger',
};

export function Card({ children, severity, className = '' }: CardProps) {
  return (
    <div
      className={`
        card p-4
        ${severity ? severityBorderClasses[severity] : ''}
        ${className}
      `}
    >
      {children}
    </div>
  );
}
