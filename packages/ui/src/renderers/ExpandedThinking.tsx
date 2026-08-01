/**
 * Expanded Thinking Component
 *
 * @module packages/ui/renderers/ExpandedThinking
 * @description Renders inline below a persona message when expanded.
 * Pushes content down — no overlay, no modal.
 *
 * Sections:
 * 1. Thinking — italic text, softer feel
 * 2. Tool outputs — list of tool calls, each tappable
 * 3. Meters — all active meters with per-meter color tokens
 * 4. Cycle metadata — model, duration, cycle number (monospace, muted)
 *
 * Expand/collapse uses grid-template-rows: 0fr -> 1fr transition (200ms ease-out).
 * Respects prefers-reduced-motion by skipping the animation.
 *
 * @antipattern Do NOT import Zustand or any store — pure renderer.
 * @antipattern Do NOT use raw hex colors — use CSS custom properties.
 * @antipattern Do NOT overlay content — expansion pushes surrounding content down.
 *
 * @upstream Called by: ChatView (rendered below ChatBubble when expanded)
 * @downstream Calls: None (leaf renderer)
 */

/**
 * Represents a single tool call made during a thinking cycle.
 * Displayed as tappable items in the tool outputs section.
 */
export interface ToolCall {
  /** Tool name (e.g., "write_notebook", "search_memories") */
  name: string;
  /** Brief result text or summary */
  result: string;
  /** Optional full details (shown when tool is clicked) */
  details?: string;
}

/** Props for the ExpandedThinking component. */
export interface ExpandedThinkingProps {
  /** The persona's internal monologue text */
  thinking: string;
  /** Tool calls made during this cycle */
  toolCalls: ToolCall[];
  /** Active meter values: meter name -> value (0-1 range) */
  meters: Record<string, number>;
  /** Cycle identifier */
  cycleId: number;
  /** LLM model used for this cycle */
  model: string;
  /** How long the cycle took in seconds */
  durationSeconds: number;
  /** Callback when a tool call is tapped for detail expansion */
  onToolClick: (tool: ToolCall) => void;
  /** Whether this section is currently expanded (controls animation) */
  isExpanded: boolean;
}

/**
 * Known meter color tokens defined in tokens.css.
 * Falls back to --text-secondary for unknown meters.
 */
const METER_COLOR_MAP: Record<string, string> = {
  aliveness: 'var(--meter-aliveness)',
  curiosity: 'var(--meter-curiosity)',
  connection: 'var(--meter-connection)',
  ease: 'var(--meter-ease)',
  delight: 'var(--meter-delight)',
  anxiety: 'var(--meter-anxiety)',
  activity: 'var(--meter-activity)',
  /* Legacy names */
  nuance: 'var(--meter-nuance)',
  engagement: 'var(--meter-engagement)',
};

/**
 * CSS for the expand/collapse animation and reduced-motion handling.
 * Uses grid-template-rows trick for smooth height transition.
 */
const EXPAND_STYLES = `
.expanded-thinking-wrapper {
  display: grid;
  grid-template-rows: 0fr;
  transition: grid-template-rows var(--duration-normal) ease-out;
}
.expanded-thinking-wrapper[data-expanded="true"] {
  grid-template-rows: 1fr;
}
.expanded-thinking-inner {
  overflow: hidden;
}
@media (prefers-reduced-motion: reduce) {
  .expanded-thinking-wrapper {
    transition: none !important;
  }
}
`;

/**
 * Renders the expanded thinking panel inline below a persona message.
 * Content pushes chat down — nothing overlaps.
 */
