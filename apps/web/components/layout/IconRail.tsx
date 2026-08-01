/**
 * Icon Rail Navigation
 *
 * @module components/layout/IconRail
 * @description Vertical navigation strip with persona avatar at top,
 * primary view icons (Chat, Memory, Media, Editor — plus SIM in the demo
 * exhibit, where it is the marquee feature), and dimmed secondary icons
 * (Voice, Settings; SIM lives here only in real deployments). Every glyph
 * carries a small text label — three of six reviewers read the unlabeled
 * rail as "8 anonymous glyphs" (MERGED_LEDGER §2 row 10).
 * Active icon highlighted with accent background.
 *
 * Width: 52px. Mobile: hidden by default, shown via `visible` prop.
 * Tablet/Laptop: always visible.
 *
 * @antipattern Do NOT use raw hex colors — use CSS custom properties.
 * @antipattern Do NOT fetch data here — this is a pure navigation component.
 *
 * @upstream Called by: AppShell
 * @downstream Calls: Lucide icons, store (activePersona read-only)
 */

import React, { useState } from 'react';
import {
  MessageCircle,
  Brain,
  Palette,
  PenTool,
  Mic,
  Settings,
  BarChart3,
} from 'lucide-react';
import type { ActiveView } from '../../types';
import { DEMO_MODE } from '../../api/client';

/** Props for an individual rail icon button. */
interface RailIconProps {
  icon: React.ReactNode;
  label: string;
  /** Longer name for title/aria when the visible label is an acronym. */
  a11yLabel?: string;
  view: ActiveView;
  active: boolean;
  dimmed?: boolean;
  onNavigate: (view: ActiveView) => void;
}

function RailIcon({ icon, label, a11yLabel, view, active, dimmed, onNavigate }: RailIconProps) {
  return (
    <button
      onClick={() => onNavigate(view)}
      title={a11yLabel ?? label}
      aria-label={a11yLabel ?? label}
      aria-current={active ? 'page' : undefined}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '2px',
        width: '48px',
        minHeight: '48px',
        minWidth: '44px',
        borderRadius: 'var(--radius-md)',
        border: 'none',
        cursor: 'pointer',
        backgroundColor: active ? 'var(--accent)' : 'transparent',
        color: active
          ? 'var(--text-primary)'
          : dimmed
            ? 'var(--text-muted)'
            : 'var(--text-secondary)',
        opacity: dimmed && !active ? 0.5 : 1,
        transition: `background-color var(--duration-normal) ease-out,
                     color var(--duration-normal) ease-out`,
        padding: '5px 0 4px',
        flexShrink: 0,
      }}
    >
      {icon}
      <span
        style={{
          fontSize: '0.5625rem',
          fontWeight: 500,
          lineHeight: 1,
          letterSpacing: '0.02em',
          userSelect: 'none',
          maxWidth: '48px',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
        aria-hidden="true"
      >
        {label}
      </span>
    </button>
  );
}

/** One nav item's render config. */
interface RailItem {
  view: ActiveView;
  label: string;
  a11yLabel?: string;
  icon: React.ReactNode;
}

/** SIM — primary in the demo exhibit (the marquee feature, §2 row 10),
 * secondary next to Settings only in real deployments. */
const SIM_ITEM: RailItem = {
  view: 'sim',
  label: 'SIM',
  a11yLabel: 'Semantic Identity Monitor (SIM)',
  icon: <BarChart3 size={20} />,
};

/** Primary navigation items shown in the rail. */
const PRIMARY_ITEMS: RailItem[] = [
  { view: 'chat', label: 'Chat', icon: <MessageCircle size={20} /> },
  { view: 'memory', label: 'Memory', icon: <Brain size={20} /> },
  { view: 'media', label: 'Media', icon: <Palette size={20} /> },
  { view: 'editor', label: 'Editor', icon: <PenTool size={20} /> },
  ...(DEMO_MODE ? [SIM_ITEM] : []),
];

/** Secondary (dimmed) navigation items. */
const SECONDARY_ITEMS: RailItem[] = [
  { view: 'voice', label: 'Voice', icon: <Mic size={20} /> },
  { view: 'settings', label: 'Settings', icon: <Settings size={20} /> },
  ...(DEMO_MODE ? [] : [SIM_ITEM]),
];

export interface IconRailProps {
  /** Currently active view. */
  activeView: ActiveView;
  /** Callback when a rail icon is tapped. */
  onNavigate: (view: ActiveView) => void;
  /** Whether the rail is visible (mobile toggle). */
  visible?: boolean;
  /** Persona name for avatar fallback (first letter). */
  personaName?: string;
  /** Persona profile picture URL (optional). */
  personaAvatar?: string | null;
  /** Called when rail overlay backdrop is tapped (mobile dismiss). */
  onClose?: () => void;
}

