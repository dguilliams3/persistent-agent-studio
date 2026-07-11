/**
 * Chat Bubble Component
 *
 * @module packages/ui/renderers/ChatBubble
 * @description Pure presentational bubble for a single history entry.
 * User messages render right-aligned with accent color.
 * Persona messages render left-aligned with surface color.
 *
 * @antipattern Do NOT import Zustand or any store — this is a pure renderer.
 * @antipattern Do NOT use raw hex colors — use CSS custom properties from tokens.css.
 * @antipattern Do NOT fetch data — accept everything via props.
 *
 * @upstream Called by: ChatBubbleView
 * @downstream Calls: None (leaf renderer)
 */

import React from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { HistoryEntry } from '@persistence/db';

/** Props required to render a single chat bubble. */
export interface ChatBubbleProps {
  /** The history entry to display */
  entry: HistoryEntry;
  /** Whether this is a user-authored message (right-aligned, accent color) */
  isUser: boolean;
  /** Whether the thinking/cycle detail panel is expanded below this bubble */
  expanded: boolean;
  /** Callback to toggle the expanded thinking panel for this entry's cycle */
  onToggleExpand: () => void;
  /**
   * Resolved URL of media attached to this entry (image shared mid-message).
   * When present, the bubble renders a compact disclosure chip that expands
   * the image inline — an explicit tap target so bubble text stays fully
   * selectable (never make the whole bubble clickable).
   */
  mediaUrl?: string | null;
}

/**
 * Formats a duration in seconds to a concise display string.
 * e.g. 12 -> "12s", 0 -> "0s"
 */
function formatDuration(seconds: number): string {
  return `${Math.round(seconds)}s`;
}

/**
 * Formats an entry timestamp as a short clock time ("2:45 PM").
 * Self-contained (packages/ui must not import app utilities). Accepts the
 * DB's "YYYY-MM-DD HH:MM:SS" format; returns '' if unparseable.
 */
