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

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { usePolling } from '../hooks';
import type { Persona } from '../types';

/** Entry types that render as chat bubbles (mirrors ChatBubbleView constant). */
const MESSAGE_TYPES = new Set(['user_message', 'message_to_user']);
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
  const userInput = useAppStore((state) => state.userInput) as string;
  const activePersona = useAppStore((state) => state.activePersona) as Persona | null;
  const imagePreview = useAppStore(
    (state) => state.imagePreview,
  ) as string | null;
  const isConvertingVideo = useAppStore(
    (state) => state.isConvertingVideo,
  ) as boolean;

  const setUserInput = useAppStore((state) => state.setUserInput) as (
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
    count: messageEntries.length,
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
   * Live updates: the persona thinks on her own schedule (cycles), so new
   * entries arrive server-side with no user action. Poll gently while the tab
   * is visible (usePolling pauses on hidden) — but only when the user is
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
  const useVirtualScroll = messageEntries.length > 100;

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
        {isLoading && messageEntries.length === 0 && (
          <LoadingSkeleton
            variant="bubbles"
            bubblePattern={['left', 'right', 'left', 'right', 'left']}
            className="p-4"
          />
        )}

        {/* Empty state: welcome message */}
        {!isLoading && messageEntries.length === 0 && (
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

        {/* Populated state: message bubbles */}
        {messageEntries.length > 0 && !useVirtualScroll && (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--spacing-md)',
              padding: 'var(--spacing-lg)',
            }}
          >
            {messageEntries.map((entry) => {
              const isUser = entry.type === 'user_message';
              const cycleId = entry.cycle_id ?? undefined;
              const isExpanded =
                cycleId != null && expandedCycles.has(cycleId);
              const cycleData =
                !isUser && isExpanded ? extractCycleData(entry) : null;

              return (
                <div key={entry.id}>
                  <ChatBubble
                    entry={entry}
                    isUser={isUser}
                    expanded={isExpanded}
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
                </div>
              );
            })}
          </div>
        )}

        {/* Populated state: virtual scroll for large histories */}
        {messageEntries.length > 0 && useVirtualScroll && (
          <div
            style={{
              height: `${virtualizer.getTotalSize()}px`,
              width: '100%',
              position: 'relative',
            }}
          >
            {virtualizer.getVirtualItems().map((virtualItem) => {
              const entry = messageEntries[virtualItem.index];
              const isUser = entry.type === 'user_message';
              const cycleId = entry.cycle_id ?? undefined;
              const isExpanded =
                cycleId != null && expandedCycles.has(cycleId);
              const cycleData =
                !isUser && isExpanded ? extractCycleData(entry) : null;

              return (
                <div
                  key={entry.id}
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
                  <ChatBubble
                    entry={entry}
                    isUser={isUser}
                    expanded={isExpanded}
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
                </div>
              );
            })}
          </div>
        )}

        {/* Think trigger (below messages) */}
        <div style={{ padding: '0 var(--spacing-lg)' }}>
          <ThinkTrigger
            state={thinkTriggerState}
            onThink={triggerThinkNow}
            statusText="picking this up — usually under 2 minutes"
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
          value={userInput}
          onChange={setUserInput}
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
