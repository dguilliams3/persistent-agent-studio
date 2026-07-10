/**
 * Chat Pane — Collapsible Chat Column
 *
 * @module components/layout/ChatPane
 * @description Wraps ChatView with collapse functionality for laptop layout.
 * Collapse arrow hides chat, allowing the tool panel to go full width
 * (research mode). Click chat rail icon to restore.
 *
 * Animation: 200ms ease-out translateX for collapse/expand.
 * Respects prefers-reduced-motion: instant collapse, no animation.
 *
 * @antipattern Do NOT use raw hex colors — use CSS custom properties.
 * @antipattern Do NOT float content over other content.
 *
 * @upstream Called by: SplitView
 * @downstream Calls: children (ChatView)
 */

import React from 'react';
import { PanelLeftClose } from 'lucide-react';

/** CSS for collapse animation and reduced-motion support. */
const CHAT_PANE_STYLES = `
.chat-pane {
  transition: transform var(--duration-normal) ease-out,
              flex var(--duration-normal) ease-out,
              min-width var(--duration-normal) ease-out,
              opacity var(--duration-normal) ease-out;
}
.chat-pane--collapsed {
  transform: translateX(-100%);
  position: absolute;
  opacity: 0;
  pointer-events: none;
}
@media (prefers-reduced-motion: reduce) {
  .chat-pane {
    transition: none;
  }
}
`;

export interface ChatPaneProps {
  /** Whether the chat pane is collapsed. */
  collapsed: boolean;
  /** Callback to toggle collapse state. Undefined hides the button. */
  onToggleCollapse?: () => void;
  /** Whether to show the collapse button. */
  showCollapseButton?: boolean;
  /** Chat content (ChatView). */
  children: React.ReactNode;
}

/**
 * ChatPane — collapsible wrapper for chat in laptop SplitView.
 *
 * When collapsed, translateX(-100%) slides it off screen and the tool
 * panel fills the available space (research mode).
 */
export function ChatPane({
  collapsed,
  onToggleCollapse,
  showCollapseButton = false,
  children,
}: ChatPaneProps) {
  return (
    <>
      <style>{CHAT_PANE_STYLES}</style>
      <div
        className={`chat-pane ${collapsed ? 'chat-pane--collapsed' : ''}`}
        style={{
          flex: collapsed ? 0 : 1,
          minWidth: collapsed ? 0 : '300px',
          height: '100%',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          position: collapsed ? 'absolute' : 'relative',
        }}
      >
        {/* Collapse button — top-right of chat pane */}
        {showCollapseButton && onToggleCollapse && !collapsed && (
          <div
            style={{
              display: 'flex',
              justifyContent: 'flex-end',
              padding: 'var(--spacing-xs) var(--spacing-sm)',
              borderBottom: '1px solid var(--border-subtle)',
              backgroundColor: 'var(--background)',
            }}
          >
            <button
              onClick={onToggleCollapse}
              aria-label="Collapse chat"
              title="Collapse chat (research mode)"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                minWidth: '44px',
                minHeight: '44px',
                background: 'none',
                border: 'none',
                borderRadius: 'var(--radius-sm)',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                padding: 'var(--spacing-xs)',
                transition: 'color var(--duration-normal) ease-out',
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)';
              }}
            >
              <PanelLeftClose size={18} />
            </button>
          </div>
        )}

        {/* Chat content */}
        <div style={{ flex: 1, overflow: 'hidden' }}>
          {children}
        </div>
      </div>
    </>
  );
}

export default ChatPane;