function formatClockTime(timestamp: string | null | undefined): string {
  if (!timestamp) return '';
  const parsed = new Date(String(timestamp).replace(' ', 'T'));
  if (Number.isNaN(parsed.getTime())) return '';
  return parsed.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

/**
 * Extracts cycle metadata from a history entry's metadata JSON blob.
 * Returns null if no cycle data is available.
 */
function parseCycleMetadata(entry: HistoryEntry): {
  cycleId: number;
  durationSeconds: number;
} | null {
  if (entry.cycle_id == null) return null;

  let durationSeconds = 0;
  if (entry.metadata) {
    try {
      const parsed = JSON.parse(entry.metadata);
      durationSeconds = parsed.duration_seconds ?? 0;
    } catch {
      /* metadata is not valid JSON — ignore */
    }
  }

  return {
    cycleId: entry.cycle_id,
    durationSeconds,
  };
}

/**
 * Custom markdown component overrides for persona message rendering.
 * Styles headings, code blocks, links, and lists using design tokens.
 * Uses CSS custom properties — no raw hex colors.
 */
const MARKDOWN_COMPONENTS = {
  h1: ({ children, ...props }: React.HTMLAttributes<HTMLHeadingElement>) => (
    <h1 style={{ fontSize: '1.25rem', fontWeight: 600, margin: '0.5em 0 0.25em', color: 'var(--text-primary)' }} {...props}>{children}</h1>
  ),
  h2: ({ children, ...props }: React.HTMLAttributes<HTMLHeadingElement>) => (
    <h2 style={{ fontSize: '1.125rem', fontWeight: 600, margin: '0.5em 0 0.25em', color: 'var(--text-primary)' }} {...props}>{children}</h2>
  ),
  h3: ({ children, ...props }: React.HTMLAttributes<HTMLHeadingElement>) => (
    <h3 style={{ fontSize: '1rem', fontWeight: 600, margin: '0.5em 0 0.25em', color: 'var(--text-primary)' }} {...props}>{children}</h3>
  ),
  p: ({ children, ...props }: React.HTMLAttributes<HTMLParagraphElement>) => (
    <p style={{ margin: '0.25em 0', lineHeight: '1.5' }} {...props}>{children}</p>
  ),
  a: ({ children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a style={{ color: 'var(--accent-light)', textDecoration: 'underline' }} target="_blank" rel="noopener noreferrer" {...props}>{children}</a>
  ),
  code: ({ children, className, ...props }: React.HTMLAttributes<HTMLElement>) => {
    const isInline = !className;
    if (isInline) {
      return (
        <code
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: '0.85em',
            backgroundColor: 'var(--surface-raised)',
            padding: '0.1em 0.3em',
            borderRadius: '3px',
          }}
          {...props}
        >
          {children}
        </code>
      );
    }
    return (
      <code
        style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: '0.85em',
        }}
        className={className}
        {...props}
      >
        {children}
      </code>
    );
  },
  pre: ({ children, ...props }: React.HTMLAttributes<HTMLPreElement>) => (
    <pre
      style={{
        backgroundColor: 'var(--surface-raised)',
        fontFamily: "'JetBrains Mono', monospace",
        padding: 'var(--spacing-md)',
        borderRadius: 'var(--radius-sm)',
        overflowX: 'auto',
        margin: '0.5em 0',
        fontSize: '0.85em',
        lineHeight: '1.4',
      }}
      {...props}
    >
      {children}
    </pre>
  ),
  ul: ({ children, ...props }: React.HTMLAttributes<HTMLUListElement>) => (
    <ul style={{ margin: '0.25em 0', paddingLeft: '1.25em' }} {...props}>{children}</ul>
  ),
  ol: ({ children, ...props }: React.HTMLAttributes<HTMLOListElement>) => (
    <ol style={{ margin: '0.25em 0', paddingLeft: '1.25em' }} {...props}>{children}</ol>
  ),
  li: ({ children, ...props }: React.HTMLAttributes<HTMLLIElement>) => (
    <li style={{ margin: '0.15em 0' }} {...props}>{children}</li>
  ),
  blockquote: ({ children, ...props }: React.HTMLAttributes<HTMLQuoteElement>) => (
    <blockquote
      style={{
        borderLeft: '3px solid var(--accent)',
        paddingLeft: 'var(--spacing-md)',
        margin: '0.5em 0',
        color: 'var(--text-secondary)',
        fontStyle: 'italic',
      }}
      {...props}
    >
      {children}
    </blockquote>
  ),
  strong: ({ children, ...props }: React.HTMLAttributes<HTMLElement>) => (
    <strong style={{ fontWeight: 600, color: 'var(--text-primary)' }} {...props}>{children}</strong>
  ),
  em: ({ children, ...props }: React.HTMLAttributes<HTMLElement>) => (
    <em style={{ fontStyle: 'italic' }} {...props}>{children}</em>
  ),
};

/**
 * Single chat bubble for one history entry.
 *
 * - User bubbles: solid accent color, right-aligned, bottom-right corner squared
 * - Persona bubbles: surface color, left-aligned, bottom-left corner squared
 * - Persona messages show an expand indicator for cycle details
 * - User messages render as plain text; persona messages render via react-markdown
 */
