/**
 * Chat View Component
 *
 * @module views/ChatView
 * @description Composes the chat experience: ChatBubbleView + ThinkTrigger + MessageInput.
 * Reads from store slices (chat, data, core). Handles scroll-to-bottom on new messages.
 * Integrates @tanstack/react-virtual for virtual scrolling of long history.
 *
 * UI states: empty (welcome message), loading (skeleton placeholders), error (inline),
 * populated (normal bubble view).
 *
 * @antipattern Do NOT fetch data here — store slices handle fetching.
 * @antipattern Do NOT define domain types locally — import from @persistence packages.
 * @antipattern Do NOT use raw hex colors — use CSS custom properties from tokens.css.
 *
 * @upstream Called by: AppShell (as the default/home view)
 * @downstream Calls: ChatBubbleView, ExpandedThinking, ThinkTrigger, MessageInput, store actions
 */

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import type { HistoryEntry } from '@persistence/db';
import { ArrowDown } from 'lucide-react';
// @ts-ignore - module path will be resolved at build time
import { ChatBubble } from '@persistence/ui/src/renderers/ChatBubble';
// @ts-ignore - module path will be resolved at build time
import { ExpandedThinking } from '@persistence/ui/src/renderers/ExpandedThinking';
// @ts-ignore - module path will be resolved at build time
import type { ToolCall } from '@persistence/ui/src/renderers/ExpandedThinking';
import { ThinkTrigger } from '../components/chat/ThinkTrigger';
import type { ThinkTriggerState } from '../components/chat/ThinkTrigger';
import { MessageInput } from '../components/ui/MessageInput';
import { LoadingSkeleton } from '../components/ui';
import { useAppStore } from '../store';
import api from '../api/client';
import { usePolling } from '../hooks';
import { ActionGroup } from '../components/chat/ActionGroup';
import { MetersStrip } from '../components/chat/MetersStrip';
import { TimelineView } from '../components/chat/TimelineView';
import { BranchChip } from '../components/chat/BranchChip';
import {
  InsertMemoryPoint,
  InlineMemoryEditor,
} from '../components/chat/MemoryEditTools';
import { mergeThread, midpointTimestamp } from '../components/chat/mergeThread';
import type {
  SyntheticMemoryRow,
  MemoryOverrideRow,
  ThreadEntry,
} from '../components/chat/mergeThread';
import {
  segmentHistory,
  USER_BUBBLE_TYPES,
  BUBBLE_TYPES,
  type ChatSegment,
} from '../components/chat/segmentHistory';
import { resolveMediaUrl } from '../store';
import type { Persona } from '../types';

/** Entry types that render as chat bubbles (mirrors ChatBubbleView constant).
 * NOTE: inbound user messages exist under TWO types — 'dan_message' (legacy
 * rows) and 'user_message' (what POST /message writes now). Omitting
 * 'user_message' made Dan's sent messages invisible in the chat thread
 * (2026-07-11 bug: "pressing enter doesn't show my message"). */
const MESSAGE_TYPES = BUBBLE_TYPES;
const USER_MESSAGE_TYPES = USER_BUBBLE_TYPES;
const AUTO_FOLLOW_BREAK_THRESHOLD_PX = 48;
const SCROLL_BUTTON_DISTANCE_MULTIPLIER = 1.5;

/**
 * Extracts cycle thinking data from a history entry's metadata.
 * Returns structured data for ExpandedThinking or null if unavailable.
 */
function extractCycleData(entry: HistoryEntry): {
  thinking: string;
  toolCalls: ToolCall[];
  meters: Record<string, number>;
  model: string;
  durationSeconds: number;
} | null {
  if (!entry.metadata) return null;

  try {
    const parsed = JSON.parse(entry.metadata);
    return {
      thinking: parsed.thinking || '',
      toolCalls: (parsed.tool_calls || []).map(
        (toolCall: { name?: string; result?: string; details?: string }) => ({
          name: toolCall.name || 'unknown',
          result: toolCall.result || '',
          details: toolCall.details,
        }),
      ),
      meters: parsed.meters || {},
      model: parsed.model || 'unknown',
      durationSeconds: parsed.duration_seconds || 0,
    };
  } catch {
    return null;
  }
}

/**
 * ChatView — the primary view of the app.
 *
 * Composes bubbles, think trigger, and input bar into a scrollable
 * chat experience. Uses virtual scrolling for histories with 100+ messages.
 */
