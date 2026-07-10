/**
 * Think Trigger Component
 *
 * @module components/chat/ThinkTrigger
 * @description Inline trigger for initiating a think cycle.
 * Three states: idle, thinking, hidden.
 *
 * - idle (mobile): Centered divider line "——— ↻ think now ———"
 * - idle (laptop): Pill button with hover state, min 36px height
 * - thinking: Three breathing dots replace the divider/button
 * - hidden: When no messages exist, renders nothing
 *
 * Breathing dots prevent double-tap by hiding the trigger during thinking.
 * Respects prefers-reduced-motion: skip animation, show static dots.
 *
 * @antipattern Do NOT call store actions directly — use the onThink callback.
 * @antipattern Do NOT use raw hex colors — use design tokens.
 *
 * @upstream Called by: ChatView
 * @downstream Calls: onThink callback
 */

import React from 'react';

/** Possible visual states for the think trigger. */
export type ThinkTriggerState = 'idle' | 'thinking' | 'hidden';

/** Props for the ThinkTrigger component. */
export interface ThinkTriggerProps {
  /** Current visual state of the trigger */
  state: ThinkTriggerState;
  /** Callback fired when the user taps "think now" */
  onThink: () => void;
}

/**
 * CSS keyframes for the breathing dot animation.
 * Injected once via a <style> tag within the component.
 */
const BREATHING_KEYFRAMES = `
@keyframes breathingDot {
  0%, 100% { opacity: 0.3; transform: scale(0.8); }
  50% { opacity: 1; transform: scale(1.2); }
}

@media (prefers-reduced-motion: reduce) {
  .think-trigger-dot {
    animation: none !important;
    opacity: 0.7 !important;
    transform: scale(1) !important;
  }
}
`;

/**
 * Three breathing dots shown while the persona is thinking.
 * Animation: 2s ease-in-out, staggered 0s / 0.3s / 0.6s.
 * prefers-reduced-motion: static dots with no animation.
 */
function BreathingDots() {
  const dotStyle = (delaySeconds: number): React.CSSProperties => ({
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    backgroundColor: 'var(--text-muted)',
    animation: `breathingDot 2s ease-in-out ${delaySeconds}s infinite`,
  });

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '6px',
        padding: 'var(--spacing-md) 0',
        minHeight: '44px',
      }}
      aria-label="Thinking..."
      role="status"
    >
      <div className="think-trigger-dot" style={dotStyle(0)} />
      <div className="think-trigger-dot" style={dotStyle(0.3)} />
      <div className="think-trigger-dot" style={dotStyle(0.6)} />
    </div>
  );
}

/**
 * Inline think trigger that sits below the last message in chat.
 *
 * Mobile: centered divider line with "↻ think now" text
 * Laptop (>= 1024px): pill button with hover state
 */
export function ThinkTrigger({ state, onThink }: ThinkTriggerProps) {
  if (state === 'hidden') {
    return null;
  }

  if (state === 'thinking') {
    return (
      <>
        <style>{BREATHING_KEYFRAMES}</style>
        <BreathingDots />
      </>
    );
  }

  /* idle state */
  return (
    <>
      <style>{BREATHING_KEYFRAMES}</style>

      {/* Mobile: divider line with think trigger text */}
      <div
        className="think-trigger-mobile"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 'var(--spacing-sm)',
          padding: 'var(--spacing-md) 0',
          minHeight: '44px',
        }}
      >
        <button
          onClick={onThink}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--spacing-sm)',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: 'var(--text-muted)',
            fontSize: '0.8125rem',
            padding: 'var(--spacing-sm) var(--spacing-md)',
            minHeight: '44px',
            minWidth: '44px',
            width: '100%',
            justifyContent: 'center',
          }}
          aria-label="Trigger think cycle"
        >
          <span
            style={{
              color: 'var(--text-muted)',
              letterSpacing: '0.1em',
              userSelect: 'none',
            }}
          >
            ———
          </span>
          <span style={{ color: 'var(--accent)' }}>↻ think now</span>
          <span
            style={{
              color: 'var(--text-muted)',
              letterSpacing: '0.1em',
              userSelect: 'none',
            }}
          >
            ———
          </span>
        </button>
      </div>

      {/* Laptop: pill button variant — shown at >= 1024px, hides mobile variant */}
      <style>{`
        .think-trigger-laptop {
          display: none;
        }
        @media (min-width: 1024px) {
          .think-trigger-mobile {
            display: none !important;
          }
          .think-trigger-laptop {
            display: flex !important;
          }
        }
        .think-trigger-pill:hover {
          background-color: var(--accent) !important;
          color: var(--text-primary) !important;
        }
      `}</style>

      <div
        className="think-trigger-laptop"
        style={{
          display: 'none',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 'var(--spacing-md) 0',
        }}
      >
        <button
          className="think-trigger-pill"
          onClick={onThink}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 'var(--spacing-sm)',
            padding: 'var(--spacing-sm) var(--spacing-xl)',
            minHeight: '44px',
            minWidth: '44px',
            borderRadius: '22px',
            border: '1px solid var(--border)',
            background: 'var(--surface)',
            color: 'var(--text-secondary)',
            fontSize: '0.8125rem',
            cursor: 'pointer',
            transition: 'background-color var(--duration-normal) ease-out, color var(--duration-normal) ease-out',
          }}
          aria-label="Trigger think cycle"
        >
          <span>↻</span>
          <span>think now</span>
        </button>
      </div>
    </>
  );
}

export default ThinkTrigger;