export function ChatBubble({
  entry,
  isUser,
  expanded,
  onToggleExpand,
  mediaUrl = null,
}: ChatBubbleProps) {
  const cycleData = !isUser ? parseCycleMetadata(entry) : null;
  const [mediaOpen, setMediaOpen] = React.useState(false);

  return (
    <div
      style={{
        display: 'flex',
        justifyContent: isUser ? 'flex-end' : 'flex-start',
        width: '100%',
      }}
    >
      <div
        style={{
          maxWidth: '720px',
          width: 'fit-content',
          minWidth: '80px',
          backgroundColor: isUser
            ? 'var(--user-bubble)'
            : 'var(--persona-bubble)',
          color: 'var(--text-primary)',
          padding: 'var(--spacing-md) var(--spacing-lg)',
          borderRadius: '16px',
          ...(isUser
            ? { borderBottomRightRadius: '4px' }
            : { borderBottomLeftRadius: '4px' }),
          border: '1px solid var(--border-subtle)',
          wordBreak: 'break-word' as const,
        }}
      >
        {/* Message content — plain text for user, markdown for persona */}
        <div
          className="chat-bubble-content"
          style={{
            fontSize: '0.9375rem',
            lineHeight: '1.5',
            ...(isUser ? { whiteSpace: 'pre-wrap' as const } : {}),
          }}
        >
          {isUser ? (
            entry.content
          ) : (
            <Markdown
              remarkPlugins={[remarkGfm]}
              components={MARKDOWN_COMPONENTS}
            >
              {entry.content}
            </Markdown>
          )}
        </div>

        {/* In-bubble image disclosure — chip expands the image inline */}
        {mediaUrl && (
          <div style={{ marginTop: 'var(--spacing-sm)' }}>
            <button
              onClick={() => setMediaOpen((prev) => !prev)}
              aria-expanded={mediaOpen}
              aria-label={mediaOpen ? 'Collapse image' : 'Expand image'}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 'var(--spacing-xs)',
                padding: '4px 10px',
                borderRadius: '12px',
                border: '1px solid var(--border-subtle)',
                backgroundColor: 'var(--surface-raised)',
                color: 'var(--text-secondary)',
                fontSize: '0.75rem',
                cursor: 'pointer',
                minHeight: '28px',
              }}
            >
              <span aria-hidden>🖼</span>
              <span>{mediaOpen ? 'hide image' : 'image'}</span>
              <span
                style={{
                  display: 'inline-block',
                  transform: mediaOpen ? 'rotate(90deg)' : 'none',
                  transition: 'transform var(--duration-normal) ease-out',
                }}
              >
                ▸
              </span>
            </button>
            {mediaOpen && (
              <img
                src={mediaUrl}
                alt="Shared image"
                loading="lazy"
                style={{
                  display: 'block',
                  marginTop: 'var(--spacing-sm)',
                  maxWidth: '100%',
                  maxHeight: '360px',
                  borderRadius: '12px',
                  border: '1px solid var(--border-subtle)',
                  objectFit: 'contain',
                }}
              />
            )}
          </div>
        )}

        {/* Timestamp — small, muted, message-app convention */}
        {formatClockTime(entry.created_at) && (
          <div
            style={{
              marginTop: '4px',
              textAlign: 'right',
              fontSize: '0.6875rem',
              color: 'var(--text-muted)',
              userSelect: 'none',
              lineHeight: 1,
            }}
            title={String(entry.created_at)}
          >
            {formatClockTime(entry.created_at)}
          </div>
        )}

        {/* Expand indicator for persona messages with cycle data */}
        {cycleData && (
          <button
            onClick={onToggleExpand}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--spacing-xs)',
              marginTop: 'var(--spacing-sm)',
              padding: '2px 0',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--text-muted)',
              fontSize: '0.75rem',
              fontFamily: "'JetBrains Mono', monospace",
              minHeight: '44px',
              minWidth: '44px',
            }}
            aria-expanded={expanded}
            aria-label={`${expanded ? 'Collapse' : 'Expand'} cycle ${cycleData.cycleId} details`}
          >
            <span
              style={{
                display: 'inline-block',
                transform: expanded ? 'rotate(90deg)' : 'none',
                transition: 'transform var(--duration-normal) ease-out',
              }}
            >
              ▸
            </span>
            <span>
              cycle {cycleData.cycleId} · {formatDuration(cycleData.durationSeconds)}
            </span>
          </button>
        )}
      </div>
    </div>
  );
}

export default ChatBubble;
