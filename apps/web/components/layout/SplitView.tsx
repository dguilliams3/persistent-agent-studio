/**
 * Split View — Laptop Two-Pane Layout
 *
 * @module components/layout/SplitView
 * @description Two-pane layout for laptop breakpoint (> 1024px).
 * Chat pane on the left (flex:1), tool panel on the right — 340px at the
 * small end, growing with the viewport (30vw, capped 560px) from 1440px up:
 * a fixed ~340px panel was the root of the 1440-1600px clipping class
 * ("↻ Loa" severed, wrapped metric cards — MERGED_LEDGER §2 row 9) while
 * the chat column idled at 1000px+.
 * Rail switches which panel is active on the right side.
 * Clicking the active rail icon again closes the panel (chat goes full width).
 *
 * @antipattern Do NOT use raw hex colors — use CSS custom properties.
 * @antipattern Do NOT fetch data here — stores fetch, components read.
 * @antipattern Do NOT stretch controls full-width on laptop.
 *
 * @upstream Called by: AppShell (laptop breakpoint only)
 * @downstream Calls: ChatPane, tool panel views (MemoryView, MediaView, etc.)
 */

import React from 'react';
import { ChatPane } from './ChatPane';
import type { ActiveView } from '../../types';

/** CSS for panel slide-in animation + responsive docked-panel width. */
const PANEL_ANIMATION_STYLES = `
@keyframes panelSlideIn {
  from { opacity: 0; transform: translateX(20px); }
  to { opacity: 1; transform: translateX(0); }
}
.split-view-panel {
  animation: panelSlideIn var(--duration-normal) ease-out;
}
@media (prefers-reduced-motion: reduce) {
  .split-view-panel {
    animation: none !important;
  }
}
/* Docked (chat visible) panel width lives here, not inline, because it is
   responsive: wide viewports give the panel real room instead of clipping
   its content at ~340px (ledger §2 row 9). */
.split-view-panel--docked {
  flex: 0 0 340px;
  min-width: 280px;
  max-width: 400px;
}
@media (min-width: 1440px) {
  .split-view-panel--docked {
    flex-basis: clamp(340px, 30vw, 560px);
    max-width: 560px;
  }
}
`;

export interface SplitViewProps {
  /** The currently active tool panel view, or null if panel is closed. */
  activePanel: ActiveView | null;
  /** Whether chat pane is collapsed (research mode). */
  chatCollapsed: boolean;
  /** Callback to collapse/expand chat pane. */
  onToggleChatCollapse: () => void;
  /** The chat view element to render in the chat pane. */
  chatContent: React.ReactNode;
  /** The tool panel content to render on the right. */
  panelContent: React.ReactNode;
}

/**
 * SplitView — laptop two-pane layout.
 *
 * Chat left + tool panel right. When no panel is active, chat takes
 * full width. When chat is collapsed, panel expands to full width
 * (research mode).
 */
export function SplitView({
  activePanel,
  chatCollapsed,
  onToggleChatCollapse,
  chatContent,
  panelContent,
}: SplitViewProps) {
  const panelOpen = activePanel !== null && activePanel !== 'chat';

  return (
    <div
      style={{
        display: 'flex',
        height: '100%',
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      <style>{PANEL_ANIMATION_STYLES}</style>
      {/* Chat pane — flex:1, hides when collapsed */}
      <ChatPane
        collapsed={chatCollapsed}
        onToggleCollapse={panelOpen ? onToggleChatCollapse : undefined}
        showCollapseButton={panelOpen}
      >
        {chatContent}
      </ChatPane>

      {/* Tool panel — right side when open; width via .split-view-panel--docked */}
      {panelOpen && (
        <div
          className={`split-view-panel${chatCollapsed ? '' : ' split-view-panel--docked'}`}
          style={{
            width: chatCollapsed ? '100%' : undefined,
            flex: chatCollapsed ? 1 : undefined,
            height: '100%',
            overflow: 'hidden',
            borderLeft: chatCollapsed ? 'none' : '1px solid var(--border-subtle)',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {/* Research mode wrapper — centers content with max-width */}
          {chatCollapsed ? (
            <div
              style={{
                flex: 1,
                overflow: 'hidden',
                display: 'flex',
                justifyContent: 'center',
              }}
            >
              <div
                style={{
                  width: '100%',
                  maxWidth: '1200px',
                  height: '100%',
                  overflow: 'hidden',
                  display: 'flex',
                  flexDirection: 'column',
                }}
              >
                {panelContent}
              </div>
            </div>
          ) : (
            panelContent
          )}
        </div>
      )}
    </div>
  );
}

export default SplitView;
