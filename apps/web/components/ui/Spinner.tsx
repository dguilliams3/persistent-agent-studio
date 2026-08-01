/**
 * @module Spinner
 * @description Loading indicator for Suspense fallbacks and async states.
 *
 * PRESENTATIONAL — animated spinner, no domain logic.
 *
 * Uses the Loader2 icon from lucide-react with CSS spin animation.
 * Accent color token for the spinner color.
 *
 * @upstream Called by: React.lazy Suspense fallback, loading states
 * @downstream Calls: Icon (Loader2)
 * @pattern UI Primitive — stateless, no domain logic
 */

import { Icon } from './Icon';

interface SpinnerProps {
  size?: number;
  className?: string;
}

export function Spinner({ size = 24, className = '' }: SpinnerProps) {
  return (
    <div className={`flex items-center justify-center ${className}`} role="status">
      <Icon
        name="Loader2"
        size={size}
        className="text-accent animate-spin"
      />
      <span className="sr-only">Loading...</span>
    </div>
  );
}