export function ChatView() {
  const history = useAppStore((state) => state.history) as HistoryEntry[];
  const isLoading = useAppStore((state) => state.isLoading) as boolean;
  const isThinking = useAppStore((state) => state.isThinking) as boolean;
  const error = useAppStore((state) => state.error) as string | null;
  const danInput = useAppStore((state) => state.danInput) as string;
  const activePersona = useAppStore((state) => state.activePersona) as Persona | null;
  const imagePreview = useAppStore(
    (state) => state.imagePreview,
  ) as string | null;
  const isConvertingVideo = useAppStore(
    (state) => state.isConvertingVideo,
  ) as boolean;

  const setDanInput = useAppStore((state) => state.setDanInput) as (
    value: string,
  ) => void;
  const sendMessage = useAppStore(
    (state) => state.sendMessage,
  ) as () => Promise<void>;
  const fetchHistory = useAppStore(
    (state) => state.fetchHistory,
  ) as () => Promise<void>;
  const triggerThinkNow = useAppStore(
    (state) => state.triggerThinkNow,
  ) as () => Promise<void>;
  const clearError = useAppStore((state) => state.clearError) as () => void;
  const addLog = useAppStore((state) => state.addLog) as (message: string) => void;
  const handleImageSelect = useAppStore(
    (state) => state.handleImageSelect,
  ) as (event: { target: { files: FileList | File[] } }) => void;
  const clearImage = useAppStore((state) => state.clearImage) as () => void;

  /** Set of cycle IDs currently expanded for thinking detail view. */
  const [expandedCycles, setExpandedCycles] = useState<Set<number>>(new Set());

  /** Ref for the scrollable container (virtual scroll parent). */
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [shouldShowScrollButton, setShouldShowScrollButton] = useState(false);
  const [isAutoFollowEnabled, setIsAutoFollowEnabled] = useState(true);
  const [scrollButtonHovered, setScrollButtonHovered] = useState(false);

  /** Filter to only message-type entries for the bubble view. */
  const messageEntries = useMemo(
    () => history.filter((entry) => MESSAGE_TYPES.has(entry.type)),
    [history],
  );

  /**
   * Branch-aware thread state. /history returns canonical rows only; the
   * persona's real context is branch-aware, so the display fetches the
   * active branch's synthetics + overrides and merges them (mergeThread) —
   * otherwise injected memories are invisible and edited messages show
   * their original text.
   */
  const [activeBranch, setActiveBranchName] = useState('main');
  const [synthetics, setSynthetics] = useState<SyntheticMemoryRow[]>([]);
  const [overrides, setOverrides] = useState<MemoryOverrideRow[]>([]);
  const [editMode, setEditMode] = useState(false);
  const [editingEntryId, setEditingEntryId] = useState<number | null>(null);

  const refreshBranchState = useCallback(async () => {
    try {
      const [b, syn, ov] = await Promise.all([
        api.get('/branches') as Promise<{ activeBranch?: string }>,
        api.get('/memory/synthetic') as Promise<{
          synthetics?: SyntheticMemoryRow[];
        }>,
        api.get('/memory/overrides') as Promise<{
          overrides?: MemoryOverrideRow[];
        }>,
      ]);
      setActiveBranchName(b.activeBranch || 'main');
      setSynthetics(syn.synthetics || []);
      setOverrides(ov.overrides || []);
    } catch (error: unknown) {
      addLog(`Error: branch view degraded to canonical: ${error instanceof Error ? error.message : String(error)}`);
      /* branch layer degrades to the canonical thread */
    }
  }, []);

  useEffect(() => {
    void refreshBranchState();
  }, [refreshBranchState]);

  useEffect(() => {
    const handleMemoryOverridesChanged = () => {
      void refreshBranchState();
    };
    window.addEventListener('memory-overrides-changed', handleMemoryOverridesChanged);
    return () => window.removeEventListener('memory-overrides-changed', handleMemoryOverridesChanged);
  }, [refreshBranchState]);

  const fetchHistoryAction = useAppStore((s) => s.fetchHistory) as
    | (() => Promise<void>)
    | undefined;

  /** After a branch swap / injection / rewrite: refetch everything. */
  const handleBranchChanged = useCallback(() => {
    setEditingEntryId(null);
    void refreshBranchState();
    void fetchHistoryAction?.();
  }, [refreshBranchState, fetchHistoryAction]);

  /**
   * Thread = canonical history merged with the active branch's synthetics
   * and overrides, so the display tells the same story as the persona's
   * context. Excluded entries hide in normal mode, show dimmed in edit mode.
   */
  // Display must mirror the context resolve, which IGNORES overrides on main
  // (build-system-prompt.ts): showing a "rewritten" bubble that never reaches
  // the persona's context is the exact lie that confused the DMT edit. On
  // main we show pristine canonical history; edits auto-branch server-side.
  const effectiveOverrides = useMemo(
    () => (activeBranch === 'main' ? [] : overrides),
    [activeBranch, overrides],
  );
  const thread = useMemo(
    () => mergeThread(history, synthetics, effectiveOverrides),
    [history, synthetics, effectiveOverrides],
  );
  const visibleThread = useMemo(
    () =>
      editMode ? thread : thread.filter((e) => !(e as ThreadEntry)._excluded),
    [thread, editMode],
  );
  const segments = useMemo(
    () => segmentHistory(visibleThread),
    [visibleThread],
  );

  /** Chat <-> Timeline mode (persisted in the store since the original UI). */
  const chatViewMode = useAppStore((s) => s.chatViewMode) as string;
  const setChatViewMode = useAppStore(
    (s) => s.setChatViewMode,
  ) as (mode: string) => void;

  /**
   * Resolve an entry's attached media for the in-bubble image chip.
   *
   * `internal` is overloaded by era: on message entries it can hold private
   * side-channel TEXT (Clio's asides); on media entries it holds a data URL
   * or `r2://` key. Only values that actually look like images may become an
   * <img src> — feeding prose through produced a broken-image chip on real
   * messages (the "?" bubble, 2026-07-11).
   */
  const entryMediaUrl = useCallback((entry: HistoryEntry): string | null => {
    const internal = entry.internal;
    if (typeof internal !== 'string' || internal.length === 0) return null;
    if (internal.startsWith('data:image')) return internal;
    if (internal.startsWith('r2://')) return resolveMediaUrl(internal) || null;
    if (/^https?:\/\/\S+\.(png|jpe?g|gif|webp|avif|svg)(\?\S*)?$/i.test(internal)) {
      return internal;
    }
    return null;
  }, []);

  /** Whether the viewport is mobile-sized (< 768px). */
  const isMobileViewport = typeof window !== 'undefined' && window.innerWidth < 768;

  /**
   * Toggle expansion of a specific cycle's thinking panel.
   * On mobile, auto-collapse the previously expanded cycle to save space.
   */
  const handleToggleCycle = useCallback((cycleId: number) => {
    setExpandedCycles((previous) => {
      if (previous.has(cycleId)) {
        const next = new Set(previous);
        next.delete(cycleId);
        return next;
      }
      // On mobile, collapse all others before expanding the new one
      const next = isMobileViewport ? new Set<number>() : new Set(previous);
      next.add(cycleId);
      return next;
    });
  }, [isMobileViewport]);

  /** Handle tool click inside expanded thinking (placeholder for detail expansion). */
  const handleToolClick = useCallback((tool: ToolCall) => {
     
    console.log('Tool detail requested:', tool.name, tool.details || tool.result);
  }, []);

  /** Determine think trigger state. */
  const thinkTriggerState: ThinkTriggerState = useMemo(() => {
    if (messageEntries.length === 0) return 'hidden';
    if (isThinking) return 'thinking';
    return 'idle';
  }, [messageEntries.length, isThinking]);

  /** Virtual scrolling for the message list. */
  const virtualizer = useVirtualizer({
    count: segments.length,
    getScrollElement: () => scrollContainerRef.current,
    estimateSize: () => 80,
    overscan: 5,
  });

  const updateScrollState = useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const distanceFromBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight;
    const isAtBottom = distanceFromBottom <= AUTO_FOLLOW_BREAK_THRESHOLD_PX;
    const farFromBottom =
      distanceFromBottom > container.clientHeight * SCROLL_BUTTON_DISTANCE_MULTIPLIER;

    setIsAutoFollowEnabled(isAtBottom);
    setShouldShowScrollButton(farFromBottom);
  }, []);

  const scrollToLatestMessage = useCallback((behavior: ScrollBehavior = 'smooth') => {
    const container = scrollContainerRef.current;
    if (!container) return;
    container.scrollTo({
      top: container.scrollHeight,
      behavior,
    });
    setIsAutoFollowEnabled(true);
    setShouldShowScrollButton(false);
  }, []);

  /** Scroll to bottom when new messages arrive. */
  const previousMessageCount = useRef(messageEntries.length);
  useEffect(() => {
    if (messageEntries.length > previousMessageCount.current && isAutoFollowEnabled) {
      requestAnimationFrame(() => {
        scrollToLatestMessage('auto');
      });
    }
    previousMessageCount.current = messageEntries.length;
  }, [isAutoFollowEnabled, messageEntries.length, scrollToLatestMessage]);

  /**
   * Live updates: Clio thinks on her own schedule (cycles), so new entries
   * arrive server-side with no user action. Poll gently while the tab is
   * visible (usePolling pauses on hidden) — but only when the user is
   * following the bottom of the thread, so a refetch never yanks the scroll
   * position while they're reading older messages.
   */
  const isAutoFollowRef = useRef(isAutoFollowEnabled);
  useEffect(() => {
    isAutoFollowRef.current = isAutoFollowEnabled;
  }, [isAutoFollowEnabled]);
  usePolling(
    () => {
      if (isAutoFollowRef.current) {
        void fetchHistory();
      }
    },
    { interval: 30000, immediate: false },
  );

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    updateScrollState();
    const handleScroll = () => updateScrollState();
    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => container.removeEventListener('scroll', handleScroll);
  }, [updateScrollState]);

  useEffect(() => {
    updateScrollState();
  }, [messageEntries.length, updateScrollState]);

  const personaName = activePersona?.name || 'Persona';

  /** Use virtualizer only for large histories (>100 messages). */
  const useVirtualScroll = !editMode && segments.length > 150;

  /** Render one chat segment: a message bubble (+cycle panel) or a drip-down. */
  const renderSegment = (segment: ChatSegment) => {
    if (segment.kind === 'day') {
      return (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--spacing-md)',
            padding: 'var(--spacing-xs) 0',
            userSelect: 'none',
          }}
          aria-label={segment.label}
        >
          <span style={{ flex: 1, height: '1px', background: 'var(--border-subtle)' }} />
          <span
            style={{
              fontSize: '0.6875rem',
              color: 'var(--text-muted)',
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
            }}
          >
            {segment.label}
          </span>
          <span style={{ flex: 1, height: '1px', background: 'var(--border-subtle)' }} />
        </div>
      );
    }
    if (segment.kind === 'actions') {
      return <ActionGroup entries={segment.entries} />;
    }
    const entry = segment.entry as ThreadEntry;
    const isUser = USER_MESSAGE_TYPES.has(entry.type);

    // Rewriting this entry: swap the bubble for the inline editor.
    if (editMode && editingEntryId === entry.id && !entry._synthetic) {
      return (
        <InlineMemoryEditor
          entryId={entry.id}
          initialContent={entry.content}
          isUser={isUser}
          onSaved={handleBranchChanged}
          onCancel={() => setEditingEntryId(null)}
        />
      );
    }

    const cycleId = entry.cycle_id ?? undefined;
    const isExpanded = cycleId != null && expandedCycles.has(cycleId);
    const cycleData = !isUser && isExpanded ? extractCycleData(entry) : null;
    const bubble = (
      <>
        <ChatBubble
          entry={entry}
          isUser={isUser}
          expanded={isExpanded}
          mediaUrl={entryMediaUrl(entry)}
          onToggleExpand={() => {
            if (cycleId != null) {
              handleToggleCycle(cycleId);
            }
          }}
        />
        {cycleData && cycleId != null && (
          <ExpandedThinking
            thinking={cycleData.thinking}
            toolCalls={cycleData.toolCalls}
            meters={cycleData.meters}
            cycleId={cycleId}
            model={cycleData.model}
            durationSeconds={cycleData.durationSeconds}
            onToolClick={handleToolClick}
            isExpanded={isExpanded}
          />
        )}
      </>
    );

    const annotated = entry._synthetic || entry._edited || entry._excluded;
    if (!annotated && !editMode) return bubble;

    return (
      <div
        style={{
          position: 'relative',
          ...(entry._synthetic
            ? {
                border: '1px dashed var(--accent)',
                borderRadius: 'var(--radius-md)',
                padding: 'var(--spacing-xs)',
                background:
                  'color-mix(in srgb, var(--accent) 5%, transparent)',
              }
            : {}),
          ...(entry._excluded ? { opacity: 0.45 } : {}),
        }}
      >
        {annotated && (
          <div
            style={{
              fontSize: '0.6875rem',
              color: 'var(--accent)',
              padding: '0 var(--spacing-xs) 4px',
              textAlign: isUser ? 'right' : 'left',
              userSelect: 'none',
            }}
          >
            {entry._synthetic
              ? '⑂ synthetic memory'
              : entry._excluded
                ? '⑂ excluded from memory'
                : `⑂ rewritten on ${activeBranch}`}
          </div>
        )}
        {editMode && !entry._synthetic && (
          <button
            onClick={() => setEditingEntryId(entry.id)}
            aria-label="Rewrite this memory"
            title="Rewrite this memory on the active branch"
            style={{
              position: 'absolute',
              top: '2px',
              ...(isUser ? { left: '2px' } : { right: '2px' }),
              padding: '2px 7px',
              borderRadius: '999px',
              border: '1px solid var(--border-subtle)',
              background: 'var(--surface-raised)',
              color: 'var(--text-secondary)',
              fontSize: '0.75rem',
              cursor: 'pointer',
              zIndex: 2,
            }}
          >
            ✎
          </button>
        )}
        {bubble}
      </div>
    );
  };

  /**
   * Midpoint timestamp for the edit-mode insertion gap ABOVE segment
   * `index` (segments.length = the trailing gap after the last segment).
   */
  const gapTimestamp = (index: number): string => {
    const entriesOf = (seg: ChatSegment): HistoryEntry[] =>
      seg.kind === 'message'
        ? [seg.entry]
        : seg.kind === 'actions'
          ? seg.entries
          : [];
    let before: HistoryEntry | undefined;
    for (let i = index - 1; i >= 0 && !before; i--) {
      const list = entriesOf(segments[i]);
      before = list[list.length - 1];
    }
    let after: HistoryEntry | undefined;
    for (let i = index; i < segments.length && !after; i++) {
      after = entriesOf(segments[i])[0];
    }
    return midpointTimestamp(before, after);
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        backgroundColor: 'var(--background)',
        position: 'relative',
      }}
    >
      {/* State strip + view mode toggle */}
      <div
        className="chat-header-row"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--spacing-sm)',
          padding: 'var(--spacing-xs) var(--spacing-lg) 0',
        }}
      >
        <BranchChip
          activeBranch={activeBranch}
          syntheticCount={synthetics.length}
          editMode={editMode}
          onToggleEditMode={() => {
            setEditMode((p) => !p);
            setEditingEntryId(null);
          }}
          onBranchChanged={handleBranchChanged}
        />
        <div className="chat-header-meters">
          <MetersStrip />
        </div>
        <div
          className="chat-header-toggle"
          role="tablist"
          aria-label="Chat view mode"
          style={{
            display: 'inline-flex',
            border: '1px solid var(--border-subtle)',
            borderRadius: '14px',
            overflow: 'hidden',
            flexShrink: 0,
          }}
        >
          {(['chat', 'timeline'] as const).map((mode) => (
            <button
              key={mode}
              role="tab"
              aria-selected={chatViewMode === mode}
              onClick={() => setChatViewMode(mode)}
              style={{
                padding: '4px 12px',
                fontSize: '0.75rem',
                border: 'none',
                cursor: 'pointer',
                minHeight: '28px',
                backgroundColor:
                  chatViewMode === mode ? 'var(--accent)' : 'var(--surface)',
                color:
                  chatViewMode === mode
                    ? 'var(--text-primary)'
                    : 'var(--text-muted)',
              }}
            >
              {mode === 'chat' ? 'Chat' : 'Timeline'}
            </button>
          ))}
        </div>
      </div>

      {/* Scrollable message area */}
      <div
        ref={scrollContainerRef}
        style={{
          flex: 1,
          overflowY: 'auto',
          overflowX: 'hidden',
        }}
      >
        {/* Loading state: skeleton placeholders */}
        {chatViewMode !== 'timeline' && isLoading && messageEntries.length === 0 && (
          <LoadingSkeleton
            variant="bubbles"
            bubblePattern={['left', 'right', 'left', 'right', 'left']}
            className="p-4"
          />
        )}

        {/* Empty state: welcome message */}
        {chatViewMode !== 'timeline' && !isLoading && messageEntries.length === 0 && (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              padding: 'var(--spacing-xl)',
              color: 'var(--text-muted)',
              textAlign: 'center',
            }}
          >
            <div
              style={{
                fontSize: '1.25rem',
                marginBottom: 'var(--spacing-sm)',
                color: 'var(--text-secondary)',
              }}
            >
              Start a conversation
            </div>
            <div style={{ fontSize: '0.875rem' }}>
              Send a message to {personaName} below.
            </div>
          </div>
        )}

        {/* Populated state: interleaved bubbles + drip-downs */}
        {chatViewMode !== 'timeline' &&
          segments.length > 0 &&
          !useVirtualScroll && (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--spacing-md)',
              padding: 'var(--spacing-lg)',
            }}
          >
            {segments.map((segment, index) => {
              const key =
                segment.kind === 'message'
                  ? `m-${segment.entry.id}`
                  : segment.key;
              return (
                <Fragment key={key}>
                  {editMode && segment.kind !== 'day' && (
                    <InsertMemoryPoint
                      timestamp={gapTimestamp(index)}
                      onInserted={handleBranchChanged}
                    />
                  )}
                  <div>{renderSegment(segment)}</div>
                </Fragment>
              );
            })}
            {editMode && (
              <InsertMemoryPoint
                timestamp={gapTimestamp(segments.length)}
                onInserted={handleBranchChanged}
              />
            )}
          </div>
        )}

        {/* Populated state: virtual scroll for large histories */}
        {chatViewMode !== 'timeline' &&
          segments.length > 0 &&
          useVirtualScroll && (
          <div
            style={{
              height: `${virtualizer.getTotalSize()}px`,
              width: '100%',
              position: 'relative',
            }}
          >
            {virtualizer.getVirtualItems().map((virtualItem) => {
              const segment = segments[virtualItem.index];
              return (
                <div
                  key={
                    segment.kind === 'message'
                      ? segment.entry.id
                      : segment.key
                  }
                  ref={virtualizer.measureElement}
                  data-index={virtualItem.index}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    transform: `translateY(${virtualItem.start}px)`,
                    padding: '0 var(--spacing-lg)',
                    paddingTop:
                      virtualItem.index === 0 ? 'var(--spacing-lg)' : '0',
                    paddingBottom: 'var(--spacing-md)',
                  }}
                >
                  {renderSegment(segment)}
                </div>
              );
            })}
          </div>
        )}

        {/* Timeline mode: the full history feed */}
        {chatViewMode === 'timeline' && <TimelineView history={history} />}

        {/* Think trigger (below messages) */}
        <div style={{ padding: '0 var(--spacing-lg)' }}>
          <ThinkTrigger
            state={thinkTriggerState}
            onThink={triggerThinkNow}
            statusText="she's picking this up — usually under 2 minutes"
          />
        </div>
      </div>

      {shouldShowScrollButton && (
        <button
          type="button"
          onClick={() => scrollToLatestMessage('smooth')}
          onMouseEnter={() => setScrollButtonHovered(true)}
          onMouseLeave={() => setScrollButtonHovered(false)}
          aria-label="Scroll to latest message"
          className="hover-lift"
          style={{
            position: 'absolute',
            right: 'var(--spacing-lg)',
            bottom: 'calc(var(--spacing-lg) + 72px)',
            width: '44px',
            height: '44px',
            minWidth: '44px',
            minHeight: '44px',
            borderRadius: '50%',
            border: '1px solid var(--accent)',
            backgroundColor: scrollButtonHovered
              ? 'var(--accent-hover)'
              : 'var(--accent)',
            color: 'var(--text-primary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: 'var(--shadow-md)',
            cursor: 'pointer',
            zIndex: 2,
            transition:
              'background-color var(--duration-normal) ease-out, transform var(--duration-fast) ease-out',
          }}
        >
          <ArrowDown size={18} />
        </button>
      )}

      {/* Error state: inline error near the bottom, stays until dismissed */}
      {error && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: 'var(--spacing-sm) var(--spacing-lg)',
            backgroundColor: 'var(--surface)',
            borderTop: '1px solid var(--danger)',
            color: 'var(--danger)',
            fontSize: '0.8125rem',
          }}
        >
          <span>{error}</span>
          <button
            onClick={clearError}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--text-muted)',
              padding: 'var(--spacing-xs)',
              minHeight: '44px',
              minWidth: '44px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1rem',
            }}
            aria-label="Dismiss error"
          >
            ✕
          </button>
        </div>
      )}

      {/* Input bar (fixed at bottom) */}
      <div
        style={{
          padding: 'var(--spacing-sm) var(--spacing-lg)',
          borderTop: '1px solid var(--border-subtle)',
          backgroundColor: 'var(--background)',
        }}
      >
        <MessageInput
          value={danInput}
          onChange={setDanInput}
          onSend={sendMessage}
          placeholder={`Message ${personaName}...`}
          disabled={isThinking}
          imagePreview={imagePreview}
          onImageSelect={handleImageSelect}
          onClearImage={clearImage}
          isConvertingVideo={isConvertingVideo}
        />
      </div>
    </div>
  );
}

export default ChatView;
