/**
 * Shared loading skeleton primitive for app-level fallback states.
 *
 * @module components/ui/LoadingSkeleton
 * @description Unifies the previously divergent loading treatments used by
 * Suspense view fallbacks, chat bubble placeholders, and view-level row blocks.
 * Keeps all variants on design tokens and the existing global `skeleton-pulse`
 * animation class.
 *
 * Upstream: `apps/web/components/layout/AppShell.tsx::ViewSpinner`, `apps/web/views/ChatView.tsx::ChatView`, `apps/web/views/MediaView.tsx::MediaView`, `apps/web/views/EditorView.tsx::BranchesPanel`
 * Downstream: `apps/web/components/ui/Spinner.tsx::Spinner`
 * Pattern: UI Primitive - presentational loading states only
 * Do NOT: Fetch data or branch on domain logic here
 */

import { Spinner } from './Spinner';

type BubbleSide = 'left' | 'right';

export interface LoadingSkeletonProps {
  variant?: 'rows' | 'bubbles' | 'spinner';
  count?: number;
  label?: string;
  rowHeight?: number | string;
  trimLastRow?: boolean;
  className?: string;
  containerClassName?: string;
  itemClassName?: string;
  bubblePattern?: BubbleSide[];
}

function toCssSize(value: number | string): string {
  return typeof value === 'number' ? `${value}px` : value;
}

/**
 * LoadingSkeleton - shared primitive for skeleton rows, chat bubbles, and spinners.
 *
 * @param props.variant - rows, bubbles, or spinner
 * @param props.count - number of placeholders for row/bubble variants
 * @param props.label - visible label for spinner variant
 * @param props.rowHeight - per-row height for rows variant
 * @param props.className - outer wrapper class
 * @param props.containerClassName - inner list container class
 * @param props.itemClassName - per-item class overrides
 * @param props.bubblePattern - explicit left/right bubble sequence
 */
export function LoadingSkeleton({
  variant = 'rows',
  count = 3,
  label = 'Loading...',
  rowHeight = 56,
  trimLastRow = true,
  className = '',
  containerClassName = '',
  itemClassName = '',
  bubblePattern,
}: LoadingSkeletonProps) {
  if (variant === 'spinner') {
    return (
      <div
        className={`flex h-full flex-1 flex-col items-center justify-center gap-4 ${className}`}
        role="status"
      >
        <Spinner size={32} />
        <span className="text-sm text-content-muted">{label}</span>
      </div>
    );
  }

  if (variant === 'bubbles') {
    const pattern =
      bubblePattern ||
      Array.from({ length: count }, (_, index) =>
        index % 2 === 0 ? 'left' : 'right',
      );

    return (
      <div
        className={`flex flex-col gap-4 ${containerClassName} ${className}`}
        aria-hidden="true"
      >
        {pattern.map((side, index) => {
          const alignRight = side === 'right';
          return (
            <div
              key={`${side}-${index}`}
              style={{
                display: 'flex',
                justifyContent: alignRight ? 'flex-end' : 'flex-start',
                width: '100%',
              }}
            >
              <div
                className={`skeleton-pulse bg-surface ${itemClassName}`}
                style={{
                  width: alignRight ? '40%' : '65%',
                  minWidth: '120px',
                  maxWidth: '720px',
                  height: alignRight ? '48px' : '72px',
                  borderRadius: '16px',
                  borderBottomRightRadius: alignRight ? '4px' : '16px',
                  borderBottomLeftRadius: alignRight ? '16px' : '4px',
                }}
              />
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div
      className={`flex flex-col gap-3 ${containerClassName} ${className}`}
      aria-hidden="true"
    >
      {Array.from({ length: count }).map((_, index) => (
        <div
          key={index}
          className={`skeleton-pulse rounded-md bg-surface ${itemClassName}`}
          style={{
            height: toCssSize(rowHeight),
            width:
              trimLastRow && index === count - 1 && count > 1 ? '60%' : '100%',
          }}
        />
      ))}
    </div>
  );
}

export default LoadingSkeleton;