/**
 * IconRail — vertical icon strip navigation.
 *
 * Avatar at top, primary icons, separator, dimmed secondary icons.
 * 52px wide. On mobile, rendered as overlay with backdrop.
 */
/** CSS for mobile rail slide animation. */
const RAIL_ANIMATION_STYLES = `
.icon-rail-backdrop {
  opacity: 0;
  transition: opacity var(--duration-normal) ease-out;
  pointer-events: none;
}
.icon-rail-backdrop--visible {
  opacity: 1;
  pointer-events: auto;
}
.icon-rail-nav {
  transform: translateX(-100%);
  transition: transform var(--duration-normal) ease-out;
}
.icon-rail-nav--visible {
  transform: translateX(0);
}
.icon-rail-nav--no-slide {
  transform: none;
}
@media (prefers-reduced-motion: reduce) {
  .icon-rail-backdrop,
  .icon-rail-nav {
    transition: none !important;
  }
}
`;

export function IconRail({
  activeView,
  onNavigate,
  visible = true,
  personaName = 'Persona',
  personaAvatar,
  onClose,
}: IconRailProps) {
  const initial = personaName.charAt(0).toUpperCase();
  const [hasAvatarError, setHasAvatarError] = useState(false);
  const isMobileOverlay = !!onClose;

  /** On non-mobile, always visible. On mobile, control via visible prop. */
  if (!visible && !isMobileOverlay) return null;

  return (
    <>
      <style>{RAIL_ANIMATION_STYLES}</style>

      {/* Backdrop for mobile overlay mode */}
      {isMobileOverlay && (
        <div
          onClick={onClose}
          className={`icon-rail-backdrop ${visible ? 'icon-rail-backdrop--visible' : ''}`}
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'var(--scrim)',
            zIndex: 49,
          }}
          aria-hidden="true"
        />
      )}

      <nav
        role="navigation"
        aria-label="Main navigation"
        className={`icon-rail-nav ${
          isMobileOverlay
            ? (visible ? 'icon-rail-nav--visible' : '')
            : 'icon-rail-nav--no-slide'
        }`}
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          width: '52px',
          minWidth: '52px',
          height: '100%',
          backgroundColor: 'var(--surface)',
          borderRight: '1px solid var(--border-subtle)',
          padding: 'var(--spacing-sm) 0',
          gap: 'var(--spacing-xs)',
          /* position:relative is LOAD-BEARING: without it z-index is ignored
             (static elements) and the transformed nav paints at effective z-0,
             UNDER the fixed backdrop (z-49) — icons render scrimmed-over and
             untappable on mobile. Bug shipped with the overlay since the UI
             overhaul; root-caused 2026-07-04 (RUN-20260704-1520). */
          position: 'relative',
          zIndex: 50,
          overflowY: 'auto',
          overflowX: 'hidden',
        }}
      >
        {/* Persona avatar — profile pic or gradient initial */}
        <div
          style={{
            width: '36px',
            height: '36px',
            borderRadius: '50%',
            overflow: 'hidden',
            marginBottom: 'var(--spacing-sm)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: personaAvatar && !hasAvatarError
              ? 'transparent'
              : 'linear-gradient(135deg, var(--accent), var(--accent-light))',
            color: 'var(--text-primary)',
            fontSize: '0.875rem',
            fontWeight: 600,
            flexShrink: 0,
          }}
        >
          {personaAvatar && !hasAvatarError ? (
            <img
              src={personaAvatar}
              alt={`${personaName} avatar`}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              onError={() => setHasAvatarError(true)}
            />
          ) : (
            initial
          )}
        </div>

        {/* Primary icons */}
        {PRIMARY_ITEMS.map((item) => (
          <RailIcon
            key={item.view}
            icon={item.icon}
            label={item.label}
            a11yLabel={item.a11yLabel}
            view={item.view}
            active={activeView === item.view}
            onNavigate={onNavigate}
          />
        ))}

        {/* Spacer pushes secondary items toward bottom */}
        <div style={{ flex: 1 }} />

        {/* Separator */}
        <div
          style={{
            width: '24px',
            height: '1px',
            backgroundColor: 'var(--border)',
            margin: 'var(--spacing-xs) 0',
            flexShrink: 0,
          }}
        />

        {/* Secondary (dimmed) icons */}
        {SECONDARY_ITEMS.map((item) => (
          <RailIcon
            key={item.view}
            icon={item.icon}
            label={item.label}
            a11yLabel={item.a11yLabel}
            view={item.view}
            active={activeView === item.view}
            dimmed
            onNavigate={onNavigate}
          />
        ))}

        {/* Bottom padding */}
        <div style={{ height: 'var(--spacing-sm)', flexShrink: 0 }} />
      </nav>
    </>
  );
}

export default IconRail;