export function ExpandedThinking({
  thinking,
  toolCalls,
  meters,
  cycleId,
  model,
  durationSeconds,
  onToolClick,
  isExpanded,
}: ExpandedThinkingProps) {
  const meterEntries = Object.entries(meters).filter(
    ([, value]) => value != null && value > 0,
  );

  return (
    <>
      <style>{EXPAND_STYLES}</style>
      <div
        className="expanded-thinking-wrapper"
        data-expanded={isExpanded ? 'true' : 'false'}
      >
        <div className="expanded-thinking-inner">
          <div
            style={{
              padding: 'var(--spacing-md) var(--spacing-lg)',
              marginTop: 'var(--spacing-xs)',
              borderLeft: '2px solid var(--border)',
              marginLeft: 'var(--spacing-lg)',
            }}
          >
            {/* Section 1: Thinking — italic, softer */}
            {thinking && (
              <div
                style={{
                  fontStyle: 'italic',
                  color: 'var(--text-secondary)',
                  fontSize: '0.875rem',
                  lineHeight: '1.6',
                  marginBottom: 'var(--spacing-md)',
                  whiteSpace: 'pre-wrap',
                  fontFamily: "'Instrument Serif', serif",
                }}
              >
                {thinking}
              </div>
            )}

            {/* Section 2: Tool outputs — tappable list */}
            {toolCalls.length > 0 && (
              <div style={{ marginBottom: 'var(--spacing-md)' }}>
                <div
                  style={{
                    fontSize: '0.6875rem',
                    color: 'var(--text-muted)',
                    textTransform: 'uppercase' as const,
                    letterSpacing: '0.05em',
                    marginBottom: 'var(--spacing-xs)',
                  }}
                >
                  Tools
                </div>
                {toolCalls.map((tool, index) => (
                  <button
                    key={`${tool.name}-${index}`}
                    onClick={() => onToolClick(tool)}
                    style={{
                      display: 'flex',
                      alignItems: 'baseline',
                      gap: 'var(--spacing-sm)',
                      width: '100%',
                      padding: 'var(--spacing-xs) var(--spacing-sm)',
                      background: 'none',
                      border: 'none',
                      borderRadius: 'var(--radius-sm)',
                      cursor: 'pointer',
                      textAlign: 'left' as const,
                      color: 'var(--text-secondary)',
                      fontSize: '0.8125rem',
                      minHeight: '44px',
                      transition: 'background-color var(--duration-fast) ease-out',
                    }}
                    onMouseEnter={(event) => {
                      (event.currentTarget as HTMLElement).style.backgroundColor =
                        'var(--surface-raised)';
                    }}
                    onMouseLeave={(event) => {
                      (event.currentTarget as HTMLElement).style.backgroundColor =
                        'transparent';
                    }}
                    aria-label={`Tool: ${tool.name} — ${tool.result}`}
                  >
                    <span
                      style={{
                        fontFamily: "'JetBrains Mono', monospace",
                        fontSize: '0.75rem',
                        color: 'var(--accent-light)',
                        flexShrink: 0,
                      }}
                    >
                      {tool.name}
                    </span>
                    <span
                      style={{
                        color: 'var(--text-muted)',
                        fontSize: '0.75rem',
                      }}
                    >
                      → {tool.result}
                    </span>
                  </button>
                ))}
              </div>
            )}

            {/* Section 3: Meters — colored bars/pills */}
            {meterEntries.length > 0 && (
              <div style={{ marginBottom: 'var(--spacing-md)' }}>
                <div
                  style={{
                    fontSize: '0.6875rem',
                    color: 'var(--text-muted)',
                    textTransform: 'uppercase' as const,
                    letterSpacing: '0.05em',
                    marginBottom: 'var(--spacing-xs)',
                  }}
                >
                  Meters
                </div>
                <div
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap' as const,
                    gap: 'var(--spacing-sm)',
                  }}
                >
                  {meterEntries.map(([meterName, meterValue]) => {
                    const color =
                      METER_COLOR_MAP[meterName] || 'var(--text-secondary)';
                    const percentage = Math.round(meterValue * 100);

                    return (
                      <div
                        key={meterName}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          fontSize: '0.75rem',
                        }}
                      >
                        {/* Colored bar */}
                        <div
                          style={{
                            width: '40px',
                            height: '6px',
                            borderRadius: '3px',
                            backgroundColor: 'var(--surface-raised)',
                            overflow: 'hidden',
                          }}
                        >
                          <div
                            style={{
                              width: `${percentage}%`,
                              height: '100%',
                              borderRadius: '3px',
                              backgroundColor: color,
                              transition: 'width var(--duration-normal) ease-out',
                            }}
                          />
                        </div>
                        <span style={{ color, fontWeight: 500 }}>
                          {meterName}
                        </span>
                        <span style={{ color: 'var(--text-muted)' }}>
                          {percentage}%
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Section 4: Cycle metadata — monospace, muted */}
            <div
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: '0.6875rem',
                color: 'var(--text-muted)',
                display: 'flex',
                gap: 'var(--spacing-md)',
                flexWrap: 'wrap' as const,
              }}
            >
              <span>cycle {cycleId}</span>
              <span>{model}</span>
              <span>{Math.round(durationSeconds)}s</span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export default ExpandedThinking;
