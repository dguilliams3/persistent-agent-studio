/**
 * Split View — Laptop Two-Pane Layout
 *
 * @module components/layout/SplitView
 * @description Two-pane layout for laptop breakpoint (> 1024px).
 * Chat pane on the left (flex:1), tool panel on the right (280-400px).
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

/** CSS for panel slide-in animation. */
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

      {/* Tool panel — right side, 280-400px when open */}
      {panelOpen && (
        <div
          className="split-view-panel"
          style={{
            width: chatCollapsed ? '100%' : undefined,
            flex: chatCollapsed ? 1 : undefined,
            minWidth: chatCollapsed ? undefined : '280px',
            maxWidth: chatCollapsed ? undefined : '400px',
            flexBasis: chatCollapsed ? undefined : '340px',
            flexShrink: chatCollapsed ? undefined : 0,
            flexGrow: chatCollapsed ? undefined : 0,
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
